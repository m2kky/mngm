// @ts-nocheck
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useDetailPanel } from "@/components/detail/DetailPanel";

interface MentionRendererProps {
  content: string;
}

const mentionRegex = /@\[([^\]]+)\]\(([^:]+):([^)]+)\)|#\[([^\]]+)\]\(([^:]+):([^)]+)\)/g;

export function MentionRenderer({ content }: MentionRendererProps) {
  const { open } = useDetailPanel();

  if (!content) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const start = match.index;
    
    // Add text before the mention
    if (start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex, start)}</span>);
    }

    const isUser = match[0].startsWith("@");
    const display = isUser ? match[1] : match[4];
    const type = isUser ? match[2] : match[5]; // "user", "task", "project"
    const id = isUser ? match[3] : match[6];

    const isTask = type === "task" || type === "project";
    const bgClass = isUser ? "bg-blue-500/10 hover:bg-blue-500/20" : "bg-emerald-500/10 hover:bg-emerald-500/20";
    const textClass = isUser ? "text-blue-500" : "text-emerald-500";

    parts.push(
      <Badge
        key={`mention-${start}`}
        variant="secondary"
        className={`mx-0.5 px-1.5 py-0 h-5 inline-flex items-center text-[13px] font-medium cursor-pointer transition-colors ${bgClass} ${textClass}`}
        onClick={(e) => {
          e.stopPropagation(); // prevent clicking the parent message/container
          if (type === "task") open({ kind: "task", id });
          else if (type === "project") open({ kind: "project", id });
          // User profile sheet is not implemented yet, so we ignore clicks on users for now
        }}
      >
        {isUser ? "@" : "#"}{display}
      </Badge>
    );

    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  // If no mentions found, render normal string to avoid wrapping spans unnecessarily
  if (parts.length === 0) {
    return <>{content}</>;
  }

  return <>{parts}</>;
}
