import { useId } from "react";
import {
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AddressBookMockRecord } from "../api/address-book.api";
import type { AddressType } from "../types/address-book.types";

const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  sender: "Địa chỉ gửi hàng",
  receiver: "Địa chỉ nhận hàng",
  both: "Địa chỉ gửi và nhận hàng",
};

const UNAVAILABLE_GEOGRAPHY_LABEL = "Địa giới chưa khả dụng";

export interface AddressCardGeographyNames {
  province: string | null;
  district: string | null;
  ward: string | null;
}

export interface AddressCardProps {
  address: AddressBookMockRecord;
  geography: AddressCardGeographyNames;
  canEdit: boolean;
  canDelete: boolean;
  canSetDefault: boolean;
  actionUnavailableMessage: string;
  defaultAddressNotice: string;
  isSaving?: boolean;
  isDeleting?: boolean;
  onEdit: (mockId: string) => void | Promise<void>;
  onRequestDelete: (mockId: string) => void;
  onSetDefault?: (mockId: string) => void | Promise<void>;
}

function getGeographyLabel(name: string | null): string {
  return name?.trim() || UNAVAILABLE_GEOGRAPHY_LABEL;
}

export function AddressCard({
  address,
  geography,
  canEdit,
  canDelete,
  canSetDefault,
  actionUnavailableMessage,
  defaultAddressNotice,
  isSaving = false,
  isDeleting = false,
  onEdit,
  onRequestDelete,
  onSetDefault,
}: AddressCardProps) {
  const actionHelpId = useId();
  const label = address.label.trim() || "Địa chỉ đã lưu";
  const isBusy = isSaving || isDeleting;
  const canRunDelete = canDelete && !address.is_default && !isBusy;
  const canRunSetDefault =
    canSetDefault &&
    !address.is_default &&
    onSetDefault !== undefined &&
    !isBusy;
  const busyMessage = isSaving
    ? "Đang lưu địa chỉ..."
    : isDeleting
      ? "Đang xóa địa chỉ..."
      : null;
  const actionHelpMessage = busyMessage
    ? busyMessage
    : !canEdit || (!address.is_default && !canDelete)
      ? actionUnavailableMessage
      : address.is_default || !canRunSetDefault
        ? defaultAddressNotice
        : null;

  return (
    <Card
      className={cn(
        "h-full min-w-0",
        address.is_default && "border-primary/40 bg-primary/[0.02]",
      )}
    >
      <CardHeader className="space-y-3 pb-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="break-words text-lg leading-snug sm:text-xl">
              {label}
            </CardTitle>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            <Badge variant="outline" className="whitespace-normal text-left">
              {ADDRESS_TYPE_LABELS[address.address_type]}
            </Badge>
            {address.is_default && (
              <Badge variant="secondary" className="gap-1.5">
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                Mặc định
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex min-w-0 items-start gap-2">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="min-w-0 break-words">{address.contact_name}</p>
          </div>

          <div className="flex min-w-0 items-start gap-2">
            <Phone
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="min-w-0 break-words">{address.phone_masked}</p>
          </div>

          <div className="flex min-w-0 items-start gap-2">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <address className="min-w-0 break-words not-italic leading-relaxed">
              <p>{address.address_line}</p>
              <p className="mt-1 text-muted-foreground">
                {getGeographyLabel(geography.province)} -{" "}
                {getGeographyLabel(geography.district)} -{" "}
                {getGeographyLabel(geography.ward)}
              </p>
            </address>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            disabled={!canEdit || isBusy}
            aria-label={`Sửa địa chỉ: ${label}`}
            aria-describedby={
              !canEdit || isBusy ? actionHelpId : undefined
            }
            onClick={() => {
              void onEdit(address.mock_id);
            }}
          >
            {isSaving ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Pencil className="h-4 w-4" aria-hidden="true" />
            )}
            Sửa
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            disabled={!canRunDelete}
            aria-label={`Yêu cầu xóa địa chỉ: ${label}`}
            aria-describedby={
              !canRunDelete ? actionHelpId : undefined
            }
            onClick={() => onRequestDelete(address.mock_id)}
          >
            {isDeleting ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            Xóa
          </Button>

          {!address.is_default && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-w-0 flex-1 sm:flex-none"
              disabled={!canRunSetDefault}
              aria-label={`Đặt địa chỉ mặc định: ${label}`}
              aria-describedby={
                !canRunSetDefault ? actionHelpId : undefined
              }
              onClick={() => {
                if (onSetDefault) {
                  void onSetDefault(address.mock_id);
                }
              }}
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              Đặt mặc định
            </Button>
          )}
        </div>

        {actionHelpMessage && (
          <p
            id={actionHelpId}
            className="text-xs leading-relaxed text-muted-foreground"
            role={busyMessage ? "status" : undefined}
          >
            {actionHelpMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
