import { ImageIcon } from "lucide-react";
import { MediaItem } from "./MediaItem";
import type { Media, MediaUsage } from "@/lib/api";

interface MediaGridProps {
  media: Media[];
  isDeleted?: boolean;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdate?: (id: string, data: { filename?: string; alt_text?: string }) => Promise<void>;
  onGetUsage?: (id: string) => Promise<MediaUsage[]>;
}

export function MediaGrid({
  media,
  isDeleted,
  selectionMode,
  onSelect,
  onDelete,
  onRestore,
  onUpdate,
  onGetUsage,
}: MediaGridProps) {
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">
          {isDeleted ? "No deleted images" : "No images yet"}
        </p>
        {!isDeleted && (
          <p className="text-xs mt-1">Upload your first image above</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {media.map((item) => (
        <MediaItem
          key={item.id}
          media={item}
          isDeleted={isDeleted}
          selectionMode={selectionMode}
          onSelect={onSelect}
          onDelete={() => onDelete?.(item.id)}
          onRestore={() => onRestore?.(item.id)}
          onUpdate={onUpdate ? (data) => onUpdate(item.id, data) : undefined}
          onGetUsage={onGetUsage ? () => onGetUsage(item.id) : undefined}
        />
      ))}
    </div>
  );
}
