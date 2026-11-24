import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CirclePlus,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Trash2,
  UnlockKeyhole,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBranches,
  getWarehouses,
} from "@/features/network-org/api/network-org.api";
import type { Branch } from "@/features/network-org/types/network-org.types";
import type { Warehouse } from "@/features/network-org/types/network-org.types";
import {
  createUser,
  deleteUser,
  getCustomers,
  getUsers,
  updateUser,
} from "../api/user-management.api";
import { EmployeeFormDialog } from "../components/EmployeeFormDialog";
import {
  ROLE_LABELS,
  type Customer,
  type EmployeeInput,
  type EmployeeUser,
} from "../types/user-management.types";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }
  return error instanceof Error
    ? error.message
    : "Đã xảy ra lỗi, vui lòng thử lại.";
}

function isEmployeeLocked(employee: EmployeeUser): boolean {
  return employee.status === "suspended";
}

function isEmployeeActive(employee: EmployeeUser): boolean {
  return (
    employee.status === "active" &&
    employee.is_active !== false &&
    employee.is_active !== 0
  );
}

function formatCreditLimit(amount: number | null): string {
  if (amount === null) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchManagementData() {
  const [employees, customers, branches, warehouses] = await Promise.all([
    getUsers(),
    getCustomers(),
    getBranches(),
    getWarehouses(),
  ]);
  return { employees, customers, branches, warehouses };
}

export function UserManagementPage() {
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeUser>();
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeUser>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchManagementData();
      setEmployees(data.employees);
      setCustomers(data.customers);
      setBranches(data.branches);
      setWarehouses(data.warehouses);
    } catch (error) {
      const message = getErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchManagementData()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setEmployees(data.employees);
        setCustomers(data.customers);
        setBranches(data.branches);
        setWarehouses(data.warehouses);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        const message = getErrorMessage(error);
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) {
      return employees;
    }
    return employees.filter((employee) =>
      [
        employee.employee_code,
        employee.full_name,
        employee.email,
        employee.phone_masked,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [employees, search]);

  const branchNames = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );
  const warehouseNames = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );

  async function saveEmployee(
    input: EmployeeInput,
    employee?: EmployeeUser,
  ): Promise<void> {
    const savedEmployee = employee
      ? await updateUser(employee.public_id, {
          ...input,
          ...(input.phone ? {} : { phone: undefined }),
        })
      : await createUser(input);

    setEmployees((current) =>
      employee
        ? current.map((item) =>
            item.public_id === savedEmployee.public_id
              ? savedEmployee
              : item,
          )
        : [savedEmployee, ...current],
    );
    setIsEmployeeDialogOpen(false);
    toast.success(employee ? "Đã cập nhật nhân viên." : "Đã tạo nhân viên.");
  }

  async function toggleEmployeeLock(employee: EmployeeUser): Promise<void> {
    const nextStatus = isEmployeeLocked(employee) ? "active" : "suspended";
    try {
      const updatedEmployee = await updateUser(employee.public_id, {
        status: nextStatus,
        is_active: nextStatus === "active" ? 1 : 0,
      });
      setEmployees((current) =>
        current.map((item) =>
          item.public_id === employee.public_id ? updatedEmployee : item,
        ),
      );
      toast.success(
        nextStatus === "active" ? "Đã mở khóa nhân viên." : "Đã khóa nhân viên.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function confirmDeleteEmployee(): Promise<void> {
    if (!deletingEmployee) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(deletingEmployee.public_id);
      setEmployees((current) =>
        current.filter(
          (employee) => employee.public_id !== deletingEmployee.public_id,
        ),
      );
      setDeletingEmployee(undefined);
      toast.success("Đã xóa nhân viên.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  function editEmployee(employee: EmployeeUser): void {
    setEditingEmployee(employee);
    setIsEmployeeDialogOpen(true);
  }

  function addEmployee(): void {
    setEditingEmployee(undefined);
    setIsEmployeeDialogOpen(true);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Người dùng &amp; phân quyền
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý tài khoản nội bộ, khách hàng, vai trò và phạm vi chi nhánh.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Làm mới
        </Button>
      </header>

      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={isLoading}
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Nhân viên nội bộ</TabsTrigger>
          <TabsTrigger value="customers">Khách hàng</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" aria-hidden="true" />
                Danh sách nhân viên
                <Badge variant="secondary">{employees.length}</Badge>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-full sm:w-64"
                  placeholder="Tìm mã, họ tên, email..."
                  aria-label="Tìm nhân viên"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button onClick={addEmployee}>
                  <CirclePlus className="h-4 w-4" aria-hidden="true" />
                  Thêm nhân viên
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải danh sách...
                </p>
              ) : visibleEmployees.length === 0 ? (
                <EmptyState
                  title="Chưa có nhân viên phù hợp"
                  description="Thêm nhân viên mới hoặc thay đổi từ khóa tìm kiếm."
                  icon={Users}
                  action={
                    <Button onClick={addEmployee}>
                      <CirclePlus className="h-4 w-4" aria-hidden="true" />
                      Thêm nhân viên
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã nhân viên</TableHead>
                      <TableHead>Họ tên / liên hệ</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Phạm vi chi nhánh / kho</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEmployees.map((employee) => {
                      const locked = isEmployeeLocked(employee);
                      return (
                        <TableRow key={employee.public_id}>
                          <TableCell className="font-medium">
                            {employee.employee_code}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{employee.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {employee.email} · {employee.phone_masked}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-56 flex-wrap gap-1">
                              {employee.user_has_roles.map((role) => (
                                <Badge key={role} variant="outline">
                                  {ROLE_LABELS[role] ?? role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              {employee.user_branch_scopes.map((scope, index) => (
                                <div
                                  key={`${scope.branch_id}-${scope.warehouse_id}-${index}`}
                                  className="flex items-start gap-1.5"
                                >
                                  <Building2
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {scope.warehouse_id
                                      ? warehouseNames.get(scope.warehouse_id) ??
                                        "Kho"
                                      : branchNames.get(scope.branch_id ?? -1) ??
                                        "Chi nhánh"}
                                    <span className="block text-muted-foreground">
                                      {[
                                        scope.can_view && "Xem",
                                        scope.can_operate && "Vận hành",
                                        scope.can_approve && "Duyệt",
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "Chưa gán quyền"}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isEmployeeActive(employee) ? "secondary" : "outline"}
                              className={
                                isEmployeeActive(employee)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : locked
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-slate-200 bg-slate-100 text-slate-700"
                              }
                            >
                              {isEmployeeActive(employee)
                                ? "Đang hoạt động"
                                : locked
                                  ? "Đã khóa"
                                  : "Ngưng hoạt động"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Sửa và phân quyền nhân viên"
                                onClick={() => editEmployee(employee)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void toggleEmployeeLock(employee)}
                              >
                                {locked ? (
                                  <UnlockKeyhole
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <LockKeyhole
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                )}
                                {locked ? "Mở khóa" : "Khóa"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Xóa nhân viên"
                                onClick={() => setDeletingEmployee(employee)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" aria-hidden="true" />
                Danh sách khách hàng
                <Badge variant="secondary">{customers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải danh sách...
                </p>
              ) : customers.length === 0 ? (
                <EmptyState
                  title="Chưa có khách hàng"
                  description="Khách hàng được quản lý từ dữ liệu tài khoản trên hệ thống."
                  icon={Users}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã khách hàng</TableHead>
                      <TableHead>Khách hàng / liên hệ</TableHead>
                      <TableHead>Phân loại</TableHead>
                      <TableHead>Doanh nghiệp / MST</TableHead>
                      <TableHead className="text-right">
                        Hạn mức công nợ
                      </TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => {
                      const isCorporate =
                        customer.customer_type === "corporate_postpaid";
                      return (
                        <TableRow key={customer.public_id}>
                          <TableCell className="font-medium">
                            {customer.customer_code}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{customer.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {customer.email} · {customer.phone_masked}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isCorporate ? "default" : "secondary"}>
                              {isCorporate
                                ? "Doanh nghiệp trả sau"
                                : "Cá nhân"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isCorporate ? (
                              <>
                                <div>{customer.company_name ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">
                                  MST: {customer.tax_code ?? "—"}
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isCorporate
                              ? formatCreditLimit(customer.credit_limit)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                customer.status === "active"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {customer.status === "active"
                                ? "Đang hoạt động"
                                : customer.status === "suspended"
                                  ? "Đã khóa"
                                  : "Ngưng hoạt động"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog
        open={isEmployeeDialogOpen}
        employee={editingEmployee}
        branches={branches}
        warehouses={warehouses}
        onOpenChange={setIsEmployeeDialogOpen}
        onSave={saveEmployee}
      />
      <ConfirmDialog
        open={Boolean(deletingEmployee)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingEmployee(undefined);
          }
        }}
        title="Xóa nhân viên?"
        description={`Bạn có chắc muốn xóa tài khoản ${deletingEmployee?.full_name ?? ""}? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa nhân viên"
        onConfirm={() => void confirmDeleteEmployee()}
        isLoading={isDeleting}
      />
    </section>
  );
}
