import { useId, useMemo } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { AddressBookCatalogs } from "../api/address-book.api";
import type { AddressBookMockRecord } from "../api/address-book.api";
import type { AddressBookTypeFilter } from "../types/address-book.types";
import type { useAddressBook } from "../hooks/useAddressBook";
import { AddressCard, type AddressCardGeographyNames } from "./AddressCard";

type AddressBookListState = Pick<
  ReturnType<typeof useAddressBook>,
  | "addresses"
  | "filteredAddresses"
  | "addressTypeFilter"
  | "setAddressTypeFilter"
  | "isLoadingAddresses"
  | "listError"
  | "catalogError"
  | "isBackendUnavailable"
  | "isAddressListEmpty"
  | "hasNoFilteredAddresses"
  | "isSavingAddress"
  | "isDeletingAddress"
  | "dataSource"
  | "mockNotice"
  | "capabilities"
  | "reloadAddresses"
  | "openAddForm"
  | "openEditForm"
  | "requestDeleteAddress"
>;

export interface AddressListProps {
  addressBook: AddressBookListState;
  geographyCatalogs: AddressBookCatalogs | null;
}

interface CatalogItemWithId {
  id: number;
}

interface GeographyIndexes {
  provinces: ReadonlyMap<string, AddressBookCatalogs["provinces"][number]>;
  districts: ReadonlyMap<string, AddressBookCatalogs["districts"][number]>;
  wards: ReadonlyMap<string, AddressBookCatalogs["wards"][number]>;
}

const EMPTY_CATALOGS: AddressBookCatalogs = {
  provinces: [],
  districts: [],
  wards: [],
};

const FILTER_LABELS: Record<AddressBookTypeFilter, string> = {
  all: "Tất cả",
  sender: "Gửi hàng",
  receiver: "Nhận hàng",
  both: "Gửi và nhận",
};

function getIdentifierKey(identifier: number | string): string | null {
  if (typeof identifier === "string") {
    return identifier.length > 0 ? identifier : null;
  }

  return Number.isSafeInteger(identifier) ? String(identifier) : null;
}

function createIdentifierIndex<T extends CatalogItemWithId>(
  items: readonly T[],
): ReadonlyMap<string, T> {
  const index = new Map<string, T>();

  for (const item of items) {
    const key = getIdentifierKey(item.id);
    if (key !== null) {
      index.set(key, item);
    }
  }

  return index;
}

function createGeographyIndexes(
  catalogs: AddressBookCatalogs,
): GeographyIndexes {
  return {
    provinces: createIdentifierIndex(catalogs.provinces),
    districts: createIdentifierIndex(catalogs.districts),
    wards: createIdentifierIndex(catalogs.wards),
  };
}

function resolveAddressGeography(
  address: AddressBookMockRecord,
  indexes: GeographyIndexes,
): AddressCardGeographyNames {
  const provinceId = getIdentifierKey(address.province_id);
  const districtId = getIdentifierKey(address.district_id);
  const wardId = getIdentifierKey(address.ward_id);
  const province =
    provinceId === null ? undefined : indexes.provinces.get(provinceId);
  const district =
    districtId === null ? undefined : indexes.districts.get(districtId);
  const ward = wardId === null ? undefined : indexes.wards.get(wardId);

  const districtBelongsToProvince =
    provinceId !== null &&
    district !== undefined &&
    getIdentifierKey(district.province_id) === provinceId;
  const wardBelongsToDistrict =
    districtId !== null &&
    ward !== undefined &&
    getIdentifierKey(ward.district_id) === districtId;

  return {
    province:
      province?.is_active === 1
        ? province.name
        : null,
    district:
      province?.is_active === 1 &&
      district?.is_active === 1 &&
      districtBelongsToProvince
        ? district.name
        : null,
    ward:
      district?.is_active === 1 &&
      ward?.is_active === 1 &&
      wardBelongsToDistrict
        ? ward.name
        : null,
  };
}

function getActionUnavailableMessage(
  isBackendUnavailable: boolean,
  catalogError: string | null,
  listError: string | null,
): string {
  if (isBackendUnavailable) {
    return "Backend quản lý sổ địa chỉ chưa được kết nối.";
  }

  return (
    catalogError ??
    listError ??
    "Thao tác địa chỉ hiện chưa khả dụng trong phiên này."
  );
}

