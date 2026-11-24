import { z } from "zod";

// Positive integer grams follow the PDF's unsigned integer storage.
export const pickupSchema = z.object({
  handoverMode: z.enum(["driver_pickup", "counter_dropoff"]),
  addressId: z.string(),
  branchPublicId: z.string(),
  parcelCount: z.number({ error: "Nhập số kiện hợp lệ." }).int("Số kiện phải là số nguyên.").positive("Số kiện phải lớn hơn 0."),
  weightGram: z.number({ error: "Nhập trọng lượng hợp lệ." }).int("Nhập trọng lượng theo số gram nguyên.").positive("Trọng lượng phải lớn hơn 0."),
}).superRefine((value, context) => {
  if (value.handoverMode === "driver_pickup" && !value.addressId) {
    context.addIssue({ code: "custom", path: ["addressId"], message: "Vui lòng chọn địa chỉ lấy hàng." });
  }
  if (value.handoverMode === "counter_dropoff" && !value.branchPublicId) {
    context.addIssue({ code: "custom", path: ["branchPublicId"], message: "Vui lòng chọn bưu cục." });
  }
});
