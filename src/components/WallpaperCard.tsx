import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export interface Wallpaper {
  id: string;
  resolution: string;
  category: string;
  path: string;
  short_url: string;
  thumb: string;
}

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  isSelected: boolean;
  index: number;
  onToggleSelect: (id: string) => void;
  onDoubleClick: (wallpaper: Wallpaper) => void;
}

export function WallpaperCard({
  wallpaper,
  isSelected,
  index,
  onToggleSelect,
  onDoubleClick,
}: WallpaperCardProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden transition-all duration-200 group relative",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
        isSelected && "ring-2 ring-primary animate-select-pulse"
      )}
      onClick={() => onToggleSelect(wallpaper.id)}
      onDoubleClick={() => onDoubleClick(wallpaper)}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {wallpaper.thumb && (
          <img
            src={wallpaper.thumb}
            alt={wallpaper.id}
            loading="lazy"
            className={cn(
              "size-full object-cover transition-transform duration-300 group-hover:scale-105",
              loaded ? "animate-fade-in" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
          />
        )}
        {!loaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}
        <div
          className={cn(
            "absolute top-2 left-2 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
          )}
        >
          <Checkbox checked={isSelected} className="pointer-events-none" />
        </div>
      </div>
      <CardContent className="flex items-center justify-between p-2">
        <Badge variant="secondary" className="text-xs">
          {wallpaper.resolution}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {wallpaper.category}
        </Badge>
      </CardContent>
    </Card>
  );
}
