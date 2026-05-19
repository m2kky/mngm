import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, File, FileImage, FileText, FileArchive, Trash2, Download, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {files.length} file{files.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} used
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
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
      </div>

      {/* Drop zone + search */}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading files…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            {search ? "No files match your search" : "No files yet. Upload your first file above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[2rem_1fr_6rem_8rem_7rem] gap-4 px-4 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <span />
            <span>Name</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span />
          </div>

          {filtered.map(file => (
            <Card key={file.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <FileIcon mimeType={file.mimeType} className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{formatBytes(file.fileSize)} · {formatDate(file.createdAt)}</p>
                  </div>
                  <span className="hidden sm:block text-sm text-muted-foreground w-16 flex-shrink-0">{formatBytes(file.fileSize)}</span>
                  <span className="hidden sm:block text-sm text-muted-foreground w-24 flex-shrink-0">{formatDate(file.createdAt)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      asChild
                    >
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
  );
}
