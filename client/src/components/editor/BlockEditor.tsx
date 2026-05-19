import { useState } from "react";
import {
  GripVertical,
  Trash2,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Megaphone,
  Copy,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

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

const BLOCK_TYPES = [
  { type: "text",          label: "Text",           icon: Type },
  { type: "heading1",      label: "Heading 1",      icon: Type },
  { type: "heading2",      label: "Heading 2",      icon: Type },
  { type: "heading3",      label: "Heading 3",      icon: Type },
  { type: "bullet_list",   label: "Bullet List",    icon: List },
  { type: "numbered_list", label: "Numbered List",  icon: ListOrdered },
  { type: "todo",          label: "To-do List",     icon: CheckSquare },
  { type: "code",          label: "Code",           icon: Code },
  { type: "callout",       label: "Callout",        icon: Megaphone },
];

const CALLOUT_COLORS = [
  { value: "blue",   border: "border-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-300" },
  { value: "yellow", border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-300" },
  { value: "green",  border: "border-green-400",  bg: "bg-green-50 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-300" },
  { value: "red",    border: "border-red-400",    bg: "bg-red-50 dark:bg-red-950/40",      text: "text-red-700 dark:text-red-300" },
  { value: "purple", border: "border-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300" },
];

function getCalloutStyle(color: string) {
  return CALLOUT_COLORS.find((c) => c.value === color) ?? CALLOUT_COLORS[0];
}

function parseListItems(content: string): string[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {}
  return content ? content.split("\n") : [""];
}

function parseCallout(content: string): { emoji: string; text: string; color: string } {
  try {
    return JSON.parse(content);
  } catch {}
  return { emoji: "💡", text: content, color: "blue" };
}

function parseTodos(content: string): Array<{ id: string; text: string; completed: boolean }> {
  try {
    return JSON.parse(content);
  } catch {}
  return [];
}

export function BlockEditor({ block, onUpdate, onDelete }: BlockEditorProps) {
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const updateContent = (content: string) => onUpdate({ ...block, content });

  const changeBlockType = (newType: string) => {
    let defaultContent = "";
    if (newType === "bullet_list" || newType === "numbered_list") {
      defaultContent = JSON.stringify([""]);
    } else if (newType === "todo") {
      defaultContent = JSON.stringify([{ id: Date.now().toString(), text: "", completed: false }]);
    } else if (newType === "callout") {
      defaultContent = JSON.stringify({ emoji: "💡", text: "", color: "blue" });
    }
    onUpdate({ ...block, type: newType, content: defaultContent });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(block.content);
    setCodeCopied(true);
    toast({ title: "Code copied to clipboard" });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "heading1":
        return (
          <Input
            type="text"
            placeholder="Heading 1"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="text-3xl font-bold bg-transparent border-none shadow-none outline-none text-gray-800 dark:text-gray-200 p-0 h-auto focus-visible:ring-0"
          />
        );

      case "heading2":
        return (
          <Input
            type="text"
            placeholder="Heading 2"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="text-2xl font-semibold bg-transparent border-none shadow-none outline-none text-gray-800 dark:text-gray-200 p-0 h-auto focus-visible:ring-0"
          />
        );

      case "heading3":
        return (
          <Input
            type="text"
            placeholder="Heading 3"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none shadow-none outline-none text-gray-800 dark:text-gray-200 p-0 h-auto focus-visible:ring-0"
          />
        );

      case "heading":
        return (
          <Input
            type="text"
            placeholder="Heading"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none shadow-none outline-none text-gray-800 dark:text-gray-200 p-0 h-auto focus-visible:ring-0"
          />
        );

      case "text":
        return (
          <Textarea
            placeholder="Start typing…"
            value={block.content}
            onChange={(e) => updateContent(e.target.value)}
            className="min-h-0 bg-transparent border-none shadow-none outline-none resize-none text-gray-700 dark:text-gray-300 p-0 focus-visible:ring-0"
            rows={1}
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
          />
        );

      case "bullet_list": {
        const items = parseListItems(block.content);
        return (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-500 dark:bg-gray-400" />
                <Input
                  type="text"
                  placeholder="List item"
                  value={item}
                  onChange={(e) => {
                    const updated = items.map((it, i) => (i === idx ? e.target.value : it));
                    updateContent(JSON.stringify(updated));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const updated = [...items.slice(0, idx + 1), "", ...items.slice(idx + 1)];
                      updateContent(JSON.stringify(updated));
                    }
                    if (e.key === "Backspace" && item === "" && items.length > 1) {
                      e.preventDefault();
                      const updated = items.filter((_, i) => i !== idx);
                      updateContent(JSON.stringify(updated));
                    }
                  }}
                  className="bg-transparent border-none shadow-none outline-none flex-1 p-0 h-auto text-gray-700 dark:text-gray-300 focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (items.length > 1) {
                      updateContent(JSON.stringify(items.filter((_, i) => i !== idx)));
                    }
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-red-500 flex-shrink-0"
                  tabIndex={-1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateContent(JSON.stringify([...items, ""]))}
              className="text-sm text-gray-500 hover:text-gray-700 p-0 h-auto mt-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add item
            </Button>
          </div>
        );
      }

      case "numbered_list": {
        const items = parseListItems(block.content);
        return (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[1.25rem] text-right">
                  {idx + 1}.
                </span>
                <Input
                  type="text"
                  placeholder="List item"
                  value={item}
                  onChange={(e) => {
                    const updated = items.map((it, i) => (i === idx ? e.target.value : it));
                    updateContent(JSON.stringify(updated));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const updated = [...items.slice(0, idx + 1), "", ...items.slice(idx + 1)];
                      updateContent(JSON.stringify(updated));
                    }
                    if (e.key === "Backspace" && item === "" && items.length > 1) {
                      e.preventDefault();
                      const updated = items.filter((_, i) => i !== idx);
                      updateContent(JSON.stringify(updated));
                    }
                  }}
                  className="bg-transparent border-none shadow-none outline-none flex-1 p-0 h-auto text-gray-700 dark:text-gray-300 focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (items.length > 1) {
                      updateContent(JSON.stringify(items.filter((_, i) => i !== idx)));
                    }
                  }}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-red-500 flex-shrink-0"
                  tabIndex={-1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateContent(JSON.stringify([...items, ""]))}
              className="text-sm text-gray-500 hover:text-gray-700 p-0 h-auto mt-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add item
            </Button>
          </div>
        );
      }

      case "todo": {
        const todos = parseTodos(block.content);
        return (
          <div className="space-y-2">
            {todos.map((todo, index) => (
              <div key={todo.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={(checked) => {
                    const updated = todos.map((t, i) =>
                      i === index ? { ...t, completed: !!checked } : t
                    );
                    updateContent(JSON.stringify(updated));
                  }}
                />
                <Input
                  type="text"
                  value={todo.text}
                  onChange={(e) => {
                    const updated = todos.map((t, i) =>
                      i === index ? { ...t, text: e.target.value } : t
                    );
                    updateContent(JSON.stringify(updated));
                  }}
                  className={`bg-transparent border-none shadow-none outline-none flex-1 p-0 h-auto focus-visible:ring-0 ${
                    todo.completed
                      ? "line-through text-gray-400"
                      : "text-gray-700 dark:text-gray-300"
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
              <Plus className="h-3 w-3 mr-1" />
              Add item
            </Button>
          </div>
        );
      }

      case "code":
        return (
          <div className="relative group/code rounded-md bg-gray-900 dark:bg-black/60 border border-gray-700">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
              <span className="text-xs text-gray-400 font-mono">Code</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCode}
                className="h-6 px-2 text-gray-400 hover:text-gray-100 hover:bg-white/10"
                title="Copy code"
              >
                {codeCopied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <Textarea
              placeholder="// Write your code here…"
              value={block.content}
              onChange={(e) => updateContent(e.target.value)}
              className="min-h-[80px] bg-transparent border-none shadow-none outline-none resize-none font-mono text-sm text-green-400 dark:text-green-300 p-3 focus-visible:ring-0"
              spellCheck={false}
            />
          </div>
        );

      case "callout": {
        const callout = parseCallout(block.content);
        const style = getCalloutStyle(callout.color);
        return (
          <div className={`flex gap-3 rounded-md border-l-4 ${style.border} ${style.bg} p-3`}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span
                className="text-lg cursor-pointer select-none"
                title="Click to change emoji"
                onClick={() => {
                  const emojis = ["💡", "⚠️", "✅", "❌", "📌", "🔥", "💬", "📝", "🚀", "⭐"];
                  const current = emojis.indexOf(callout.emoji);
                  const next = emojis[(current + 1) % emojis.length];
                  updateContent(JSON.stringify({ ...callout, emoji: next }));
                }}
              >
                {callout.emoji}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`h-3 w-3 rounded-full border border-current ${style.text} opacity-60 hover:opacity-100`}
                    title="Change color"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  <DropdownMenuLabel className="text-xs">Color</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {CALLOUT_COLORS.map((c) => (
                    <DropdownMenuItem
                      key={c.value}
                      onClick={() => updateContent(JSON.stringify({ ...callout, color: c.value }))}
                      className="capitalize gap-2"
                    >
                      <span className={`h-3 w-3 rounded-full border-2 ${c.border}`} />
                      {c.value}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              placeholder="Add a callout note…"
              value={callout.text}
              onChange={(e) =>
                updateContent(JSON.stringify({ ...callout, text: e.target.value }))
              }
              className={`min-h-0 bg-transparent border-none shadow-none outline-none resize-none flex-1 p-0 text-sm focus-visible:ring-0 ${style.text}`}
              rows={1}
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = t.scrollHeight + "px";
              }}
            />
          </div>
        );
      }

      default:
        return (
          <div className="text-gray-400 italic text-sm">
            Unsupported block type: {block.type}
          </div>
        );
    }
  };

  const currentTypeDef = BLOCK_TYPES.find((b) => b.type === block.type);
  const CurrentIcon = currentTypeDef?.icon ?? Type;

  return (
    <div
      className="group flex items-start space-x-2 py-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center space-x-1 pt-1 transition-opacity ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-6 w-6 cursor-grab hover:bg-white/10"
        >
          <GripVertical className="h-3 w-3 text-gray-400" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 hover:bg-white/10"
              title="Change block type"
            >
              <CurrentIcon className="h-3 w-3 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-gray-500">Block type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <DropdownMenuItem
                key={type}
                onClick={() => changeBlockType(type)}
                className={block.type === type ? "bg-accent" : ""}
              >
                <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="p-1 h-6 w-6 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 min-w-0">{renderBlockContent()}</div>
    </div>
  );
}
