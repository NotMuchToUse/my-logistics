import { Search } from "lucide-react";
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
import { EmptyState } from "@/components/shared/EmptyState";
import type { ReactNode } from "react";

export interface CatalogColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
}

interface CatalogTableProps<T> {
  rows: T[];
  columns: CatalogColumn<T>[];
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  totalPages: number;
  canManage: boolean;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  onRetry: () => void;
}

export function CatalogTable<T extends { id: number }>({
  rows,
  columns,
  loading,
  error,
  search,
  page,
  totalPages,
  canManage,
  onSearch,
  onPageChange,
  onAdd,
  onEdit,
  onDelete,
  onRetry,
}: CatalogTableProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm theo mã hoặc tên..."
          />
        </div>
        {canManage ? (
          <Button type="button" onClick={onAdd}>Thêm mới</Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Đang tải danh mục">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Không tải được dữ liệu"
          description={error}
          action={<Button type="button" variant="outline" onClick={onRetry}>Thử lại</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu"
          description="Không có bản ghi nào phù hợp bộ lọc hiện tại."
          action={canManage ? <Button type="button" onClick={onAdd}>Thêm mới</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={column.align === "right" ? "text-right" : undefined}
                >
                  {column.label}
                </TableHead>
              ))}
              {canManage ? <TableHead className="text-right">Thao tác</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={column.align === "right" ? "text-right tabular-nums" : undefined}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
                {canManage ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row)}>Sửa</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(row)}>Xóa mềm</Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Trang {page} / {totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Trước
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
