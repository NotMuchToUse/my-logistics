import { trackingRangeInputSchema } from "../schemas/trackingRange.schema.ts";

type Interval = { start_number: string; end_number: string };

function validateInterval(value: Interval): Interval {
  return trackingRangeInputSchema.parse({ ...value, prefix: "VALIDATE", branch_id: null });
}

export function countRangeNumbers(value: Interval): string {
  const range = validateInterval(value);
  return (BigInt(range.end_number) - BigInt(range.start_number) + 1n).toString();
}

/** Mathematical intersection only; does not decide prefix/branch conflict policy. */
export function rangesIntersect(left: Interval, right: Interval): boolean {
  const a = validateInterval(left);
  const b = validateInterval(right);
  return BigInt(a.start_number) <= BigInt(b.end_number) && BigInt(b.start_number) <= BigInt(a.end_number);
}
