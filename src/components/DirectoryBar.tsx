import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FolderOpen } from "lucide-react";

interface DirectoryBarProps {
  downloadDir: string;
  onDirectoryChange: (dir: string) => void;
}

export function DirectoryBar({ downloadDir, onDirectoryChange }: DirectoryBarProps) {
  const handleBrowse = async () => {
    const selected = await open({ directory: true, title: "选择下载目录" });
    if (selected) onDirectoryChange(selected as string);
  };

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm text-muted-foreground shrink-0">下载目录</span>
      <Input
        className="flex-1 h-9"
        placeholder="输入壁纸保存目录路径..."
        value={downloadDir}
        onChange={(e) => onDirectoryChange(e.target.value)}
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
  );
}
