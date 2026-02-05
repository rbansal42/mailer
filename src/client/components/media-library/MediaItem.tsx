import { useState } from "react";
import { Check, Pencil, Trash2, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Media, MediaUsage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MediaItemProps {
  media: Media;
  isDeleted?: boolean;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onUpdate?: (data: { filename?: string; alt_text?: string }) => Promise<void>;
  onGetUsage?: () => Promise<MediaUsage[]>;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaItem({
  media,
  isDeleted,
  selectionMode,
  onSelect,
  onDelete,
  onRestore,
  onUpdate,
  onGetUsage,
}: MediaItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editFilename, setEditFilename] = useState(media.filename);
  const [editAltText, setEditAltText] = useState(media.alt_text);
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;
    setIsSaving(true);
    try {
      await onUpdate({
        filename: editFilename,
        alt_text: editAltText,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowUsage = async () => {
    if (!onGetUsage) return;
    const data = await onGetUsage();
    setUsage(data);
    setShowUsage(true);
  };

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg border bg-card overflow-hidden",
          selectionMode && "cursor-pointer hover:ring-2 hover:ring-primary"
        )}
        onClick={() => selectionMode && onSelect?.(media.url)}
      >
        <div className="aspect-square bg-muted">
          <img
            src={media.url}
            alt={media.alt_text || media.filename}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate">{media.filename}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(media.size_bytes)}
          </p>
        </div>

        {/* Action overlay */}
        {!selectionMode && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {isDeleted ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="secondary" onClick={(e) => { e.stopPropagation(); onRestore?.(); }}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleShowUsage(); }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Where used</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}

        {/* Selection indicator */}
        {selectionMode && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
            <div className="bg-primary text-primary-foreground rounded-full p-1">
              <Check className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={media.url}
                alt={media.alt_text || media.filename}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alt_text">Alt Text</Label>
              <Input
                id="alt_text"
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder="Describe this image..."
              />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={showUsage} onOpenChange={setShowUsage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Where Used</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {usage?.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This image is not used in any templates.
              </p>
            ) : (
              <ul className="space-y-1">
                {usage?.map((t) => (
                  <li key={t.id} className="text-sm">
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
