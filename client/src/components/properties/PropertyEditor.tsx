import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CustomProperty } from "@shared/schema";

interface PropertyEditorProps {
  property: CustomProperty;
  value: any;
  onChange: (val: any) => void;
  readonly?: boolean;
}

const COLORS: Record<string, string> = {
  slate: "#64748b",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
};

export function PropertyEditor({ property, value, onChange, readonly = false }: PropertyEditorProps) {
  if (readonly) {
    return <PropertyRenderer property={property} value={value} />;
  }

  switch (property.type) {
    case "TEXT":
    case "URL":
      return (
        <Input 
          value={value || ""} 
          onChange={e => onChange(e.target.value)} 
          className="h-8 text-sm"
          placeholder="Empty"
        />
      );
    case "NUMBER":
      return (
        <Input 
          type="number"
          value={value || ""} 
          onChange={e => onChange(e.target.value)} 
          className="h-8 text-sm"
          placeholder="Empty"
        />
      );
    case "CHECKBOX":
      return (
        <div className="flex items-center h-8">
          <Checkbox 
            checked={value === "true" || value === true} 
            onCheckedChange={c => onChange(c ? "true" : "false")} 
          />
        </div>
      );
    case "SELECT": {
      const options = (property.options as any[]) || [];
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Empty" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[opt.color] || COLORS.slate }} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "DATE":
      return (
        <Input 
          type="date"
          value={value || ""} 
          onChange={e => onChange(e.target.value)} 
          className="h-8 text-sm"
        />
      );
    default:
      return (
        <Input 
          value={value || ""} 
          onChange={e => onChange(e.target.value)} 
          className="h-8 text-sm"
        />
      );
  }
}

export function PropertyRenderer({ property, value }: { property: CustomProperty; value: any }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground italic text-xs">Empty</span>;
  }

  switch (property.type) {
    case "SELECT": {
      const options = (property.options as any[]) || [];
      const opt = options.find(o => o.id === value);
      if (!opt) return <span>{value}</span>;
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-muted/50 border">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[opt.color] || COLORS.slate }} />
          {opt.label}
        </div>
      );
    }
    case "URL":
      return <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm">{value}</a>;
    case "CHECKBOX":
      return <span>{value === "true" || value === true ? "Yes" : "No"}</span>;
    default:
      return <span className="text-sm">{value}</span>;
  }
}
