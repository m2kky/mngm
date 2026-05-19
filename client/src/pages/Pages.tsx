import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Plus, FileText, Trash2, Loader2, FolderOpen, Folder,
  ChevronRight, ChevronDown, MoreHorizontal, FilePlus, FolderPlus, MoveRight,
} from "lucide-react";
import { PageEditor } from "@/components/editor/PageEditor";
import type { Page } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function Pages() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const agencyId = currentUser?.agencyId;

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["/api/pages", agencyId],
    enabled: !!agencyId,
  });

  useEffect(() => {
    if (selectedPageId === null && pages.length > 0) {
      const first = pages.find(p => !p.isFolder);
      if (first) setSelectedPageId(first.id);
    }
  }, [pages, selectedPageId]);

  const createPage = useMutation({
    mutationFn: (opts: { parentId?: string; isFolder?: boolean }) =>
      apiRequest("POST", "/api/pages", {
        title: opts.isFolder ? "New Folder" : "Untitled",
        content: [],
        agencyId,
        createdById: currentUser?.id,
        parentId: opts.parentId ?? null,
        isFolder: opts.isFolder ?? false,
      }),
    onSuccess: async (res, vars) => {
      const page = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] });
      if (vars.parentId) {
        setExpandedIds(prev => new Set(Array.from(prev).concat(vars.parentId!)));
      }
      if (!vars.isFolder) setSelectedPageId(page.id);
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const movePage = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      apiRequest("PUT", `/api/pages/${id}`, { parentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] }),
    onError: () => toast({ title: "Failed to move page", variant: "destructive" }),
  });

  const deletePage = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] });
      if (deletingPageId === selectedPageId) setSelectedPageId(null);
      setDeletingPageId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
      setDeletingPageId(null);
    },
  });

  const selectedPage = pages.find(p => p.id === selectedPageId && !p.isFolder) ?? null;

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build child map for the tree
  const childrenOf = (parentId: string | null) =>
    pages
      .filter(p => (p.parentId ?? null) === parentId)
      .sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.title.localeCompare(b.title);
      });

  const folders = pages.filter(p => p.isFolder);

  const TreeItem = ({
    page,
    depth,
  }: {
    page: Page;
    depth: number;
  }) => {
    const children = childrenOf(page.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(page.id);
    const isSelected = selectedPageId === page.id;

    return (
      <li>
        <div
          className={`group flex items-center gap-1 rounded-md text-sm transition-colors cursor-pointer pr-1 ${
            isSelected
              ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
              : "text-gray-700 dark:text-gray-300 hover:bg-white/10"
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {/* Expand toggle */}
          <button
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren || page.isFolder) toggleExpanded(page.id);
            }}
          >
            {(hasChildren || page.isFolder) ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-400" />
              )
            ) : (
              <span className="w-3" />
            )}
          </button>

          {/* Icon */}
          {page.isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            )
          ) : (
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          )}

          {/* Title */}
          <span
            className="flex-1 truncate py-1.5 min-w-0"
            onClick={() => {
              if (page.isFolder) {
                toggleExpanded(page.id);
              } else {
                setSelectedPageId(page.id);
              }
            }}
          >
            {page.title || (page.isFolder ? "Untitled Folder" : "Untitled")}
          </span>

          {/* Context menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!page.isFolder && (
                <DropdownMenuItem
                  onClick={() => createPage.mutate({ parentId: page.id })}
                  className="gap-2 text-xs"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                  New sub-page
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => createPage.mutate({ parentId: page.id, isFolder: true })}
                className="gap-2 text-xs"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New sub-folder
              </DropdownMenuItem>

              {/* Move to folder */}
              {folders.filter(f => f.id !== page.id).length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 text-xs">
                    <MoveRight className="h-3.5 w-3.5" />
                    Move to…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {page.parentId && (
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={() => movePage.mutate({ id: page.id, parentId: null })}
                      >
                        Root (no parent)
                      </DropdownMenuItem>
                    )}
                    {folders
                      .filter(f => f.id !== page.id && f.id !== page.parentId)
                      .map(f => (
                        <DropdownMenuItem
                          key={f.id}
                          className="text-xs"
                          onClick={() => {
                            movePage.mutate({ id: page.id, parentId: f.id });
                            setExpandedIds(prev => new Set(Array.from(prev).concat(f.id)));
                          }}
                        >
                          <Folder className="h-3 w-3 mr-1.5 text-amber-400" />
                          {f.title || "Untitled Folder"}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {page.parentId && folders.filter(f => f.id !== page.id).length === 0 && (
                <DropdownMenuItem
                  className="gap-2 text-xs"
                  onClick={() => movePage.mutate({ id: page.id, parentId: null })}
                >
                  <MoveRight className="h-3.5 w-3.5" />
                  Move to root
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs text-red-600 focus:text-red-600"
                onClick={() => setDeletingPageId(page.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <ul>
            {children.map(child => (
              <TreeItem key={child.id} page={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const rootItems = childrenOf(null);

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center gap-1">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex-1 text-sm">Pages</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/10"
            onClick={() => createPage.mutate({ isFolder: true })}
            disabled={!agencyId}
            title="New folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/10"
            onClick={() => createPage.mutate({})}
            disabled={createPage.isPending || !agencyId}
            title="New page"
          >
            {createPage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : pages.length === 0 ? (
            <div className="py-8 px-3 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No pages yet</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-indigo-500 hover:text-indigo-600"
                onClick={() => createPage.mutate({})}
                disabled={!agencyId}
              >
                Create your first page
              </Button>
            </div>
          ) : (
            <ul className="space-y-0">
              {rootItems.map(page => (
                <TreeItem key={page.id} page={page} depth={0} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        {selectedPage ? (
          <PageEditor
            key={selectedPage.id}
            page={selectedPage}
            agencyId={agencyId!}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
            <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600" />
            <div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-1">
                No page selected
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose a page from the sidebar or create a new one.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => createPage.mutate({ isFolder: true })}
                disabled={!agencyId}
                className="gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </Button>
              <Button
                onClick={() => createPage.mutate({})}
                disabled={createPage.isPending || !agencyId}
                className="gap-2"
              >
                {createPage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Page
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingPageId} onOpenChange={(open) => !open && setDeletingPageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pages.find(p => p.id === deletingPageId)?.isFolder
                ? "Delete folder?"
                : "Delete page?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pages.find(p => p.id === deletingPageId)?.isFolder
                ? "All pages inside this folder will be moved to the root. The folder itself will be permanently deleted."
                : "This will permanently delete the page and all its content. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPageId && deletePage.mutate(deletingPageId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
