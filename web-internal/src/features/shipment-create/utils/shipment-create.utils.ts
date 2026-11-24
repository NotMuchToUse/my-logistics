import type { ParcelInput } from "../types/shipment-create.types";

export function summarizeParcels(parcels: readonly Partial<ParcelInput>[]) {
  let actualWeightGram = 0;
  let valid = parcels.length > 0;
  for (const parcel of parcels) {
    const weight = parcel.actualWeightGram;
    if (typeof weight !== "number" || !Number.isInteger(weight) || weight <= 0 || weight > 4294967295) {
      valid = false;
      continue;
    }
    actualWeightGram += weight;
  }
  if (!Number.isSafeInteger(actualWeightGram) || actualWeightGram > 4294967295) valid = false;
  return { count: parcels.length, actualWeightGram: valid ? actualWeightGram : null };
}
