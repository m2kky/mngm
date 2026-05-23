import { useState, useMemo } from "react";
import { MentionsInput, Mention, SuggestionDataItem } from "react-mentions";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Types matching the DB schema roughly
interface UserRow {
  id: string;
  name: string;
  email: string;
}

interface TaskRow {
  id: string;
  title: string;
}

interface ProjectRow {
  id: string;
  name: string;
}

interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: any) => void;
  placeholder?: string;
  className?: string;
}

export function SmartTextarea({ value, onChange, onKeyDown, placeholder, className }: SmartTextareaProps) {
  const { currentUser } = useAuth();
  const agencyId = currentUser?.agencyId;

  const { data: users = [] } = useQuery<UserRow[]>({
    queryKey: [`/api/agencies/${agencyId}/users`],
    enabled: !!agencyId,
  });

  const { data: tasks = [] } = useQuery<TaskRow[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: projects = [] } = useQuery<ProjectRow[]>({
    queryKey: ["/api/projects"],
  });

  const userSuggestions = useMemo(() => {
    return users.map(u => ({ id: `user:${u.id}`, display: u.name || u.email }));
  }, [users]);

  const hashSuggestions = useMemo(() => {
    const tsks = tasks.map(t => ({ id: `task:${t.id}`, display: t.title }));
    const prjs = projects.map(p => ({ id: `project:${p.id}`, display: p.name }));
    return [...tsks, ...prjs];
  }, [tasks, projects]);

  return (
    <div className={cn("relative w-full", className)}>
      <MentionsInput
        value={value}
        onChange={(e, newValue) => onChange(newValue)}
        onKeyDown={(e) => {
          if (onKeyDown) onKeyDown(e);
        }}
        placeholder={placeholder}
        className="mentions-input"
        style={{
          control: {
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
            fontFamily: 'inherit',
          },
          input: {
            margin: 0,
            border: 0,
            outline: 0,
            padding: 0,
            width: '100%',
            height: '100%',
            overflow: 'auto',
          },
          highlighter: {
            boxSizing: 'border-box',
            overflow: 'hidden',
          },
          suggestions: {
            list: {
              backgroundColor: 'color-mix(in srgb, var(--card) 85%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              fontSize: '0.875rem',
              color: 'var(--foreground)',
              overflowY: 'auto',
              maxHeight: '250px',
              zIndex: 9999,
              bottom: '100%',
              top: 'auto',
              marginBottom: '10px',
            },
            item: {
              padding: '0.625rem 0.875rem',
              borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)',
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
              transition: 'all 0.15s ease',
              '&focused': {
                backgroundColor: 'color-mix(in srgb, var(--accent) 80%, transparent)',
                color: 'var(--accent-foreground)',
              },
            },
          },
        }}
      >
        <Mention
          trigger="@"
          data={userSuggestions}
          markup="@[__display__](__id__)"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: 'rgb(59, 130, 246)',
            borderRadius: '0.25rem',
            padding: '0 0.125rem',
            position: 'relative',
            zIndex: 1,
          }}
          appendSpaceOnAdd
        />
        <Mention
          trigger="#"
          data={hashSuggestions}
          markup="#[__display__](__id__)"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'rgb(16, 185, 129)',
            borderRadius: '0.25rem',
            padding: '0 0.125rem',
            position: 'relative',
            zIndex: 1,
          }}
          appendSpaceOnAdd
        />
      </MentionsInput>
    </div>
  );
}
