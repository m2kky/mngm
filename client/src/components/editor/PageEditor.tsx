import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Save, Loader2, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "./BlockEditor";
import { useToast } from "@/hooks/use-toast";
import type { Page } from "@shared/schema";

interface Block {
  id: string;
  type: string;
  content: string;
}

interface PageEditorProps {
  page: Page;
  agencyId: string;
}

export function PageEditor({ page, agencyId }: PageEditorProps) {
  const { toast } = useToast();
  const initialBlocks = Array.isArray(page.content) ? (page.content as Block[]) : [];

  const [title, setTitle] = useState(page.title ?? "Untitled");
  const [blocks, setBlocks] = useState<Block[]>(
    initialBlocks.length > 0
      ? initialBlocks
      : [{ id: Date.now().toString(), type: "text", content: "" }]
  );
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; content: Block[] }) =>
      apiRequest("PUT", `/api/pages/${page.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", agencyId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      toast({ title: "Failed to save page", variant: "destructive" });
    },
  });

  const triggerAutoSave = useCallback(
    (newTitle: string, newBlocks: Block[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate({ title: newTitle, content: newBlocks });
      }, 1000);
    },
    [saveMutation]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave(val, blocks);
  };

  const handleBlockUpdate = (updatedBlock: Block) => {
    const newBlocks = blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b));
    setBlocks(newBlocks);
    triggerAutoSave(title, newBlocks);
  };

  const handleBlockDelete = (id: string) => {
    const newBlocks = blocks.filter((b) => b.id !== id);
    setBlocks(newBlocks);
    triggerAutoSave(title, newBlocks);
  };

  const addBlock = (type: string = "text") => {
    const newBlock: Block = { id: Date.now().toString(), type, content: "" };
    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    triggerAutoSave(title, newBlocks);
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveMutation.mutate({ title, content: blocks });
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving…</span>
              </>
            ) : saved ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Saved</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addBlock("text")}
              className="hover:bg-white/10"
              title="Add block"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualSave}
              disabled={saveMutation.isPending}
              className="hover:bg-white/10"
              title="Save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-indigo-400 transition-colors duration-200">
          <div className="mb-6">
            <Input
              type="text"
              placeholder="Untitled"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-3xl font-bold bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="space-y-4">
            {blocks.map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                onUpdate={handleBlockUpdate}
                onDelete={() => handleBlockDelete(block.id)}
              />
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 bg-transparent"
            onClick={() => addBlock("text")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add a block
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
