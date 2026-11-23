import { cn } from "@/lib/utils";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
