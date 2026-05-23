import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatInterface } from "@/pages/Chat";

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3 drop-shadow-2xl">
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-[400px] sm:w-[540px] p-0 flex flex-col border-r bg-background shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <MessageCircle className="w-4 h-4" />
              </div>
              <h2 className="font-semibold text-sm">Quick Chat</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface isCompact={true} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
