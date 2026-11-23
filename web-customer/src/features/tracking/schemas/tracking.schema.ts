import { z } from "zod";

export const trackingSearchSchema = z.object({
  tracking_codes: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập ít nhất một mã vận đơn.")
    .superRefine((value, context) => {
      const codes = value.split(",");

      codes.forEach((code) => {
        const normalizedCode = code.trim();

        if (!normalizedCode) {
          context.addIssue({
            code: "custom",
            message: "Vui lòng kiểm tra các mã vận đơn được ngăn cách bằng dấu phẩy.",
          });
          return;
        }

        if (!/^[A-Z0-9-]{1,64}$/i.test(normalizedCode)) {
          context.addIssue({
            code: "custom",
            message: "Mã vận đơn chỉ được chứa chữ cái, chữ số và dấu gạch ngang.",
          });
        }
      });
    }),
});

export type TrackingSearchFormValues = z.infer<typeof trackingSearchSchema>;
