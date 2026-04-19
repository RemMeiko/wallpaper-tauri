import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FolderOpen, ImageIcon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocalWallpaper {
  path: string;
  filename: string;
}

export function LocalWallpaperTab({ initialDir }: { initialDir?: string }) {
  const [localDir, setLocalDir] = useState("");
  const [wallpapers, setWallpapers] = useState<LocalWallpaper[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [settingWallpaper, setSettingWallpaper] = useState(false);
  const initialLoaded = useRef(false);

  // 当 initialDir 从配置加载后，自动设置目录并扫描
  useEffect(() => {
    if (initialDir && initialDir.trim() && !initialLoaded.current) {
      initialLoaded.current = true;
      setLocalDir(initialDir);
      doScan(initialDir);
    }
  }, [initialDir]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, title: "选择本地壁纸目录" });
    if (selected) {
      setLocalDir(selected as string);
      doScan(selected as string);
    }
  }, []);

  const doScan = useCallback(async (dir: string) => {
    if (!dir.trim()) return;
    setScanning(true);
    setSelectedPath(null);
    try {
      const data = await invoke<LocalWallpaper[]>("scan_local_wallpapers", { dir });
      setWallpapers(data);
      if (data.length === 0) {
        toast.info("该目录下没有找到图片文件");
      }
    } catch (e) {
      toast.error(String(e));
      setWallpapers([]);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleDirSubmit = useCallback(() => {
    if (localDir.trim()) {
      doScan(localDir.trim());
    }
  }, [localDir, doScan]);

  const handleSetWallpaper = useCallback(async () => {
    if (!selectedPath) return;
    setSettingWallpaper(true);
    try {
      const msg = await invoke<string>("set_wallpaper", { path: selectedPath });
      toast.success(msg);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSettingWallpaper(false);
    }
  }, [selectedPath]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Directory bar */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground shrink-0">壁纸目录</span>
        <Input
          className="flex-1 h-9"
          placeholder="输入本地壁纸目录路径..."
          value={localDir}
          onChange={(e) => setLocalDir(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleDirSubmit(); }}
        />
        <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" size="icon" onClick={handleBrowse}>
            <FolderOpen className="size-4" />
          </Button>}
        />
        <TooltipContent>选择文件夹</TooltipContent>
      </Tooltip>
      </div>

      {/* Action bar */}
      {selectedPath && (
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleSetWallpaper}
            disabled={settingWallpaper}
            className="gap-1.5"
          >
            <Monitor className="size-4" />
            {settingWallpaper ? "设置中..." : "设为壁纸"}
          </Button>
          <span className="text-sm text-muted-foreground">
            已选择: {wallpapers.find(w => w.path === selectedPath)?.filename}
          </span>
        </div>
      )}

      {/* Grid */}
      {wallpapers.length === 0 && !scanning ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
          <ImageIcon className="size-16 opacity-20" />
          <p className="text-sm">选择目录以浏览本地壁纸</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0 -mx-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-1">
            {wallpapers.map((wp, i) => (
              <LocalWallpaperCard
                key={wp.path}
                wallpaper={wp}
                isSelected={selectedPath === wp.path}
                index={i}
                onSelect={() => setSelectedPath(selectedPath === wp.path ? null : wp.path)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function LocalWallpaperCard({
  wallpaper,
  isSelected,
  index,
  onSelect,
}: {
  wallpaper: LocalWallpaper;
  isSelected: boolean;
  index: number;
  onSelect: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const assetUrl = convertFileSrc(wallpaper.path);

  return (
    <div className="animate-card-in" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
      <Card
        className={cn(
          "cursor-pointer overflow-hidden transition-all duration-200 group relative",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
          isSelected && "ring-2 ring-primary animate-select-pulse"
        )}
        onClick={onSelect}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={assetUrl}
            alt={wallpaper.filename}
            loading="lazy"
            className={cn(
              "size-full object-cover transition-transform duration-300 group-hover:scale-105",
              loaded ? "animate-fade-in" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
          />
          {!loaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}
        </div>
        <CardContent className="p-2">
          <span className="text-xs text-muted-foreground truncate block">
            {wallpaper.filename}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
