import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Play, Square } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export interface AppSettings {
  download_dir: string;
  local_wallpaper_dir: string;
  rotation_enabled: boolean;
  rotation_interval_minutes: number;
  rotation_mode: string;
}

interface RotationStatus {
  running: boolean;
  next_change_at: string | null;
}

interface SettingsTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function SettingsTab({ settings, onSettingsChange }: SettingsTabProps) {
  const [rotationStatus, setRotationStatus] = useState<RotationStatus>({
    running: false,
    next_change_at: null,
  });
  const [toggling, setToggling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Local input state for debounced fields (allows immediate UI updates)
  const [localDownloadDir, setLocalDownloadDir] = useState(settings.download_dir);
  const [localWallpaperDir, setLocalWallpaperDir] = useState(settings.local_wallpaper_dir);
  const [localInterval, setLocalInterval] = useState(String(settings.rotation_interval_minutes));

  // Sync local state when settings change from external sources (e.g. folder picker, load)
  useEffect(() => {
    setLocalDownloadDir(settings.download_dir);
  }, [settings.download_dir]);
  useEffect(() => {
    setLocalWallpaperDir(settings.local_wallpaper_dir);
  }, [settings.local_wallpaper_dir]);
  useEffect(() => {
    setLocalInterval(String(settings.rotation_interval_minutes));
  }, [settings.rotation_interval_minutes]);

  // Poll rotation status every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const status = await invoke<RotationStatus>("get_rotation_status");
        setRotationStatus(status);
      } catch {
        // ignore
      }
    };
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Immediate save (for folder picker, Select dropdown, rotation toggle)
  const saveSettings = useCallback(
    async (updated: AppSettings) => {
      onSettingsChange(updated);
      try {
        await invoke("save_settings", { settings: updated });
        toast.success("设置已保存");
      } catch (e) {
        toast.error(String(e));
      }
    },
    [onSettingsChange]
  );

  // Debounced save for text/number inputs (500ms delay, auto-flush on unmount)
  const debouncedSave = useDebouncedCallback(
    async (updated: AppSettings) => {
      onSettingsChange(updated);
      try {
        await invoke("save_settings", { settings: updated });
        toast.success("设置已保存");
      } catch (e) {
        toast.error(String(e));
      }
    },
    500
  );

  // We need a ref to always have the latest settings for the debounced callback
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const handleDownloadDirInput = useCallback(
    (value: string) => {
      setLocalDownloadDir(value);
      // Update parent state immediately for UI consistency, but debounce disk save
      const updated = { ...settingsRef.current, download_dir: value };
      onSettingsChange(updated);
      debouncedSave(updated);
    },
    [onSettingsChange, debouncedSave]
  );

  const handleWallpaperDirInput = useCallback(
    (value: string) => {
      setLocalWallpaperDir(value);
      const updated = { ...settingsRef.current, local_wallpaper_dir: value };
      onSettingsChange(updated);
      debouncedSave(updated);
    },
    [onSettingsChange, debouncedSave]
  );

  const handleIntervalInput = useCallback(
    (value: string) => {
      setLocalInterval(value);
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1 && num <= 1440) {
        const updated = { ...settingsRef.current, rotation_interval_minutes: num };
        onSettingsChange(updated);
        debouncedSave(updated);
      }
    },
    [onSettingsChange, debouncedSave]
  );

  const handleBrowseDownload = useCallback(async () => {
    debouncedSave.flush(); // flush any pending debounced save before immediate save
    const selected = await open({ directory: true, title: "选择下载目录" });
    if (selected) {
      setLocalDownloadDir(selected as string);
      saveSettings({ ...settingsRef.current, download_dir: selected as string });
    }
  }, [saveSettings, debouncedSave]);

  const handleBrowseLocal = useCallback(async () => {
    debouncedSave.flush();
    const selected = await open({ directory: true, title: "选择本地壁纸目录" });
    if (selected) {
      setLocalWallpaperDir(selected as string);
      saveSettings({ ...settingsRef.current, local_wallpaper_dir: selected as string });
    }
  }, [saveSettings, debouncedSave]);

  const handleToggleRotation = useCallback(async () => {
    debouncedSave.flush();
    setToggling(true);
    try {
      if (rotationStatus.running) {
        await invoke("stop_rotation");
        // Update settings without triggering saveSettings toast (to avoid double toast)
        const updated = { ...settingsRef.current, rotation_enabled: false };
        await invoke("save_settings", { settings: updated });
        onSettingsChange(updated);
        toast.success("自动轮换已停止");
      } else {
        // Save settings first so rotation reads latest config
        const updated = { ...settingsRef.current, rotation_enabled: true };
        await invoke("save_settings", { settings: updated });
        onSettingsChange(updated);
        await invoke("start_rotation");
        toast.success("自动轮换已启动");
      }
      // Refresh status immediately
      const status = await invoke<RotationStatus>("get_rotation_status");
      setRotationStatus(status);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setToggling(false);
    }
  }, [rotationStatus.running, onSettingsChange, debouncedSave]);

  const formatNextChange = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <ScrollArea className="flex-1 min-h-0 -mx-1">
      <div className="flex flex-col gap-4 p-1 max-w-2xl">
        {/* Directory settings */}
        <Card>
          <CardHeader>
            <CardTitle>目录设置</CardTitle>
            <CardDescription>配置壁纸下载和本地壁纸库的目录路径</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Download dir */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">下载目录</label>
              <div className="flex gap-2 items-center">
                <Input
                  className="flex-1 h-9"
                  placeholder="输入壁纸保存目录路径..."
                  value={localDownloadDir}
                  onChange={(e) => handleDownloadDirInput(e.target.value)}
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="outline" size="icon" onClick={handleBrowseDownload}>
                        <FolderOpen className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>选择文件夹</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Local wallpaper dir */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">本地壁纸目录</label>
              <div className="flex gap-2 items-center">
                <Input
                  className="flex-1 h-9"
                  placeholder="输入本地壁纸目录路径..."
                  value={localWallpaperDir}
                  onChange={(e) => handleWallpaperDirInput(e.target.value)}
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="outline" size="icon" onClick={handleBrowseLocal}>
                        <FolderOpen className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>选择文件夹</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">自动轮换将从此目录选取壁纸</p>
            </div>
          </CardContent>
        </Card>

        {/* Rotation settings */}
        <Card>
          <CardHeader>
            <CardTitle>自动轮换</CardTitle>
            <CardDescription>定时自动切换桌面壁纸</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Toggle + status */}
            <div className="flex items-center gap-3">
              <Button
                variant={rotationStatus.running ? "destructive" : "default"}
                onClick={handleToggleRotation}
                disabled={toggling}
                className="gap-1.5"
              >
                {rotationStatus.running ? (
                  <Square className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {toggling
                  ? "切换中..."
                  : rotationStatus.running
                  ? "停止轮换"
                  : "启用自动轮换"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {rotationStatus.running ? (
                  <>
                    运行中 · 下次切换:{" "}
                    <span className="text-foreground">
                      {formatNextChange(rotationStatus.next_change_at)}
                    </span>
                  </>
                ) : (
                  "已停止"
                )}
              </span>
            </div>

            {/* Interval */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">轮换间隔（分钟）</label>
              <Input
                type="number"
                min={1}
                max={1440}
                className="w-32 h-9"
                value={localInterval}
                onChange={(e) => handleIntervalInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">范围 1 ~ 1440 分钟（1 天）</p>
            </div>

            {/* Mode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">轮换模式</label>
              <Select
                value={settings.rotation_mode}
                onValueChange={(val) => {
                  debouncedSave.flush();
                  saveSettings({ ...settingsRef.current, rotation_mode: val as string });
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">随机</SelectItem>
                  <SelectItem value="sequential">顺序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
