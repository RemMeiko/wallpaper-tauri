import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Palette, History } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageSearchHistory } from "../App";

interface SearchBarProps {
  keyword: string;
  resolution: string;
  searching: boolean;
  imageSearching: boolean;
  imageSearchHistory: ImageSearchHistory[];
  onKeywordChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onSearch: () => void;
  onImageSearch: () => void;
  onHistorySearch: (keyword: string) => void;
}

export function SearchBar({
  keyword,
  resolution,
  searching,
  imageSearching,
  imageSearchHistory,
  onKeywordChange,
  onResolutionChange,
  onSearch,
  onImageSearch,
  onHistorySearch,
}: SearchBarProps) {
  const busy = searching || imageSearching;
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    if (showHistory) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHistory]);

  return (
    <div className="flex gap-2 items-center">
      <Input
        className="flex-1 h-9"
        placeholder="输入关键词搜索壁纸..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
      />
      <Select value={resolution || "any"} onValueChange={(v: string | null) => onResolutionChange(!v || v === "any" ? "" : v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="下载原图" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">下载原图</SelectItem>
          <SelectItem value="1920x1080">裁剪 1920×1080</SelectItem>
          <SelectItem value="2560x1440">裁剪 2560×1440</SelectItem>
          <SelectItem value="3840x2160">裁剪 3840×2160</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={onSearch} disabled={busy} className="gap-1.5">
        {searching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        {searching ? "搜索中" : "搜索"}
      </Button>
      <Button onClick={onImageSearch} disabled={busy} variant="outline" className="gap-1.5">
        {imageSearching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Palette className="size-4" />
        )}
        {imageSearching ? "分析中" : "以图搜图"}
      </Button>
      <div className="relative" ref={historyRef}>
        <Button
          variant="outline"
          size="icon"
          disabled={imageSearchHistory.length === 0}
          onClick={() => setShowHistory((v) => !v)}
          title="搜图历史"
        >
          <History className="size-4" />
        </Button>
        {showHistory && imageSearchHistory.length > 0 && (
          <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg">
            <p className="text-xs text-muted-foreground mb-2 px-1">搜图历史</p>
            {imageSearchHistory.map((h) => (
              <button
                key={h.timestamp}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setShowHistory(false);
                  onHistorySearch(h.keyword);
                }}
              >
                {h.imagePath && (
                  <img
                    src={convertFileSrc(h.imagePath)}
                    alt=""
                    className="size-10 rounded object-cover shrink-0"
                  />
                )}
                <span className="truncate flex-1">{h.keyword}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
