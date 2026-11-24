import type { z } from "zod";
import type { parcelInputSchema, paymentMethodSchema } from "../schemas/shipment-create.schema";

export type ParcelInput = z.infer<typeof parcelInputSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
