import { useState } from "react";
import { GripVertical, Trash2, Type, List, CheckSquare, Image, Link, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Block {
  id: string;
  type: string;
  content: string;
}

interface BlockEditorProps {
  block: Block;
  onUpdate: (block: Block) => void;
  onDelete: () => void;
}

export function BlockEditor({ block, onUpdate, onDelete }: BlockEditorProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const updateContent = (content: string) => {
    onUpdate({ ...block, content });
  };

  const changeBlockType = (newType: string) => {
    onUpdate({ ...block, type: newType, content: "" });
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "heading":
        return (
          <Input
            type="text"
            placeholder="Heading"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 p-0 h-auto"
          />
        );

      case "text":
        return (
          <Textarea
            placeholder="Start typing..."
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="min-h-0 bg-transparent border-none outline-none resize-none text-gray-700 dark:text-gray-300 p-0"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
        );

      case "todo":
        const todos = block.content ? JSON.parse(block.content) : [];
        return (
          <div className="space-y-2">
            {todos.map((todo: any, index: number) => (
              <div key={todo.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={(checked) => {
                    const updatedTodos = todos.map((t: any, i: number) =>
                      i === index ? { ...t, completed: checked } : t
                    );
                    updateContent(JSON.stringify(updatedTodos));
                  }}
                />
                <Input
                  type="text"
                  value={todo.text}
                  onChange={(e) => {
                    const updatedTodos = todos.map((t: any, i: number) =>
                      i === index ? { ...t, text: e.target.value } : t
                    );
                    updateContent(JSON.stringify(updatedTodos));
                  }}
                  className={`bg-transparent border-none outline-none flex-1 p-0 h-auto ${
                    todo.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newTodo = { id: Date.now().toString(), text: "", completed: false };
                updateContent(JSON.stringify([...todos, newTodo]));
              }}
              className="text-sm text-gray-500 hover:text-gray-700 p-0 h-auto"
            >
              + Add item
            </Button>
          </div>
        );

      default:
        return (
          <div className="text-gray-400 italic">
            Unsupported block type: {block.type}
          </div>
        );
    }
  };

  const blockTypeIcons = {
    text: Type,
    heading: Type,
    todo: CheckSquare,
    list: List,
    image: Image,
    link: Link,
    table: Table,
  };

  return (
    <div
      className="group flex items-start space-x-2 py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex items-center space-x-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-6 w-6 cursor-grab hover:bg-white/10"
        >
          <GripVertical className="h-3 w-3 text-gray-400" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="p-1 h-6 w-6 hover:bg-white/10">
              {(() => {
                const Icon = blockTypeIcons[block.type as keyof typeof blockTypeIcons] ?? Type;
                return <Icon className="h-3 w-3 text-gray-400" />;
              })()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => changeBlockType("text")}>
              <Type className="h-4 w-4 mr-2" />
              Text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeBlockType("heading")}>
              <Type className="h-4 w-4 mr-2" />
              Heading
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeBlockType("todo")}>
              <CheckSquare className="h-4 w-4 mr-2" />
              To-do List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="p-1 h-6 w-6 hover:bg-red-100 hover:text-red-600"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="flex-1">
        {renderBlockContent()}
      </div>
    </div>
  );
}
