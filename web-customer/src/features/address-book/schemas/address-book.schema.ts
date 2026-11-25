import { z } from "zod";
import type {
  AddressBookDistrict,
  AddressBookFormInputValues,
  AddressBookFormMode,
  AddressBookFormValues,
  AddressBookProvince,
  AddressBookWard,
} from "../types/address-book.types";

type CatalogId = number | string;
type ProvinceCatalogItem = Omit<AddressBookProvince, "id"> & {
  id: CatalogId;
};
type DistrictCatalogItem = Omit<
  AddressBookDistrict,
  "id" | "province_id"
> & {
  id: CatalogId;
  province_id: CatalogId;
};
type WardCatalogItem = Omit<AddressBookWard, "id" | "district_id"> & {
  id: CatalogId;
  district_id: CatalogId;
};

function getCatalogIdKey(id: CatalogId): string | null {
  if (typeof id === "string") {
    return id;
  }

  return Number.isSafeInteger(id) ? String(id) : null;
}

function addFieldIssue(
  context: z.RefinementCtx,
  field: keyof AddressBookFormValues,
  message: string,
): void {
  context.addIssue({
    code: "custom",
    path: [field],
    message,
  });
}

const addressTypeSchema = z
  .union([
    z.enum(["sender", "receiver", "both"]),
    z.literal(""),
  ])
  .pipe(
    z.enum(
      ["sender", "receiver", "both"],
      "Vui lòng chọn loại địa chỉ.",
    ),
  );

export function createAddressBookSchema(
  mode: AddressBookFormMode,
  provinces: readonly ProvinceCatalogItem[],
  districts: readonly DistrictCatalogItem[],
  wards: readonly WardCatalogItem[],
) {
  const phoneSchema =
    mode.mode === "create"
      ? z
          .string()
          .trim()
          .min(1, "Vui lòng nhập số điện thoại.")
      : z.string().trim();

  const schema = z
    .object({
      label: z.string().trim(),
      contact_name: z
        .string()
        .trim()
        .min(1, "Vui lòng nhập họ tên người liên hệ."),
      phone: phoneSchema.refine(
        (phone) => !phone.includes("*"),
        "Vui lòng nhập số điện thoại mới thay vì số điện thoại đã che.",
      ),
      address_type: addressTypeSchema,
      province_id: z
        .string()
        .trim()
        .min(1, "Vui lòng chọn Tỉnh/Thành phố."),
      district_id: z.string().trim().min(1, "Vui lòng chọn Quận/Huyện."),
      ward_id: z.string().trim().min(1, "Vui lòng chọn Phường/Xã."),
      address_line: z
        .string()
        .trim()
        .min(1, "Vui lòng nhập địa chỉ chi tiết."),
      is_default: z.boolean("Trạng thái mặc định phải là boolean."),
    })
    .superRefine((values, context) => {
      const provinceId = values.province_id;
      const districtId = values.district_id;
      const wardId = values.ward_id;

      const province =
        provinceId.length > 0
          ? provinces.find(
              (item) => getCatalogIdKey(item.id) === provinceId,
            )
          : undefined;
      const district =
        districtId.length > 0
          ? districts.find(
              (item) => getCatalogIdKey(item.id) === districtId,
            )
          : undefined;
      const ward =
        wardId.length > 0
          ? wards.find((item) => getCatalogIdKey(item.id) === wardId)
          : undefined;

      const isProvinceAvailable = province?.is_active === 1;
      const isDistrictAvailable = district?.is_active === 1;
      const isWardAvailable = ward?.is_active === 1;

      if (provinceId.length > 0 && !isProvinceAvailable) {
        addFieldIssue(
          context,
          "province_id",
          "Địa chỉ đã chọn không còn khả dụng.",
        );
      }

      if (districtId.length > 0 && !isDistrictAvailable) {
        addFieldIssue(
          context,
          "district_id",
          "Địa chỉ đã chọn không còn khả dụng.",
        );
      } else if (
        isProvinceAvailable &&
        isDistrictAvailable &&
        getCatalogIdKey(district.province_id) !== provinceId
      ) {
        addFieldIssue(
          context,
          "district_id",
          "Quận/Huyện không thuộc Tỉnh/Thành phố đã chọn.",
        );
      }

      if (wardId.length > 0 && !isWardAvailable) {
        addFieldIssue(
          context,
          "ward_id",
          "Địa chỉ đã chọn không còn khả dụng.",
        );
      } else if (
        isDistrictAvailable &&
        isWardAvailable &&
        getCatalogIdKey(ward.district_id) !== districtId
      ) {
        addFieldIssue(
          context,
          "ward_id",
          "Phường/Xã không thuộc Quận/Huyện đã chọn.",
        );
      }
    });

  return schema satisfies z.ZodType<
    AddressBookFormValues,
    AddressBookFormInputValues
  >;
}
