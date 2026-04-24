import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, Monitor, CheckSquare } from "lucide-react";

interface ActionBarProps {
  selectedCount: number;
  totalCount: number;
  downloading: boolean;
  progressPercent: number | null;
  resultText: string;
  onDownload: () => void;
  onSetWallpaper?: () => void;
  canSetWallpaper?: boolean;
  onToggleSelectAll?: () => void;
}

export function ActionBar({
  selectedCount,
  totalCount,
  downloading,
  progressPercent,
  resultText,
  onDownload,
  onSetWallpaper,
  canSetWallpaper,
  onToggleSelectAll,
}: ActionBarProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  return (
    <div className="flex gap-3 items-center">
      {onToggleSelectAll && totalCount > 0 && (
        <Button
          variant="outline"
          onClick={onToggleSelectAll}
          className="gap-1.5"
        >
          <CheckSquare className="size-4" />
          {allSelected ? "取消全选" : "全选"}
        </Button>
      )}
      <Button
        onClick={onDownload}
        disabled={downloading || selectedCount === 0}
        className="gap-1.5"
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {downloading
          ? "下载中..."
          : `下载选中${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
      </Button>
      {onSetWallpaper && (
        <Button
          variant="outline"
          onClick={onSetWallpaper}
          disabled={!canSetWallpaper}
          className="gap-1.5"
        >
          <Monitor className="size-4" />
          设为壁纸
        </Button>
      )}
      {progressPercent !== null && (
        <Progress value={progressPercent} className="flex-1" />
      )}
      {resultText && (
        <span className="ml-auto text-sm text-muted-foreground">{resultText}</span>
      )}
    </div>
  );
}
