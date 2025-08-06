import { useState } from "react";
import { Plus, Share, Save, MoreHorizontal } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "./BlockEditor";

export function PageEditor() {
  const [title, setTitle] = useState("Marketing Campaign Strategy");
  const [blocks, setBlocks] = useState([
    {
      id: "1",
      type: "text",
      content: "Our Q4 marketing campaign needs to focus on digital transformation and customer experience. We'll be targeting enterprise clients with a multi-channel approach."
    },
    {
      id: "2", 
      type: "heading",
      content: "Key Objectives"
    },
    {
      id: "3",
      type: "todo",
      content: JSON.stringify([
        { id: "1", text: "Define target audience segments", completed: true },
        { id: "2", text: "Create content calendar", completed: false },
        { id: "3", text: "Design landing page mockups", completed: false }
      ])
    }
  ]);

  const addBlock = (type: string) => {
    const newBlock = {
      id: Date.now().toString(),
      type,
      content: ""
    };
    setBlocks([...blocks, newBlock]);
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Page Editor
        </h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => addBlock("text")}
            className="hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-white/10">
            <Share className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-white/10">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-white/10">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-indigo-400 transition-colors duration-200">
        {/* Page Title */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Untitled Page"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 p-0 h-auto"
          />
        </div>

        {/* Blocks */}
        <div className="space-y-4">
          {blocks.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              onUpdate={(updatedBlock) => {
                setBlocks(blocks.map(b => b.id === block.id ? updatedBlock : b));
              }}
              onDelete={() => {
                setBlocks(blocks.filter(b => b.id !== block.id));
              }}
            />
          ))}
        </div>

        {/* Add Block Button */}
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
  );
}
