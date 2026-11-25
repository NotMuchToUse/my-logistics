import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormRegisterReturn } from "react-hook-form";

interface TextFieldProps {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
  type?: "text" | "number" | "url" | "tel";
  min?: number;
  max?: number;
  step?: number | "any";
  inputMode?: "numeric" | "decimal" | "text" | "tel" | "url";
  disabled?: boolean;
}

export function OpsConfigTextField({
  id,
  label,
  register,
  error,
  type = "text",
  min,
  max,
  step,
  inputMode,
  disabled = false,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        disabled={disabled}
        className="text-base sm:text-sm"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...register}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function OpsConfigSelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  placeholder = "Chọn...",
  disabled = false,
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || "__unset__"}
        onValueChange={(selected) =>
          onChange(selected === "__unset__" ? "" : selected)
        }
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function OpsConfigFilterSelect({
  label,
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <div className="min-w-[10rem] space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value || "all"}
        onValueChange={(selected) => onChange(selected === "all" ? "" : selected)}
      >
        <SelectTrigger aria-label={label} className="h-10 text-base sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CheckboxFieldProps {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  disabled?: boolean;
}

export function OpsConfigCheckboxField({
  id,
  label,
  register,
  disabled = false,
}: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className="flex min-h-10 items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4"
        disabled={disabled}
        {...register}
      />
      {label}
    </label>
  );
}
