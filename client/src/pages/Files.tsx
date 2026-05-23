import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { useDetailPanel } from "@/components/detail/DetailPanel";
import {
  Upload, File, FileImage, FileText, FileArchive, Trash2,
  Download, FolderOpen, Search, LayoutList, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface FileAsset {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  folder: string | null;
  projectId: string | null;
  createdAt: string;
  uploadedById: string | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={cn("text-blue-500", className)} />;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/")) return <FileText className={cn("text-red-500", className)} />;
  if (mimeType.includes("zip") || mimeType.includes("rar")) return <FileArchive className={cn("text-yellow-500", className)} />;
  return <File className={cn("text-gray-500", className)} />;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Files() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileView, setFileView] = useState<"list" | "grid">("list");
  const { open: openDetail } = useDetailPanel();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#upload") return;
    fileInputRef.current?.click();
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const { data: files = [], isLoading } = useQuery<FileAsset[]>({
    queryKey: ["/api/files"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File deleted" });
    },
    onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
  });

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(fileList)) {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: `${file.name} is too large (max 50 MB)`, variant: "destructive" });
        continue;
      }
      try {
        const content = await fileToBase64(file);
        await apiRequest("POST", "/api/files/upload", {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          content,
        });
        successCount++;
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }
    if (successCount > 0) {
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: `${successCount} file${successCount > 1 ? "s" : ""} uploaded` });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filtered = files.filter(f =>
    f.fileName.toLowerCase().includes(search.toLowerCase())
  );

  const totalSize = files.reduce((s, f) => s + f.fileSize, 0);

  const viewToggle = (
    <div className="flex items-center rounded-md border border-border/60 overflow-hidden h-8 shrink-0">
      <button
        onClick={() => setFileView("list")}
        title="List view"
        data-testid="button-files-list-view"
        className={cn(
          "px-2.5 h-full flex items-center transition-colors",
          fileView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
        )}
      >
        <LayoutList className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setFileView("grid")}
        title="Grid view"
        data-testid="button-files-grid-view"
        className={cn(
          "px-2.5 h-full flex items-center transition-colors",
          fileView === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <PageShell
      breadcrumbs={[{ label: "Work" }, { label: "Files" }]}
      title="Files"
      description={`${files.length} file${files.length !== 1 ? "s" : ""} · ${formatBytes(totalSize)} used`}
      primaryAction={
        <>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
            data-testid="button-upload-files"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload Files"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => uploadFiles(e.target.files)}
          />
        </>
      }
    >
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Drop zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
          )}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={cn("h-8 w-8 mx-auto mb-2", dragOver ? "text-primary" : "text-muted-foreground")} />
          <p className="text-sm font-medium">{dragOver ? "Drop to upload" : "Drop files here or click to browse"}</p>
          <p className="text-xs text-muted-foreground mt-1">Max 50 MB per file</p>
        </div>

        {/* Search + view toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {viewToggle}
        </div>

        {/* File list / grid */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading files…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {search ? "No files match your search" : "No files yet. Upload your first file above."}
            </p>
          </div>
        ) : fileView === "grid" ? (
          /* ── Grid view ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(file => (
              <div
                key={file.id}
                className="group relative rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col items-center gap-2 p-4"
                onClick={() => openDetail("file", file.id)}
                data-testid={`file-grid-${file.id}`}
              >
                {/* Preview or icon */}
                {file.mimeType.startsWith("image/") ? (
                  <img
                    src={file.fileUrl}
                    alt={file.fileName}
                    className="h-16 w-full rounded-lg object-cover bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-16 w-full rounded-lg bg-muted/50 flex items-center justify-center">
                    <FileIcon mimeType={file.mimeType} className="h-8 w-8" />
                  </div>
                )}
                <p className="text-xs font-medium text-center truncate w-full">{file.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(file.fileSize)}</p>

                {/* Hover actions */}
                <div
                  className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                  onClick={e => e.stopPropagation()}
                >
                  <Button variant="secondary" size="icon" className="h-7 w-7" asChild>
                    <a href={file.fileUrl} download={file.fileName} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(file.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div className="grid gap-2">
            <div className="hidden sm:grid grid-cols-[2rem_1fr_6rem_8rem_7rem] gap-4 px-4 text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <span />
              <span>Name</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span />
            </div>

            {filtered.map(file => (
              <Card
                key={file.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => openDetail("file", file.id)}
                data-testid={`file-row-${file.id}`}
              >
                <CardContent className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4" onClick={() => openDetail("file", file.id)}>
                    <FileIcon mimeType={file.mimeType} className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{formatBytes(file.fileSize)} · {formatDate(file.createdAt)}</p>
                    </div>
                    <span className="hidden sm:block text-sm text-muted-foreground w-16 flex-shrink-0">{formatBytes(file.fileSize)}</span>
                    <span className="hidden sm:block text-sm text-muted-foreground w-24 flex-shrink-0">{formatDate(file.createdAt)}</span>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                        <a href={file.fileUrl} download={file.fileName} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(file.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
