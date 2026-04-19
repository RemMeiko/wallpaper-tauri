import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  keyword: string;
  resolution: string;
  searching: boolean;
  onKeywordChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onSearch: () => void;
}

export function SearchBar({
  keyword,
  resolution,
  searching,
  onKeywordChange,
  onResolutionChange,
  onSearch,
}: SearchBarProps) {
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
          <SelectValue placeholder="不限分辨率" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">不限分辨率</SelectItem>
          <SelectItem value="1920x1080">1920×1080</SelectItem>
          <SelectItem value="2560x1440">2560×1440</SelectItem>
          <SelectItem value="3840x2160">3840×2160</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={onSearch} disabled={searching} className="gap-1.5">
        {searching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        {searching ? "搜索中" : "搜索"}
      </Button>
    </div>
  );
}
