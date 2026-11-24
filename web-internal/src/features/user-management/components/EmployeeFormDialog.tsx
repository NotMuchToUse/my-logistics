import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Branch,
  Warehouse,
} from "@/features/network-org/types/network-org.types";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "../schemas/user-management.schema";
import {
  INTERNAL_ROLE_CODES,
  ROLE_LABELS,
  type EmployeeBranchScope,
  type EmployeeInput,
  type EmployeeUser,
} from "../types/user-management.types";

interface EmployeeFormDialogProps {
  open: boolean;
  employee?: EmployeeUser;
  branches: Branch[];
  warehouses: Warehouse[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: EmployeeInput, employee?: EmployeeUser) => Promise<void>;
}

function getScopeType(
  branch: Branch,
  warehouseId: number | null,
): EmployeeBranchScope["scope_type"] {
  if (warehouseId !== null) {
    return "warehouse";
  }

  switch (branch.branch_type) {
    case "hq":
      return "hq_all";
    case "regional_hub":
      return "region_center";
    case "branch":
      return "branch";
    case "post_office":
      return "post_office";
  }
}

export function EmployeeFormDialog({
  open,
  employee,
  branches,
  warehouses,
  onOpenChange,
  onSave,
}: EmployeeFormDialogProps) {
  const {
    register,
    control,
    setValue,
    setError,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employee_code: "",
      full_name: "",
      email: "",
      phone: "",
      user_has_roles: [],
      user_branch_scopes: [
        {
          branch_id: branches[0]?.id ?? 0,
          warehouse_id: null,
          can_view: true,
          can_operate: false,
          can_approve: false,
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "user_branch_scopes",
  });
  const scopeValues = useWatch({
    control,
    name: "user_branch_scopes",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      employee
        ? {
            employee_code: employee.employee_code,
            full_name: employee.full_name,
            email: employee.email,
            phone: "",
            user_has_roles: employee.user_has_roles,
            user_branch_scopes: employee.user_branch_scopes.map((scope) => ({
              branch_id: scope.branch_id ?? 0,
              warehouse_id: scope.warehouse_id,
              can_view: scope.can_view,
              can_operate: scope.can_operate,
              can_approve: scope.can_approve,
            })),
          }
        : {
            employee_code: "",
            full_name: "",
            email: "",
            phone: "",
            user_has_roles: [],
            user_branch_scopes: [
              {
                branch_id: branches[0]?.id ?? 0,
                warehouse_id: null,
                can_view: true,
                can_operate: false,
                can_approve: false,
              },
            ],
          },
    );
  }, [branches, employee, open, reset]);

  const submit = handleSubmit(async (values) => {
    if (!employee && !values.phone.trim()) {
      setError("phone", { message: "Vui lòng nhập số điện thoại." });
      return;
    }

    try {
      const scopes = values.user_branch_scopes.map((scope) => {
        const branch = branches.find((item) => item.id === scope.branch_id);
        if (!branch) {
          throw new Error("Một phạm vi được chọn không còn tồn tại.");
        }

        const warehouseId = scope.warehouse_id;
        const warehouse =
          warehouseId === null
            ? undefined
            : warehouses.find((item) => item.id === warehouseId);
        if (warehouseId !== null && warehouse?.branch_id !== branch.id) {
          throw new Error("Kho phải trực thuộc chi nhánh đã chọn.");
        }

        return {
          ...scope,
          scope_type: getScopeType(branch, warehouseId),
          branch_id: branch.id,
        };
      });

      await onSave(
        {
          ...values,
          phone: values.phone.trim(),
          user_branch_scopes: scopes,
        },
        employee,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể lưu thông tin nhân viên.",
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {employee ? "Cập nhật nhân viên" : "Thêm nhân viên"}
          </DialogTitle>
          <DialogDescription>
            Gán một hoặc nhiều vai trò và giới hạn quyền theo chi nhánh / kho.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee_code">Mã nhân viên</Label>
              <Input id="employee_code" {...register("employee_code")} />
              {errors.employee_code?.message && (
                <p className="text-sm text-destructive">
                  {errors.employee_code.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Họ và tên</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name?.message && (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email?.message && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                placeholder={
                  employee
                    ? `Để trống để giữ nguyên (${employee.phone_masked})`
                    : "Nhập số điện thoại"
                }
                {...register("phone")}
              />
              {errors.phone?.message && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Vai trò</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {INTERNAL_ROLE_CODES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 rounded-md border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    value={role}
                    className="h-4 w-4 accent-primary"
                    {...register("user_has_roles")}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            {errors.user_has_roles?.message && (
              <p className="text-sm text-destructive">
                {errors.user_has_roles.message}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium">
                Phạm vi chi nhánh / kho
              </legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    branch_id: branches[0]?.id ?? 0,
                    warehouse_id: null,
                    can_view: true,
                    can_operate: false,
                    can_approve: false,
                  })
                }
                disabled={branches.length === 0}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Thêm phạm vi
              </Button>
            </div>

            {fields.map((field, index) => {
              const branchPath = `user_branch_scopes.${index}.branch_id` as const;
              const warehousePath =
                `user_branch_scopes.${index}.warehouse_id` as const;
              const branchId = scopeValues[index]?.branch_id;
              const warehouseId = scopeValues[index]?.warehouse_id;
              const availableWarehouses = warehouses.filter(
                (warehouse) => warehouse.branch_id === branchId,
              );
              const branchRegistration = register(branchPath, {
                setValueAs: (value: string) => Number(value),
              });

              return (
                <div
                  key={field.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`scope-branch-${field.id}`}>
                        Chi nhánh / bưu cục
                      </Label>
                      <select
                        id={`scope-branch-${field.id}`}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        {...branchRegistration}
                        onChange={(event) => {
                          void branchRegistration.onChange(event);
                          setValue(warehousePath, null, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      >
                        <option value="">Chọn chi nhánh / bưu cục</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.code} — {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`scope-warehouse-${field.id}`}>
                        Kho trực thuộc (không bắt buộc)
                      </Label>
                      <select
                        id={`scope-warehouse-${field.id}`}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={warehouseId ?? ""}
                        onChange={(event) =>
                          setValue(
                            warehousePath,
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                        disabled={!branchId || availableWarehouses.length === 0}
                      >
                        <option value="">Toàn chi nhánh / bưu cục</option>
                        {availableWarehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} — {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Xóa phạm vi"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {errors.user_branch_scopes?.[index]?.branch_id?.message && (
                    <p className="text-sm text-destructive">
                      {errors.user_branch_scopes[index]?.branch_id?.message}
                    </p>
                  )}
                  {errors.user_branch_scopes?.[index]?.can_view?.message && (
                    <p className="text-sm text-destructive">
                      {errors.user_branch_scopes[index]?.can_view?.message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {(
                      [
                        ["can_view", "Xem"],
                        ["can_operate", "Vận hành"],
                        ["can_approve", "Duyệt"],
                      ] as const
                    ).map(([permission, label]) => (
                      <label
                        key={permission}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          {...register(
                            `user_branch_scopes.${index}.${permission}`,
                          )}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {errors.user_branch_scopes?.message && (
              <p className="text-sm text-destructive">
                {errors.user_branch_scopes.message}
              </p>
            )}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Lưu nhân viên"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
