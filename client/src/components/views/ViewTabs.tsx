import { useState } from "react";
import { Plus, Settings2, Trash2, Edit2, Kanban, LayoutList, Table2, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { View, CustomProperty } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { randomUUID } from "crypto";

interface ViewTabsProps {
  views: View[];
  activeViewId: string | null;
  onViewChange: (viewId: string) => void;
  entityType: "TASK" | "PROJECT" | "CLIENT";
  customProperties?: CustomProperty[];
  agencyId: string;
}

export function ViewTabs({ views, activeViewId, onViewChange, entityType, customProperties = [], agencyId }: ViewTabsProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const createView = useMutation({
    mutationFn: async (partialView: Partial<View>) => {
      const res = await apiRequest("POST", "/api/views", {
        ...partialView,
        entityType,
        agencyId,
      });
      return res.json();
    },
    onSuccess: (newView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/views", { entityType }] });
      onViewChange(newView.id);
    },
  });

  const updateView = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<View> }) => {
      const res = await apiRequest("PUT", `/api/views/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/views", { entityType }] });
      setEditingId(null);
    },
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/views/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/views", { entityType }] });
      if (activeViewId === deletedId && views.length > 1) {
        const nextView = views.find((v) => v.id !== deletedId);
        if (nextView) onViewChange(nextView.id);
      }
    },
  });

  const handleAddView = (type: "BOARD" | "LIST" | "TABLE", name: string) => {
    createView.mutate({
      name,
      type,
      config: { groupBy: "stageId" },
    });
  };

  const activeView = views.find(v => v.id === activeViewId) || views[0];

  const getIcon = (type: string) => {
    switch (type) {
      case "BOARD": return <Kanban className="w-3.5 h-3.5" />;
      case "LIST": return <LayoutList className="w-3.5 h-3.5" />;
      case "TABLE": return <Table2 className="w-3.5 h-3.5" />;
      default: return <LayoutDashboard className="w-3.5 h-3.5" />;
    }
  };

  // Build group by options
  const groupByOptions = [
    { value: "stageId", label: "Stage" },
    { value: "assigneeId", label: "Assignee" },
    { value: "priority", label: "Priority" },
    { value: "clientId", label: "Client" },
    ...customProperties
      .filter((p) => p.type === "SELECT" || p.type === "MULTI_SELECT" || p.type === "USER" || p.type === "CHECKBOX")
      .map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex items-center gap-1 border-b px-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50">
      {views.map((view) => (
        <div
          key={view.id}
          className={`group flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-sm font-medium cursor-pointer transition-colors ${
            activeViewId === view.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-slate-800 dark:hover:text-slate-300 hover:border-slate-300"
          }`}
          onClick={() => onViewChange(view.id)}
        >
          {getIcon(view.type)}
          
          {editingId === view.id ? (
            <Input
              autoFocus
              className="h-6 w-32 px-1 py-0 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateView.mutate({ id: view.id, data: { name: editName } });
                } else if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
              onBlur={() => {
                if (editName !== view.name) {
                  updateView.mutate({ id: view.id, data: { name: editName } });
                } else {
                  setEditingId(null);
                }
              }}
            />
          ) : (
            <span>{view.name}</span>
          )}

          {activeViewId === view.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Settings2 className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditName(view.name);
                    setEditingId(view.id);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" /> Rename
                </DropdownMenuItem>

                {view.type === "BOARD" && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Kanban className="w-4 h-4 mr-2" /> Group by
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={view.config.groupBy || "stageId"}
                        onValueChange={(val) => {
                          updateView.mutate({
                            id: view.id,
                            data: { config: { ...view.config, groupBy: val } },
                          });
                        }}
                      >
                        {groupByOptions.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (views.length > 1) deleteView.mutate(view.id);
                  }}
                  disabled={views.length === 1}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2 text-muted-foreground hover:text-slate-800">
            <Plus className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Add View
          </div>
          <DropdownMenuItem onClick={() => handleAddView("BOARD", "Board View")}>
            <Kanban className="w-4 h-4 mr-2" /> Board
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddView("TABLE", "Table View")}>
            <Table2 className="w-4 h-4 mr-2" /> Table
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddView("LIST", "List View")}>
            <LayoutList className="w-4 h-4 mr-2" /> List
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
