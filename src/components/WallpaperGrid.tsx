import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { WallpaperCard, type Wallpaper } from "./WallpaperCard";
import { EmptyState } from "./EmptyState";

interface WallpaperGridProps {
  wallpapers: Wallpaper[];
  selected: Set<string>;
  searching: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onToggleSelect: (id: string) => void;
  onDoubleClick: (wallpaper: Wallpaper) => void;
  onLoadMore: () => void;
}

export function WallpaperGrid({
  wallpapers,
  selected,
  searching,
  hasMore,
  loadingMore,
  onToggleSelect,
  onDoubleClick,
  onLoadMore,
}: WallpaperGridProps) {
  if (wallpapers.length === 0 && !searching) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className="flex-1 min-h-0 -mx-1">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-1">
        {wallpapers.map((wp, i) => (
          <div key={wp.id} className="animate-card-in" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
            <WallpaperCard
              wallpaper={wp}
              isSelected={selected.has(wp.id)}
              index={i}
              onToggleSelect={onToggleSelect}
              onDoubleClick={onDoubleClick}
            />
          </div>
        ))}
      </div>
      {wallpapers.length > 0 && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            disabled={!hasMore || loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "加载中..." : hasMore ? "加载更多" : "没有更多了"}
          </Button>
        </div>
      )}
    </ScrollArea>
  );
}
