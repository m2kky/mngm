import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

export default function Pages() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

  const agencyId = currentUser?.agencyId;

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["/api/pages", agencyId],
    enabled: !!agencyId,
  });

  useEffect(() => {
    if (selectedPageId === null && pages.length > 0) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  const createPageMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/pages", {
        title: "Untitled",
        content: [],
        agencyId,
        createdById: currentUser?.id,
      }),
    onSuccess: async (res) => {
      const page = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] });
      setSelectedPageId(page.id);
    },
    onError: () => {
      toast({ title: "Failed to create page", variant: "destructive" });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] });
      if (deletingPageId === selectedPageId) {
        setSelectedPageId(null);
      }
      setDeletingPageId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete page", variant: "destructive" });
      setDeletingPageId(null);
    },
  });

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;

  const formatDate = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Pages</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/10"
            onClick={() => createPageMutation.mutate()}
            disabled={createPageMutation.isPending || !agencyId}
            title="New page"
          >
            {createPageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : pages.length === 0 ? (
            <div className="py-8 px-3 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No pages yet</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-indigo-500 hover:text-indigo-600"
                onClick={() => createPageMutation.mutate()}
                disabled={!agencyId}
              >
                Create your first page
              </Button>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {pages.map((page) => (
                <li key={page.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group cursor-pointer ${
                      selectedPageId === page.id
                        ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-white/10"
                    }`}
                    onClick={() => setSelectedPageId(page.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedPageId(page.id)}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="flex-1 truncate">{page.title || "Untitled"}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden group-hover:block">
                      {formatDate(page.updatedAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-5 w-5 p-0 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPageId(page.id);
                      }}
                      title="Delete page"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
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
            <Button
              onClick={() => createPageMutation.mutate()}
              disabled={createPageMutation.isPending || !agencyId}
              className="gap-2"
            >
              {createPageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Page
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingPageId} onOpenChange={(open) => !open && setDeletingPageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the page and all its content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPageId && deletePageMutation.mutate(deletingPageId)}
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
