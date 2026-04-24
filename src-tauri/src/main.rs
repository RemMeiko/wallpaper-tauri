// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

// ── Data structures ──

#[derive(Debug, Serialize, Deserialize)]
struct Wallpaper {
    id: String,
    resolution: String,
    category: String,
    path: String,
    short_url: String,
    thumb: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResponse {
    data: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LocalWallpaper {
    path: String,
    filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    download_dir: String,
    local_wallpaper_dir: String,
    rotation_enabled: bool,
    rotation_interval_minutes: u32,
    rotation_mode: String, // "random" | "sequential"
}

impl Default for AppSettings {
    fn default() -> Self {
        let download_dir = dirs::download_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .to_string_lossy()
            .to_string();
        let local_wallpaper_dir = dirs::picture_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .to_string_lossy()
            .to_string();
        Self {
            download_dir,
            local_wallpaper_dir,
            rotation_enabled: false,
            rotation_interval_minutes: 30,
            rotation_mode: "random".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct RotationStatus {
    running: bool,
    next_change_at: Option<String>, // ISO 8601
}

// ── App state ──

struct AppState {
    rotation_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    rotation_running: Arc<std::sync::atomic::AtomicBool>,
    rotation_next_change: Arc<Mutex<Option<String>>>,
    sequential_index: Arc<AtomicUsize>,
}

// ── Settings file helpers ──

fn settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".wallpaper_app").join("settings.json")
}

fn read_settings_from_disk() -> AppSettings {
    let path = settings_path();
    if !path.exists() {
        return AppSettings::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| {
            // Corrupted file — return defaults and overwrite
            let defaults = AppSettings::default();
            let _ = write_settings_to_disk(&defaults);
            defaults
        }),
        Err(_) => AppSettings::default(),
    }
}

fn write_settings_to_disk(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败：{}", e))?;
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化配置失败：{}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("写入配置文件失败：{}", e))?;
    Ok(())
}

// ── Scan helper (reused by rotation) ──

fn scan_dir_for_images(dir: &str) -> Vec<LocalWallpaper> {
    let path = std::path::Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Vec::new();
    }
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    let image_extensions = ["jpg", "jpeg", "png", "bmp", "webp"];
    let mut wallpapers = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let file_path = entry.path();
        if !file_path.is_file() {
            continue;
        }
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if image_extensions.contains(&ext.as_str()) {
            let abs_path = file_path
                .canonicalize()
                .unwrap_or(file_path.clone())
                .to_string_lossy()
                .to_string();
            let abs_path = abs_path.strip_prefix(r"\\?\").unwrap_or(&abs_path).to_string();
            let filename = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            wallpapers.push(LocalWallpaper {
                path: abs_path,
                filename,
            });
        }
    }
    wallpapers
}

// ── Set wallpaper helper (reused by rotation) ──

fn do_set_wallpaper(path: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let canonical = std::path::Path::new(path)
            .canonicalize()
            .map_err(|e| format!("路径规范化失败：{}", e))?;

        let canonical_str = canonical.to_string_lossy().to_string();
        let canonical_str = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str);

        let wide: Vec<u16> = OsStr::new(canonical_str)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let result = unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::SystemParametersInfoW(
                windows_sys::Win32::UI::WindowsAndMessaging::SPI_SETDESKWALLPAPER,
                0,
                wide.as_ptr() as *mut _,
                windows_sys::Win32::UI::WindowsAndMessaging::SPIF_UPDATEINIFILE
                    | windows_sys::Win32::UI::WindowsAndMessaging::SPIF_SENDCHANGE,
            )
        };

        if result == 0 {
            let err_code = unsafe { windows_sys::Win32::Foundation::GetLastError() };
            return Err(format!("设置壁纸失败，错误码：{}", err_code));
        }

        Ok("壁纸已设置".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("仅支持 Windows 系统".to_string())
    }
}

// ── Tauri commands ──

#[derive(Debug, Serialize, Deserialize)]
struct ImageSearchAnalysis {
    primary_query: String,
    queries: Vec<String>,
    artist: Option<String>,
    series: Option<String>,
    category_hint: Option<String>,
    confidence: String,
}

#[tauri::command]
async fn analyze_wallpaper_image(path: String) -> Result<ImageSearchAnalysis, String> {
    let image_bytes = std::fs::read(&path).map_err(|e| format!("读取图片失败：{}", e))?;

    if std::env::var("ANTHROPIC_API_KEY").ok().filter(|v| !v.trim().is_empty()).is_none() {
        return Err("未配置 ANTHROPIC_API_KEY，请先设置环境变量后再试。".to_string());
    }

    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&image_bytes);

    let media_type = match path.rsplit('.').next().map(|e| e.to_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    };
    let prompt = r#"你是一个 wallhaven 壁纸搜索分析器。目标：根据输入图片识别最可能的画师/作者、作品系列/IP；如果都无法可靠识别，再退化到风格标签。

