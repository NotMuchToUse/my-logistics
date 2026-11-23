import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Icon
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Khung chức năng sẵn sàng</p>
            <p className="text-sm text-muted-foreground">
              Giao diện nghiệp vụ sẽ được phát triển riêng trong feature này.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              className={`h-10 ${index === 4 ? "w-2/3" : "w-full"}`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
