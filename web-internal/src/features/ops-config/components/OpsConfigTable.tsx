import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DatabaseId } from "../types/ops-config.types";

export interface OpsConfigColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface OpsConfigTableProps<T extends { id: DatabaseId }> {
  title: string;
  description: string;
  rows: T[];
  columns: OpsConfigColumn<T>[];
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  totalPages: number;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onRetry: () => void;
  filterControls?: ReactNode;
  emptyTitle?: string;
  canEdit?: boolean;
}

export function OpsConfigTable<T extends { id: DatabaseId }>({
  title,
  description,
  rows,
  columns,
  loading,
  error,
  search,
  page,
  totalPages,
  onSearch,
  onPageChange,
  onAdd,
  onEdit,
  onRetry,
  filterControls,
  emptyTitle = "Chưa có dữ liệu",
  canEdit = true,
}: OpsConfigTableProps<T>) {
  return (
    <section className="min-w-0 space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9 text-base sm:text-sm"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm kiếm..."
            aria-label={`Tìm kiếm ${title.toLocaleLowerCase("vi")}`}
          />
        </div>
        {canEdit ? (
          <Button type="button" className="w-full sm:w-auto" onClick={onAdd}>
            Thêm mới
          </Button>
        ) : null}
      </div>

      {filterControls ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {filterControls}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Đang tải dữ liệu">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Không tải được dữ liệu"
          description={error}
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description="Không có bản ghi nào phù hợp bộ lọc hiện tại."
          action={canEdit ? (
            <Button type="button" onClick={onAdd}>
              Thêm mới
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
                {canEdit ? (
                  <TableHead className="text-right">Thao tác</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={column.className}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(row)}
                      >
                        Sửa
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
