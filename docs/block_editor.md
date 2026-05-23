# Notion-Style Block Editor & Document Engine

Workit.OS features a custom Notion-style block editor inside Pages, allowing users to collaborate on rich, interactive documents. Instead of saving raw HTML or Markdown strings, documents are stored as **JSON block arrays**, offering flexibility and easy conversion between block types.

---

## 1. Block Data Structures

A document's content is stored in the database's `pages.content` JSONB column as an array of block objects:

```json
[
  { "id": "block-1", "type": "heading1", "content": "Project Brief" },
  { "id": "block-2", "type": "text", "content": "This document contains style details and tasks." },
  { "id": "block-3", "type": "bullet_list", "content": "[\"Item 1\", \"Item 2\"]" },
  { "id": "block-4", "type": "todo", "content": "[{\"id\":\"todo-1\",\"text\":\"Design mockups\",\"completed\":true}]" }
]
```

### Supported Block Types & Formats

| Block Type (`type`) | Database Content Format (`content`) | Purpose |
| :--- | :--- | :--- |
| **`text`** | Plain String | Standard paragraph block. |
| **`heading1`** | Plain String | Large heading. |
| **`heading2`** | Plain String | Medium heading. |
| **`heading3`** | Plain String | Small heading. |
| **`bullet_list`** | JSON String Array: `["Item A", "Item B"]` | Bulleted list. |
| **`numbered_list`**| JSON String Array: `["Step 1", "Step 2"]` | Ordered list. |
| **`todo`** | JSON Array of objects: `[{"id": "t1", "text": "Task", "completed": false}]` | Interactive to-do lists. |
| **`code`** | String representation of code | Syntactically-colored code containers. |
| **`callout`** | JSON Object: `{"emoji": "💡", "text": "Draft", "color": "blue"}` | Dynamic highlight blocks. |

---

## 2. Editor Core Mechanics

The document system consists of two primary components: `PageEditor.tsx` (the page layout container) and `BlockEditor.tsx` (individual block rendering and editing logic).

```
[PageEditor Container] (Manages State, auto-saving logic, and layouts)
        │
        ├── [BlockEditor] (Standard Text)
        ├── [BlockEditor] (To-Do List)
        └── [BlockEditor] (Callout Card)
```

### A. Debounced Auto-Saving (`PageEditor.tsx`)
Changes made to page titles or individual blocks trigger a debounced saving mechanism:

-   **Immediate State Sync**: Modifying a text block immediately updates the page's React state, keeping the interface highly responsive.
-   **Debounced Save**: An auto-save timeout triggers a `PUT` mutation to `/api/pages/:id` after 1 second of typing inactivity, updating the database in the background.

```typescript
const triggerAutoSave = useCallback(
  (newTitle: string, newBlocks: Block[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveMutation.mutate({ title: newTitle, content: newBlocks });
    }, 1000);
  },
  [saveMutation]
);
```

### B. Block Interactivity & Keyboard Shortcuts (`BlockEditor.tsx`)
List blocks support intuitive keyboard navigation to replicate native document experiences:

*   **List Expansion (Enter)**: Pressing `Enter` inside a list item splits the list, creating a new item below:
    ```typescript
    if (e.key === "Enter") {
      e.preventDefault();
      const updated = [...items.slice(0, idx + 1), "", ...items.slice(idx + 1)];
      updateContent(JSON.stringify(updated));
    }
    ```
*   **Item Deletion (Backspace)**: Pressing `Backspace` on an empty list item deletes the item and focuses the block above:
    ```typescript
    if (e.key === "Backspace" && item === "" && items.length > 1) {
      e.preventDefault();
      const updated = items.filter((_, i) => i !== idx);
      updateContent(JSON.stringify(updated));
    }
    ```

---

## 3. Advanced Block Components

### A. Code Blocks
-   Renders a plain-text code container with code-focused inputs.
-   Features a quick copy button to copy contents directly to the user's clipboard.

### B. Callout Highlight Blocks
-   Displays an alert-style container with a bold emoji icon and a left border matching the callout color.
-   **Interactive Icon Toggles**: Clicking the emoji cycles through default indicator icons: `💡`, `⚠️`, `✅`, `❌`, `📌`, `🔥`, `💬`, `📝`, `🚀`, `⭐`.
-   **Interactive Color Pickers**: Supports selecting preset styling colors (Blue, Yellow, Green, Red, Purple) using dropdown controls:
    ```typescript
    const CALLOUT_COLORS = [
      { value: "blue",   border: "border-blue-400",   bg: "bg-blue-50",   text: "text-blue-700" },
      { value: "yellow", border: "border-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
      { value: "green",  border: "border-green-400",  bg: "bg-green-50",  text: "text-green-700" },
      { value: "red",    border: "border-red-400",    bg: "bg-red-50",    text: "text-red-700" },
      { value: "purple", border: "border-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
    ];
    ```
