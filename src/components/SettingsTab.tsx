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

  const handleBrowseDownload = useCallback(async () => {
    const selected = await open({ directory: true, title: "选择下载目录" });
    if (selected) {
      saveSettings({ ...settings, download_dir: selected as string });
    }
  }, [settings, saveSettings]);

  const handleBrowseLocal = useCallback(async () => {
    const selected = await open({ directory: true, title: "选择本地壁纸目录" });
    if (selected) {
      saveSettings({ ...settings, local_wallpaper_dir: selected as string });
    }
  }, [settings, saveSettings]);

  const handleToggleRotation = useCallback(async () => {
    setToggling(true);
    try {
      if (rotationStatus.running) {
        await invoke("stop_rotation");
        // Also update settings
        saveSettings({ ...settings, rotation_enabled: false });
        toast.success("自动轮换已停止");
      } else {
        // Save settings first so rotation reads latest config
        const updated = { ...settings, rotation_enabled: true };
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
  }, [rotationStatus.running, settings, saveSettings, onSettingsChange]);

  const handleIntervalChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1 && num <= 1440) {
        saveSettings({ ...settings, rotation_interval_minutes: num });
      }
    },
    [settings, saveSettings]
  );

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
                  value={settings.download_dir}
                  onChange={(e) =>
                    saveSettings({ ...settings, download_dir: e.target.value })
                  }
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
                  value={settings.local_wallpaper_dir}
                  onChange={(e) =>
                    saveSettings({ ...settings, local_wallpaper_dir: e.target.value })
                  }
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
                value={settings.rotation_interval_minutes}
                onChange={(e) => handleIntervalChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">范围 1 ~ 1440 分钟（1 天）</p>
            </div>

            {/* Mode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted-foreground">轮换模式</label>
              <Select
                value={settings.rotation_mode}
                onValueChange={(val) =>
                  saveSettings({ ...settings, rotation_mode: val as string })
                }
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