export function AddressList({
  addressBook,
  geographyCatalogs,
}: AddressListProps) {
  const addButtonHelpId = useId();
  const {
    addresses,
    filteredAddresses,
    addressTypeFilter,
    setAddressTypeFilter,
    isLoadingAddresses,
    listError,
    catalogError,
    isBackendUnavailable,
    isAddressListEmpty,
    hasNoFilteredAddresses,
    isSavingAddress,
    isDeletingAddress,
    dataSource,
    mockNotice,
    capabilities,
    reloadAddresses,
    openAddForm,
    openEditForm,
    requestDeleteAddress,
  } = addressBook;
  const catalogs = geographyCatalogs ?? EMPTY_CATALOGS;
  const geographyIndexes = useMemo(
    () => createGeographyIndexes(catalogs),
    [catalogs],
  );
  const actionUnavailableMessage = getActionUnavailableMessage(
    isBackendUnavailable,
    catalogError,
    listError,
  );
  const isAddDisabled =
    !capabilities.canCreateAddress || isBackendUnavailable;
  const isInitialLoading = isLoadingAddresses && addresses.length === 0;
  const activeFilterLabel = FILTER_LABELS[addressTypeFilter];

  function handleFilterChange(value: string): void {
    if (value === "all" || value === "sender" || value === "receiver") {
      setAddressTypeFilter(value);
    }
  }

  function renderEmptyListAction() {
    if (!capabilities.canCreateAddress) {
      return undefined;
    }

    return (
      <Button type="button" onClick={openAddForm}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Thêm địa chỉ
      </Button>
    );
  }

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="address-list-title">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1
            id="address-list-title"
            className="break-words text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Sổ địa chỉ
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Quản lý địa chỉ gửi và nhận hàng của bạn.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            disabled={isAddDisabled}
            aria-describedby={isAddDisabled ? addButtonHelpId : undefined}
            onClick={openAddForm}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Thêm địa chỉ
          </Button>
          {isAddDisabled && (
            <p
              id={addButtonHelpId}
              className="max-w-xs text-xs text-muted-foreground sm:text-right"
            >
              {actionUnavailableMessage}
            </p>
          )}
        </div>
      </header>

      {dataSource === "mock" && mockNotice && (
        <aside
          className="space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-sm"
          aria-label="Thông tin dữ liệu minh họa"
        >
          <p className="font-medium">Dữ liệu minh họa</p>
          <p className="text-muted-foreground">{mockNotice}</p>
          <p className="text-muted-foreground">
            {capabilities.defaultAddressNotice}
          </p>
        </aside>
      )}

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Tabs
            value={addressTypeFilter === "both" ? "" : addressTypeFilter}
            onValueChange={handleFilterChange}
          >
            <TabsList
              className="grid h-auto w-full grid-cols-3 sm:w-auto"
              aria-label="Lọc loại địa chỉ"
            >
              <TabsTrigger className="min-w-0 px-2" value="all">
                Tất cả
              </TabsTrigger>
              <TabsTrigger className="min-w-0 px-2" value="sender">
                Gửi hàng
              </TabsTrigger>
              <TabsTrigger className="min-w-0 px-2" value="receiver">
                Nhận hàng
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground sm:text-right">
          <p aria-live="polite">
            {addresses.length > 0
              ? `Đang hiển thị ${filteredAddresses.length} / ${addresses.length} địa chỉ`
              : `Bộ lọc: ${activeFilterLabel}`}
          </p>
          {addressTypeFilter === "both" && (
            <p role="status">Đang áp dụng bộ lọc: {activeFilterLabel}</p>
          )}
        </div>
      </div>

      {catalogError && !listError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <CircleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>
            Chưa tải được danh mục địa giới: {catalogError}. Một số tên địa giới
            có thể chưa khả dụng.
          </p>
        </div>
      )}

      <div
        className="min-w-0 space-y-4"
        aria-busy={isLoadingAddresses}
      >
        {isLoadingAddresses && addresses.length > 0 && !listError && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Đang cập nhật danh sách địa chỉ...
          </p>
        )}

        {listError ? (
          <Card role="alert">
            <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <CircleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                  <h2 className="font-semibold">
                    {isBackendUnavailable
                      ? "Backend chưa được kết nối"
                      : "Chưa thể tải sổ địa chỉ"}
                  </h2>
                  <p className="break-words text-sm text-muted-foreground">
                    {listError}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isLoadingAddresses}
                onClick={() => {
                  void reloadAddresses();
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Thử tải lại
              </Button>
            </CardContent>
          </Card>
        ) : isInitialLoading ? (
          <div
            className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle
              className="h-6 w-6 animate-spin"
              aria-hidden="true"
            />
            Đang tải sổ địa chỉ...
          </div>
        ) : isAddressListEmpty ? (
          <EmptyState
            title="Chưa có địa chỉ nào"
            description="Thêm địa chỉ gửi hoặc nhận để quản lý thông tin giao hàng thuận tiện hơn."
            action={renderEmptyListAction()}
          />
        ) : hasNoFilteredAddresses ? (
          <EmptyState
            title="Không có địa chỉ phù hợp"
            description={`Không có địa chỉ thuộc bộ lọc “${activeFilterLabel}”. Hãy xem toàn bộ danh sách để tiếp tục.`}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddressTypeFilter("all")}
              >
                Xem tất cả
              </Button>
            }
          />
        ) : filteredAddresses.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredAddresses.map((address) => (
              <AddressCard
                key={address.mock_id}
                address={address}
                geography={resolveAddressGeography(
                  address,
                  geographyIndexes,
                )}
                canEdit={capabilities.canEditAddress}
                canDelete={capabilities.canDeleteAddress(address)}
                canSetDefault={capabilities.canSetDefaultAddress}
                actionUnavailableMessage={actionUnavailableMessage}
                defaultAddressNotice={capabilities.defaultAddressNotice}
                isSaving={isSavingAddress}
                isDeleting={isDeletingAddress}
                onEdit={openEditForm}
                onRequestDelete={requestDeleteAddress}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sổ địa chỉ chưa sẵn sàng"
            description="Danh sách địa chỉ sẽ hiển thị sau khi phiên khách hàng được khởi tạo."
          />
        )}
      </div>
    </section>
  );
}
