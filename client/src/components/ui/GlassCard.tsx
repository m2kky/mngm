import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "dark" | "light";
  hover?: boolean;
}

export function GlassCard({
  children,
  className,
  variant = "default",
  hover = true,
  ...props
}: GlassCardProps) {
  const baseClasses = "border border-border rounded-xl shadow-sm transition-all duration-200";

  const variants = {
    default: "bg-card text-card-foreground",
    dark: "bg-muted text-card-foreground",
    light: "bg-background text-card-foreground",
  };

  const hoverClasses = hover ? "hover:shadow-md" : "";

  return (
    <div
      className={cn(baseClasses, variants[variant], hoverClasses, className)}
      {...props}
    >
      {children}
    </div>
  );
}
