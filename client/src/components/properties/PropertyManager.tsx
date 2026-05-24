import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Settings2, GripVertical, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CustomProperty } from "@shared/schema";

const PROPERTY_TYPES = [
  { value: "TEXT", label: "Text (Short)" },
  { value: "LONG_TEXT", label: "Text (Paragraph)" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select (Single)" },
  { value: "MULTI_SELECT", label: "Multi-select" },
  { value: "USER", label: "Person" },
  { value: "URL", label: "URL/Link" },
  { value: "CHECKBOX", label: "Checkbox (Yes/No)" },
];

const COLORS = [
  { value: "slate", label: "Slate", hex: "#64748b" },
  { value: "red", label: "Red", hex: "#ef4444" },
  { value: "orange", label: "Orange", hex: "#f97316" },
  { value: "amber", label: "Amber", hex: "#f59e0b" },
  { value: "green", label: "Green", hex: "#22c55e" },
  { value: "blue", label: "Blue", hex: "#3b82f6" },
  { value: "purple", label: "Purple", hex: "#a855f7" },
  { value: "pink", label: "Pink", hex: "#ec4899" },
];

export function PropertyManager({ entityType = "TASK" }: { entityType?: "TASK" | "PROJECT" | "CLIENT" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<Partial<CustomProperty> | null>(null);

  const { data: properties = [], isLoading } = useQuery<CustomProperty[]>({
    queryKey: ["/api/custom-properties", { entityType }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/custom-properties?entityType=${entityType}`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CustomProperty>) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/custom-properties/${data.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/custom-properties`, { ...data, entityType });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-properties", { entityType }] });
      toast({ title: "Property saved" });
      setIsEditing(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/custom-properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-properties", { entityType }] });
      toast({ title: "Property deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{entityType} Properties</h3>
          <p className="text-sm text-muted-foreground">Define custom fields for your {entityType.toLowerCase()}s.</p>
        </div>
        <Button onClick={() => setIsEditing({ name: "", type: "TEXT", position: properties.length })}>
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading properties...</div>
        ) : properties.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No properties defined yet. Click "Add Property" to get started.
          </div>
        ) : (
          <div className="divide-y">
            {properties.map((prop) => (
              <div key={prop.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{prop.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">
                      {PROPERTY_TYPES.find(t => t.value === prop.type)?.label || prop.type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setIsEditing(prop)}>
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if(confirm("Delete this property? This will remove it from all tasks.")) deleteMutation.mutate(prop.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!isEditing} onOpenChange={(open) => !open && setIsEditing(null)}>
        {isEditing && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditing.id ? "Edit Property" : "New Property"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Property Name</Label>
                <Input 
                  value={isEditing.name || ""} 
                  onChange={e => setIsEditing({ ...isEditing, name: e.target.value })} 
                  placeholder="e.g., Priority, Department"
                />
              </div>
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select 
                  disabled={!!isEditing.id} // Cannot change type after creation easily
                  value={isEditing.type} 
                  onValueChange={val => setIsEditing({ ...isEditing, type: val as any, options: val === "SELECT" || val === "MULTI_SELECT" ? [] : null })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(isEditing.type === "SELECT" || isEditing.type === "MULTI_SELECT") && (
                <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                  <Label>Options</Label>
                  <OptionsEditor 
                    options={(isEditing.options as any) || []} 
                    onChange={options => setIsEditing({ ...isEditing, options })} 
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(null)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(isEditing)}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: any[], onChange: (opts: any[]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("slate");

  const addOption = () => {
    if(!newLabel.trim()) return;
    onChange([...options, { id: crypto.randomUUID(), label: newLabel, color: newColor }]);
    setNewLabel("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2 justify-between bg-background p-2 rounded border text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.find(c => c.value === opt.color)?.hex }} />
              {opt.label}
            </div>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => onChange(options.filter((_, idx) => idx !== i))}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Input placeholder="New option..." value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-8 text-sm" onKeyDown={e => e.key === "Enter" && addOption()} />
        <Select value={newColor} onValueChange={setNewColor}>
          <SelectTrigger className="w-[100px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COLORS.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  {c.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={addOption} className="h-8 px-2"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
