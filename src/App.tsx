import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { TitleBar } from "./components/TitleBar";
import { SearchBar } from "./components/SearchBar";
import { DirectoryBar } from "./components/DirectoryBar";
import { ActionBar } from "./components/ActionBar";
import { WallpaperGrid } from "./components/WallpaperGrid";
import { ImagePreview } from "./components/ImagePreview";
import { LocalWallpaperTab } from "./components/LocalWallpaperTab";
import { SettingsTab, type AppSettings } from "./components/SettingsTab";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Wallpaper } from "./components/WallpaperCard";

const WALLHAVEN_PAGE_SIZE = 24;

const DEFAULT_SETTINGS: AppSettings = {
  download_dir: "",
  local_wallpaper_dir: "",
  rotation_enabled: false,
  rotation_interval_minutes: 30,
  rotation_mode: "random",
};

interface ImageSearchAnalysis {
  primary_query: string;
  queries: string[];
  artist?: string | null;
  series?: string | null;
  category_hint?: string | null;
  confidence: string;
}

export interface ImageSearchHistory {
  keyword: string;
  imagePath: string; // 用户给出的原图路径
  timestamp: number;
}

const IMAGE_SEARCH_HISTORY_KEY = "wallpaper_image_search_history";

function loadImageSearchHistory(): ImageSearchHistory[] {
  try {
    const raw = localStorage.getItem(IMAGE_SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveImageSearchHistory(history: ImageSearchHistory[]) {
  localStorage.setItem(IMAGE_SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

function App() {
  const [keyword, setKeyword] = useState("");
  const [resolution, setResolution] = useState("");
  const [results, setResults] = useState<Wallpaper[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resultText, setResultText] = useState("");
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [previewWallpaper, setPreviewWallpaper] = useState<Wallpaper | null>(null);
  const [imageSearching, setImageSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setDownloadedFiles] = useState<Map<string, string>>(new Map());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeImageQuery, setActiveImageQuery] = useState("");
  const [imageSearchHistory, setImageSearchHistory] = useState<ImageSearchHistory[]>(loadImageSearchHistory);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings(loaded);
        if (loaded.rotation_enabled) {
          try {
            await invoke("start_rotation");
          } catch {
          }
        }
      } catch {
      }
    })();
  }, []);

  const doSearch = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw) {
      toast.info("请输入关键词");
      return;
    }

    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setResultText("搜索中...");
    setProgressPercent(null);
    setCurrentPage(1);
    setHasMore(false);
    setActiveImageQuery("");

    try {
      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: kw,
        page: 1,
        colors: null,
      });
      setResults(data);
      setHasMore(data.length >= WALLHAVEN_PAGE_SIZE);
      setResultText(data.length ? `找到 ${data.length} 条结果` : "未找到结果");
      if (data.length) toast.success(`找到 ${data.length} 张壁纸`);
    } catch (e) {
      setResultText("");
      toast.error(String(e));
    } finally {
      setSearching(false);
    }
  }, [keyword]);

  const doLoadMore = useCallback(async () => {
    const kw = activeImageQuery || keyword.trim();
    if (!kw || loadingMore) return;

    const nextPage = currentPage + 1;
    setLoadingMore(true);

    try {
      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: kw,
        page: nextPage,
        colors: null,
      });
      setResults((prev) => {
        const existingIds = new Set(prev.map((wp) => wp.id));
        const unique = data.filter((wp) => !existingIds.has(wp.id));
        const merged = [...prev, ...unique];
        setResultText(`共 ${merged.length} 条结果`);
        return merged;
      });
      setCurrentPage(nextPage);
      setHasMore(data.length >= WALLHAVEN_PAGE_SIZE);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [activeImageQuery, keyword, currentPage, loadingMore]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const doDownload = useCallback(async () => {
    const dir = settings.download_dir.trim();
    if (!dir) {
      toast.info("请先设置下载目录");
      return;
    }
    if (selected.size === 0) {
      toast.info("请先点击卡片选中壁纸");
      return;
    }

    setDownloading(true);
    setProgressPercent(0);
    let downloaded = 0;
    let errors = 0;
    const total = selected.size;
    const downloadedPaths: Map<string, string> = new Map();

    // 解析分辨率设置
    const [targetWidth, targetHeight] = resolution
      ? resolution.split("x").map((s) => parseInt(s, 10))
      : [0, 0];
    const useCrop = targetWidth > 0 && targetHeight > 0;

    for (const id of selected) {
      const wp = results.find((r) => r.id === id);
      if (!wp || !wp.path) continue;

      const ext = wp.path.split(".").pop() || "jpg";
      const filename = `${wp.id}.${ext}`;

      try {
        let savedPath: string;
        if (useCrop) {
          savedPath = await invoke<string>("download_wallpaper_cropped", {
            url: wp.path,
            targetDir: dir,
            filename,
            targetWidth,
            targetHeight,
          });
        } else {
          savedPath = await invoke<string>("download_wallpaper", {
            url: wp.path,
            targetDir: dir,
            filename,
          });
        }
        downloadedPaths.set(id, savedPath);
        downloaded++;
      } catch {
        errors++;
      }
      setProgressPercent(Math.round(((downloaded + errors) / total) * 100));
      setResultText(`已下载 ${downloaded}/${total}`);
    }

    setDownloading(false);
    setProgressPercent(null);
    setDownloadedFiles((prev) => new Map([...prev, ...downloadedPaths]));

    const parts = [];
    if (downloaded) parts.push(`下载 ${downloaded} 张`);
    if (errors) parts.push(`失败 ${errors} 张`);
    const summary = parts.join("  ") || "无操作";
    setResultText(summary);

    if (downloaded) toast.success(summary);
    else if (errors) toast.error(summary);
  }, [settings.download_dir, selected, results, resolution]);

  const doImageSearch = useCallback(async () => {
    try {
      const filePath = await open({
        title: "选择图片进行以图搜图",
        filters: [{ name: "图片文件", extensions: ["jpg", "jpeg", "png", "bmp", "webp"] }],
      });
      if (!filePath) return;

      setImageSearching(true);
      setResults([]);
      setSelected(new Set());
      setResultText("正在分析图片...");
      setProgressPercent(null);
      setCurrentPage(1);
      setHasMore(false);

      const analysis = await invoke<ImageSearchAnalysis>("analyze_wallpaper_image", {
        path: filePath as string,
      });

      const query = analysis.primary_query.trim();
      if (!query) {
        throw new Error("未生成可用搜索词");
      }

      setActiveImageQuery(query);
      setKeyword(query);
      setResultText("搜索中...");

      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: query,
        page: 1,
        colors: null,
      });
      // 以图搜图结果去重（按 id）
      const seen = new Set<string>();
      const unique = data.filter((wp) => {
        if (seen.has(wp.id)) return false;
        seen.add(wp.id);
        return true;
      });
      setResults(unique);
      setHasMore(unique.length >= WALLHAVEN_PAGE_SIZE);
      setResultText(unique.length ? `找到 ${unique.length} 条结果` : "未找到结果");
      if (unique.length) {
        toast.success(`找到 ${unique.length} 张壁纸`);
        // 保存到历史记录（使用原图路径）
        const newHistory: ImageSearchHistory = {
          keyword: query,
          imagePath: filePath as string,
          timestamp: Date.now(),
        };
        const updated = [newHistory, ...imageSearchHistory.filter((h) => h.keyword !== query)];
        setImageSearchHistory(updated);
        saveImageSearchHistory(updated);
      }
    } catch (e) {
      setResultText("");
      toast.error(String(e));
    } finally {
      setImageSearching(false);
    }
  }, [imageSearchHistory]);

  // 从历史记录搜索
  const doHistorySearch = useCallback(async (kw: string) => {
    setKeyword(kw);
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setResultText("搜索中...");
    setProgressPercent(null);
    setCurrentPage(1);
    setHasMore(false);
    setActiveImageQuery(kw);

    try {
      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: kw,
        page: 1,
        colors: null,
      });
      const seen = new Set<string>();
      const unique = data.filter((wp) => {
        if (seen.has(wp.id)) return false;
        seen.add(wp.id);
        return true;
      });
      setResults(unique);
      setHasMore(unique.length >= WALLHAVEN_PAGE_SIZE);
      setResultText(unique.length ? `找到 ${unique.length} 条结果` : "未找到结果");
      if (unique.length) toast.success(`找到 ${unique.length} 张壁纸`);
    } catch (e) {
      setResultText("");
      toast.error(String(e));
    } finally {
      setSearching(false);
    }
  }, []);

  // 全选/取消全选
  const doToggleSelectAll = useCallback(() => {
    if (selected.size === results.length && results.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((wp) => wp.id)));
    }
  }, [selected, results]);

  // 设为壁纸（搜索页）：选中单张 → 下载到本地壁纸目录 → 设为桌面
  const doSetWallpaperFromSearch = useCallback(async () => {
    if (selected.size !== 1) {
      toast.info("请选中单张壁纸");
      return;
    }
    const id = Array.from(selected)[0];
    const wp = results.find((r) => r.id === id);
    if (!wp || !wp.path) return;

    const dir = settings.local_wallpaper_dir.trim() || settings.download_dir.trim();
    if (!dir) {
      toast.info("请先在设置中配置本地壁纸目录");
      return;
    }

    try {
      setResultText("下载并设置中...");
      const ext = wp.path.split(".").pop() || "jpg";
      const filename = `${wp.id}.${ext}`;

      // 解析分辨率设置
      const [targetWidth, targetHeight] = resolution
        ? resolution.split("x").map((s) => parseInt(s, 10))
        : [0, 0];
      const useCrop = targetWidth > 0 && targetHeight > 0;

      let savedPath: string;
      if (useCrop) {
        savedPath = await invoke<string>("download_wallpaper_cropped", {
          url: wp.path,
          targetDir: dir,
          filename,
          targetWidth,
          targetHeight,
        });
      } else {
        savedPath = await invoke<string>("download_wallpaper", {
          url: wp.path,
          targetDir: dir,
          filename,
        });
      }
      setDownloadedFiles((prev) => new Map([...prev, [id, savedPath]]));
      const msg = await invoke<string>("set_wallpaper", { path: savedPath });
      toast.success(msg);
      setResultText("壁纸已设置");
    } catch (e) {
      toast.error(String(e));
      setResultText("");
    }
  }, [selected, results, settings, resolution]);

  return (
    <div className="flex flex-col h-screen p-5 gap-3 bg-background">
      <TitleBar />
      <Tabs defaultValue="search" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="search">搜索壁纸</TabsTrigger>
          <TabsTrigger value="local">本地壁纸</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex-1 flex flex-col min-h-0 gap-3 mt-2">
          <SearchBar
            keyword={keyword}
            resolution={resolution}
            searching={searching}
            imageSearching={imageSearching}
            imageSearchHistory={imageSearchHistory}
            onKeywordChange={setKeyword}
            onResolutionChange={setResolution}
            onSearch={doSearch}
            onImageSearch={doImageSearch}
            onHistorySearch={doHistorySearch}
          />
          <DirectoryBar
            downloadDir={settings.download_dir}
            onDirectoryChange={(dir) => {
              const updated = { ...settings, download_dir: dir };
              setSettings(updated);
              invoke("save_settings", { settings: updated })
                .then(() => toast.success("下载目录已更新"))
                .catch(() => {});
            }}
          />
          <Separator />
          <ActionBar
            selectedCount={selected.size}
            totalCount={results.length}
            downloading={downloading}
            progressPercent={progressPercent}
            resultText={resultText}
            onDownload={doDownload}
            onSetWallpaper={doSetWallpaperFromSearch}
            canSetWallpaper={selected.size === 1}
            onToggleSelectAll={doToggleSelectAll}
          />
          <WallpaperGrid
            wallpapers={results}
            selected={selected}
            searching={searching}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onToggleSelect={toggleSelect}
            onDoubleClick={setPreviewWallpaper}
            onLoadMore={doLoadMore}
          />
        </TabsContent>

        <TabsContent value="local" className="flex-1 flex flex-col min-h-0 mt-2">
          <LocalWallpaperTab initialDir={settings.local_wallpaper_dir} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 flex flex-col min-h-0 mt-2">
          <SettingsTab settings={settings} onSettingsChange={setSettings} />
        </TabsContent>
      </Tabs>

      <ImagePreview wallpaper={previewWallpaper} onClose={() => setPreviewWallpaper(null)} />
    </div>
  );
}

export default App;
