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
  const baseClasses = "backdrop-blur-xl border rounded-xl transition-all duration-300";
  
  const variants = {
    default: "bg-white/10 dark:bg-black/20 border-white/20 dark:border-white/10",
    dark: "bg-black/20 border-white/10",
    light: "bg-white/20 border-white/30"
  };

  const hoverClasses = hover 
    ? "hover:bg-white/15 dark:hover:bg-black/25 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-0.5" 
    : "";

  return (
    <div
      className={cn(
        baseClasses,
        variants[variant],
        hoverClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
