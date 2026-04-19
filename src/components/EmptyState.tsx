import { ImageIcon } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
      <ImageIcon className="size-16 opacity-20" />
      <p className="text-sm">输入关键词开始搜索壁纸</p>
    </div>
  );
}
