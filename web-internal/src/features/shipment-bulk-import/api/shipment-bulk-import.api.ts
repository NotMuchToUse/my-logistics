import { z } from "zod";
import axiosClient from "@/core/api/axiosClient";
import type { ShipmentBulkImportInput } from "../schemas/shipment-bulk-import.schema";

const bulkImportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    created_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    results: z.array(
      z.object({
        row_number: z.number().int().positive(),
        status: z.enum(["created", "failed"]),
        public_id: z.string().optional(),
        errors: z
          .array(
            z.object({
              field: z.string(),
              message: z.string(),
            }),
          )
          .optional(),
      }),
    ),
  }),
  meta: z.object({ timestamp: z.string() }),
});

export type ShipmentBulkImportResponse = z.infer<
  typeof bulkImportResponseSchema
>;

export async function submitShipmentBulkImport(
  shipments: ShipmentBulkImportInput[],
): Promise<ShipmentBulkImportResponse> {
  const response = await axiosClient.post<unknown>(
    "/api/v1/shipments/bulk-import",
    { shipments },
  );
  return bulkImportResponseSchema.parse(response.data);
}
