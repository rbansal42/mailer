import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { api, type Media } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MediaLibrarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectionMode?: boolean;
  onSelect?: (url: string) => void;
}

export function MediaLibrarySidebar({
  isOpen,
  onClose,
  selectionMode,
  onSelect,
}: MediaLibrarySidebarProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [deletedMedia, setDeletedMedia] = useState<Media[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("library");

  const fetchMedia = async () => {
    const [active, deleted] = await Promise.all([
      api.getMedia(false),
      api.getMedia(true),
    ]);
    setMedia(active);
    setDeletedMedia(deleted);
  };

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen]);

  const handleUploadComplete = async (data: { key: string; url: string; name: string; size: number }) => {
    await api.createMedia({
      uploadthing_key: data.key,
      url: data.url,
      filename: data.name,
      size_bytes: data.size,
    });
    fetchMedia();
  };

  const handleDelete = async (id: string) => {
    await api.deleteMedia(id);
    fetchMedia();
  };

  const handleRestore = async (id: string) => {
    await api.restoreMedia(id);
    fetchMedia();
  };

  const handleUpdate = async (id: string, data: { filename?: string; alt_text?: string }) => {
    await api.updateMedia(id, data);
    fetchMedia();
  };

  const handleGetUsage = async (id: string) => {
    return api.getMediaUsage(id);
  };

  const filteredMedia = media.filter(
    (m) =>
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeletedMedia = deletedMedia.filter(
    (m) =>
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-background border-l shadow-lg transform transition-transform duration-200 z-50",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Media Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Uploader */}
        <div className="p-4 border-b">
          <MediaUploader onUploadComplete={handleUploadComplete} />
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="library" className="flex-1">
              Library ({media.length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex-1">
              Deleted ({deletedMedia.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-4">
            <TabsContent value="library" className="mt-0">
              <MediaGrid
                media={filteredMedia}
                selectionMode={selectionMode}
                onSelect={onSelect}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onGetUsage={handleGetUsage}
              />
            </TabsContent>
            <TabsContent value="deleted" className="mt-0">
              <MediaGrid
                media={filteredDeletedMedia}
                isDeleted
                onRestore={handleRestore}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
