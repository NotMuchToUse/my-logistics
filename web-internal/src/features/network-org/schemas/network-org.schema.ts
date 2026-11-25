import { z } from "zod";
import { BRANCH_TYPES, WAREHOUSE_TYPES } from "../types/network-org.types";

const latitudeSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập vĩ độ.")
  .transform(Number)
  .pipe(
    z
      .number()
      .finite("Vĩ độ phải là số hợp lệ.")
      .min(-90, "Vĩ độ phải từ -90 đến 90.")
      .max(90, "Vĩ độ phải từ -90 đến 90."),
  );

const longitudeSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập kinh độ.")
  .transform(Number)
  .pipe(
    z
      .number()
      .finite("Kinh độ phải là số hợp lệ.")
      .min(-180, "Kinh độ phải từ -180 đến 180.")
      .max(180, "Kinh độ phải từ -180 đến 180."),
  );

const locationIdSchema = (field: string) =>
  z
    .string()
    .regex(/^[1-9]\d*$/, `Vui lòng chọn ${field}.`)
    .transform(Number)
    .pipe(z.number().finite().int().positive());

const locationFields = {
  province_id: locationIdSchema("tỉnh / thành phố"),
  district_id: locationIdSchema("quận / huyện"),
  ward_id: locationIdSchema("phường / xã"),
  address_line: z.string().trim().min(1, "Vui lòng nhập địa chỉ."),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  operating_hours: z
    .string()
    .trim()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
      "Giờ hoạt động cần theo định dạng HH:mm-HH:mm.",
    ),
  is_active: z.enum(["0", "1"]).transform(Number),
};

export const branchFormSchema = z.object({
  code: z.string().trim().min(1, "Vui lòng nhập mã đơn vị."),
  name: z.string().trim().min(1, "Vui lòng nhập tên đơn vị."),
  branch_type: z.enum(BRANCH_TYPES),
  parent_branch_id: z
    .union([
      z.literal(""),
      z
        .string()
        .regex(/^[1-9]\d*$/, "Đơn vị cấp trên không hợp lệ.")
        .transform(Number)
        .pipe(z.number().finite().int().positive()),
    ])
    .transform((value) => (value === "" ? null : value)),
  ...locationFields,
  accepts_counter_dropoff: z.enum(["0", "1"]).transform(Number),
});

export const warehouseFormSchema = z.object({
  branch_id: locationIdSchema("đơn vị trực thuộc"),
  code: z.string().trim().min(1, "Vui lòng nhập mã kho."),
  name: z.string().trim().min(1, "Vui lòng nhập tên kho."),
  warehouse_type: z.enum(WAREHOUSE_TYPES),
  max_capacity_parcels: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập sức chứa.")
    .transform(Number)
    .pipe(z.number().int().positive("Sức chứa phải là số nguyên dương.")),
  ...locationFields,
});
