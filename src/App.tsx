import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
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

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 已下载文件路径映射 (wallpaper id -> local path)
  const [downloadedFiles, setDownloadedFiles] = useState<Map<string, string>>(new Map());

  // 配置状态
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 应用启动时加载配置
  useEffect(() => {
    (async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings(loaded);
        // 如果轮换已启用，自动启动轮换
        if (loaded.rotation_enabled) {
          try {
            await invoke("start_rotation");
          } catch {
            // 启动失败不阻塞应用
          }
        }
      } catch {
        // 加载失败使用默认值
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

    try {
      const atleast = resolution || null;
      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: kw,
        atleast,
        page: 1,
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
  }, [keyword, resolution]);

  // 修复遗留问题: doLoadMore 中 resultText 使用函数式 setResults 回调同步更新
  const doLoadMore = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw || loadingMore) return;

    const nextPage = currentPage + 1;
    setLoadingMore(true);

    try {
      const atleast = resolution || null;
      const data = await invoke<Wallpaper[]>("search_wallpapers", {
        keyword: kw,
        atleast,
        page: nextPage,
      });
      setResults((prev) => {
        const merged = [...prev, ...data];
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
  }, [keyword, resolution, currentPage, loadingMore]);

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

    for (const id of selected) {
      const wp = results.find((r) => r.id === id);
      if (!wp || !wp.path) continue;

      const ext = wp.path.split(".").pop() || "jpg";
      const filename = `${wp.id}.${ext}`;

      try {
        const savedPath = await invoke<string>("download_wallpaper", {
          url: wp.path,
          targetDir: dir,
          filename,
        });
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
  }, [settings.download_dir, selected, results]);

  // 修复遗留问题: 仅当选中单张已下载壁纸时启用"设为壁纸"
  const doSetWallpaper = useCallback(async () => {
    const selectedIds = Array.from(selected);
    const downloadedSelected = selectedIds.filter((id) => downloadedFiles.has(id));
    if (downloadedSelected.length !== 1) {
      toast.info("请选中单张已下载的壁纸");
      return;
    }
    const localPath = downloadedFiles.get(downloadedSelected[0])!;
    try {
      const msg = await invoke<string>("set_wallpaper", { path: localPath });
      toast.success(msg);
    } catch (e) {
      toast.error(String(e));
    }
  }, [selected, downloadedFiles]);

  // 修复遗留问题: 使用 useMemo 缓存 canSetWallpaper
  const canSetWallpaper = useMemo(() => {
    const downloadedSelected = Array.from(selected).filter((id) => downloadedFiles.has(id));
    return downloadedSelected.length === 1;
  }, [selected, downloadedFiles]);

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
            onKeywordChange={setKeyword}
            onResolutionChange={setResolution}
            onSearch={doSearch}
          />
          <DirectoryBar
            downloadDir={settings.download_dir}
            onDirectoryChange={(dir) => {
              const updated = { ...settings, download_dir: dir };
              setSettings(updated);
              invoke("save_settings", { settings: updated }).catch(() => {});
            }}
          />
          <Separator />
          <ActionBar
            selectedCount={selected.size}
            downloading={downloading}
            progressPercent={progressPercent}
            resultText={resultText}
            onDownload={doDownload}
            onSetWallpaper={doSetWallpaper}
            canSetWallpaper={canSetWallpaper}
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

      <ImagePreview
        wallpaper={previewWallpaper}
        onClose={() => setPreviewWallpaper(null)}
      />
    </div>
  );
}

export default App;
