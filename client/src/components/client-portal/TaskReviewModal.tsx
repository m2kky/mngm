import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

interface TaskReviewModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskReviewModal({ task, isOpen, onClose }: TaskReviewModalProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async ({ outcome }: { outcome: "APPROVED" | "CHANGES_REQUESTED" }) => {
      if (!task) return;
      const res = await apiRequest("POST", `/api/client-portal/tasks/${task.id}/review`, {
        outcome,
        comment
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-portal/tasks"] });
      toast({ title: "Review submitted successfully" });
      setComment("");
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit review", description: error.message, variant: "destructive" });
    }
  });

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review Task</DialogTitle>
          <DialogDescription>
            {task.title}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-md bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description || "No description provided."}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Feedback (Optional)</h4>
            <Textarea 
              placeholder="Add your comments or requested changes here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/50 dark:hover:bg-amber-900/20"
            disabled={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate({ outcome: "CHANGES_REQUESTED" })}
          >
            {reviewMutation.isPending && reviewMutation.variables?.outcome === "CHANGES_REQUESTED" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 mr-2" />
            )}
            Request Changes
          </Button>
          
          <Button 
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate({ outcome: "APPROVED" })}
          >
            {reviewMutation.isPending && reviewMutation.variables?.outcome === "APPROVED" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Approve Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
