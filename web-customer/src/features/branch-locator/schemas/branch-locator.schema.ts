import { z } from "zod";

export const branchFilterSchema = z.object({
  keyword: z
    .string()
    .trim()
    .max(100, "Từ khóa không được vượt quá 100 ký tự."),
  province_id: z
    .string()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: "Tỉnh/thành phố không hợp lệ.",
    }),
  district_id: z
    .string()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: "Quận/huyện không hợp lệ.",
    }),
  accepts_counter_dropoff: z.boolean(),
});

export type BranchFilterFormValues = z.infer<typeof branchFilterSchema>;
