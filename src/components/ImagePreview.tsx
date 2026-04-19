import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Wallpaper } from "./WallpaperCard";

interface ImagePreviewProps {
  wallpaper: Wallpaper | null;
  onClose: () => void;
}

export function ImagePreview({ wallpaper, onClose }: ImagePreviewProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Dialog
      open={!!wallpaper}
      onOpenChange={(open) => {
        if (!open) {
          setLoaded(false);
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden bg-black/95 border-border sm:max-w-4xl"
        showCloseButton
      >
        <div className="relative">
          {!loaded && (
            <Skeleton className="w-full aspect-video rounded-none" />
          )}
          {wallpaper && (
            <img
              src={wallpaper.path}
              alt={wallpaper.id}
              className={`w-full max-h-[80vh] object-contain ${loaded ? "animate-fade-in" : "opacity-0 h-0"}`}
              onLoad={() => setLoaded(true)}
            />
          )}
          {wallpaper && loaded && (
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <Badge>{wallpaper.resolution}</Badge>
                <Badge variant="outline">{wallpaper.category}</Badge>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
