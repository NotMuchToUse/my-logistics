import { z } from "zod";

export const createPickupRequestSchema = z.object({
  branch_id: z.number().int().positive("Vui lòng chọn bưu cục tiếp nhận."),
  pickup_mode: z.enum(["driver_pickup", "counter_dropoff"]),
  sender_name: z
    .string()
    .trim()
    .min(2, "Tên người gửi phải có ít nhất 2 ký tự.")
    .max(150, "Tên người gửi tối đa 150 ký tự."),
  sender_phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{8,10}$/, "Số điện thoại không đúng định dạng Việt Nam."),
  province_id: z.number().int().positive("Vui lòng chọn tỉnh/thành phố."),
  district_id: z.number().int().positive("Vui lòng chọn quận/huyện."),
  ward_id: z.number().int().positive("Vui lòng chọn phường/xã."),
  pickup_address: z
    .string()
    .trim()
    .min(5, "Vui lòng nhập địa chỉ lấy hàng chi tiết.")
    .max(255, "Địa chỉ tối đa 255 ký tự."),
  estimated_parcel_count: z
    .number()
    .int()
    .min(1, "Số kiện dự kiến tối thiểu là 1.")
    .max(500, "Số kiện dự kiến tối đa 500."),
  estimated_weight_gram: z
    .number()
    .int()
    .min(50, "Trọng lượng dự kiến tối thiểu 50g.")
    .max(500_000, "Trọng lượng dự kiến tối đa 500kg."),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
});

export const cancelPickupRequestSchema = z.object({
  cancel_reason: z
    .string()
    .trim()
    .min(5, "Vui lòng nhập lý do hủy tối thiểu 5 ký tự.")
    .max(500, "Lý do hủy tối đa 500 ký tự."),
});