请严格返回 JSON：
{
  "artist": "字符串或空",
  "series": "字符串或空",
  "confidence": "high|medium|low",
  "category_hint": "anime|general|people",
  "queries": ["从宽到窄的1到4条搜索词"]
}

搜索词生成优先级：
1. 画师名
2. 画师名 + 内容类型
3. 画师名 + 场景元素
4. 如果无法识别画师，再用系列/IP；再不行才用风格标签

要求：
- 不要解释
- queries[0] 必须是最推荐直接执行的搜索词
- 如果无法判断 artist/series，用空字符串
"#;

    let body = serde_json::json!({
        "model": "claude-opus-4-6",
        "max_tokens": 400,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": encoded
                    }
                }
            ]
        }]
    });

    let api_key = std::env::var("ANTHROPIC_API_KEY").map_err(|_| "未配置 ANTHROPIC_API_KEY".to_string())?;
    let base_url = std::env::var("ANTHROPIC_BASE_URL").unwrap_or_else(|_| "https://api.anthropic.com".to_string());
    let api_url = format!("{}/v1/messages", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("调用 Claude 视觉分析失败：{}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Claude 分析失败：{}", text));
    }

    let value: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 Claude 响应失败：{}", e))?;

    let text = value["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|item| item["text"].as_str())
        .ok_or_else(|| "Claude 未返回可解析文本".to_string())?;

    // 剥离 markdown 代码块包裹（如 ```json ... ```）
    let json_text = text.trim();
    let json_text = if json_text.starts_with("```") {
        let inner = json_text
            .strip_prefix("```json").or_else(|| json_text.strip_prefix("```"))
            .unwrap_or(json_text);
        inner.strip_suffix("```").unwrap_or(inner).trim()
    } else {
        json_text
    };

    let parsed: serde_json::Value = serde_json::from_str(json_text)
        .map_err(|e| format!("Claude 返回的 JSON 无法解析：{}，原文：{}", e, &json_text[..json_text.len().min(200)]))?;

    let queries = parsed["queries"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if queries.is_empty() {
        return Err("Claude 未生成可用搜索词".to_string());
    }

    Ok(ImageSearchAnalysis {
        primary_query: queries[0].clone(),
        queries,
        artist: parsed["artist"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        series: parsed["series"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        category_hint: parsed["category_hint"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        confidence: parsed["confidence"].as_str().unwrap_or("low").to_string(),
    })
}

#[tauri::command]
async fn search_wallpapers(keyword: String, page: Option<u32>, colors: Option<String>) -> Result<Vec<Wallpaper>, String> {
    let page_num = page.unwrap_or(1);
    let mut url = format!(
        "https://wallhaven.cc/api/v1/search?q={}&purity=100&sorting=date_added&order=desc&page={}",
        urlencoding::encode(&keyword),
        page_num
    );

    if let Some(ref color) = colors {
        if !color.is_empty() {
            url.push_str(&format!("&colors={}", color));
        }
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("搜索失败：{}", e))?;

    let search_result: SearchResponse = response
        .json()
        .await
        .map_err(|e| format!("解析失败：{}", e))?;

    let wallpapers: Vec<Wallpaper> = search_result
        .data
        .iter()
        .map(|item| Wallpaper {
            id: item["id"].as_str().unwrap_or("").to_string(),
            resolution: item["resolution"].as_str().unwrap_or("未知分辨率").to_string(),
            category: item["category"].as_str().unwrap_or("unknown").to_string(),
            path: item["path"].as_str().unwrap_or("").to_string(),
            short_url: item["short_url"].as_str().unwrap_or("").to_string(),
            thumb: item["thumbs"]["small"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(wallpapers)
}

#[tauri::command]
async fn download_wallpaper(url: String, target_dir: String, filename: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("下载失败：{}", e))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取失败：{}", e))?;

    let target_path = PathBuf::from(&target_dir).join(&filename);

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建目录失败：{}", e))?;

    std::fs::write(&target_path, bytes)
        .map_err(|e| format!("保存文件失败：{}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn download_wallpaper_cropped(
    url: String,
    target_dir: String,
    filename: String,
    target_width: u32,
    target_height: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("下载失败：{}", e))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取失败：{}", e))?;

    // 解码图片
    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("图片解码失败：{}", e))?;

    let (src_w, src_h) = (img.width(), img.height());
    let target_ratio = target_width as f64 / target_height as f64;
    let src_ratio = src_w as f64 / src_h as f64;

    // 居中裁剪到目标宽高比
    let (crop_w, crop_h) = if src_ratio > target_ratio {
        // 原图更宽，裁左右
        let h = src_h;
        let w = (h as f64 * target_ratio).round() as u32;
        (w.min(src_w), h)
    } else {
        // 原图更高，裁上下
        let w = src_w;
        let h = (w as f64 / target_ratio).round() as u32;
        (w, h.min(src_h))
    };

    let crop_x = (src_w.saturating_sub(crop_w)) / 2;
    let crop_y = (src_h.saturating_sub(crop_h)) / 2;

    let cropped = img.crop_imm(crop_x, crop_y, crop_w, crop_h);

    // 缩放到目标分辨率
    let resized = cropped.resize_exact(
        target_width,
        target_height,
        image::imageops::FilterType::Lanczos3,
    );

    // 保存为 PNG
    let out_filename = format!(
        "{}_{}x{}.png",
        filename.rsplit_once('.').map(|(n, _)| n).unwrap_or(&filename),
        target_width,
        target_height
    );
    let target_path = PathBuf::from(&target_dir).join(&out_filename);

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建目录失败：{}", e))?;

    resized
        .save(&target_path)
        .map_err(|e| format!("保存裁剪图片失败：{}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_local_wallpapers(dir: String) -> Result<Vec<LocalWallpaper>, String> {
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("目录不存在：{}", dir));
    }
    if !path.is_dir() {
        return Err(format!("路径不是目录：{}", dir));
    }
    Ok(scan_dir_for_images(&dir))
}

#[tauri::command]
fn set_wallpaper(path: String) -> Result<String, String> {
    do_set_wallpaper(&path)
}

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    Ok(read_settings_from_disk())
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    write_settings_to_disk(&settings)
}

#[tauri::command]
async fn start_rotation(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Stop existing rotation first
    {
        let mut handle = state.rotation_handle.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    let settings = read_settings_from_disk();
    let interval_mins = settings.rotation_interval_minutes.max(1);
    let mode = settings.rotation_mode.clone();
    let dir = settings.local_wallpaper_dir.clone();

    let running = state.rotation_running.clone();
    let next_change = state.rotation_next_change.clone();
    let seq_index = state.sequential_index.clone();

    running.store(true, Ordering::SeqCst);

    // Calculate first next_change_at
    {
        let next = chrono::Local::now() + chrono::Duration::minutes(interval_mins as i64);
        let mut nc = next_change.lock().await;
        *nc = Some(next.to_rfc3339());
    }

    let handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(
            tokio::time::Duration::from_secs(interval_mins as u64 * 60),
        );
        // Skip the first immediate tick
        interval.tick().await;

        loop {
            interval.tick().await;

            let wallpapers = scan_dir_for_images(&dir);
            if wallpapers.is_empty() {
                // Update next_change_at even if no wallpapers
                let next = chrono::Local::now() + chrono::Duration::minutes(interval_mins as i64);
                let mut nc = next_change.lock().await;
                *nc = Some(next.to_rfc3339());
                continue;
            }

            let chosen = if mode == "sequential" {
                let idx = seq_index.fetch_add(1, Ordering::SeqCst) % wallpapers.len();
                &wallpapers[idx]
            } else {
                use rand::Rng;
                let idx = rand::thread_rng().gen_range(0..wallpapers.len());
                &wallpapers[idx]
            };

            // Ignore errors — don't break the timer
            let _ = do_set_wallpaper(&chosen.path);

            // Update next_change_at
            let next = chrono::Local::now() + chrono::Duration::minutes(interval_mins as i64);
            let mut nc = next_change.lock().await;
            *nc = Some(next.to_rfc3339());
        }
    });

    let mut h = state.rotation_handle.lock().await;
    *h = Some(handle);

    Ok(())
}

#[tauri::command]
async fn stop_rotation(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut handle = state.rotation_handle.lock().await;
    if let Some(h) = handle.take() {
        h.abort();
    }
    state.rotation_running.store(false, Ordering::SeqCst);
    let mut nc = state.rotation_next_change.lock().await;
    *nc = None;
    Ok(())
}

#[tauri::command]
async fn get_rotation_status(
    state: tauri::State<'_, AppState>,
) -> Result<RotationStatus, String> {
    let running = state.rotation_running.load(Ordering::SeqCst);
    let next_change_at = state.rotation_next_change.lock().await.clone();
    Ok(RotationStatus {
        running,
        next_change_at,
    })
}

// ── Main ──

fn main() {
    let app_state = AppState {
        rotation_handle: Arc::new(Mutex::new(None)),
        rotation_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        rotation_next_change: Arc::new(Mutex::new(None)),
        sequential_index: Arc::new(AtomicUsize::new(0)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            search_wallpapers,
            download_wallpaper,
            download_wallpaper_cropped,
            scan_local_wallpapers,
            set_wallpaper,
            load_settings,
            save_settings,
            start_rotation,
            stop_rotation,
            get_rotation_status,
            analyze_wallpaper_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
