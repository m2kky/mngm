import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatKey, useShortcuts } from "@/lib/shortcuts";

export function ShortcutsHelp() {
  const { shortcuts, isHelpOpen, hideHelp } = useShortcuts();

  const grouped = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  // Stable group order.
  const order: Array<keyof typeof grouped> = ["Global", "Navigation", "Creation", "Layout"];

  return (
    <Dialog open={isHelpOpen} onOpenChange={(o) => !o && hideHelp()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {order
            .filter((g) => grouped[g]?.length)
            .map((g) => (
              <section key={g as string}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {g as string}
                </h4>
                <ul className="space-y-1.5">
                  {grouped[g].map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.label}</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                        {formatKey(s)}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Other
            </h4>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center justify-between">
                <span>Open command palette</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                  ⌘K / Ctrl K
                </kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Close any dialog</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                  Esc
                </kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Show this help</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                  ?
                </kbd>
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
