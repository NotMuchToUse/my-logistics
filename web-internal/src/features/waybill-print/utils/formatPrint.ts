export function displayMoney(value: string | null): string {
  if (value === null || !/^\d+(?:\.\d{1,2})?$/.test(value)) return "Chưa có dữ liệu";
  const [integer, fraction] = value.split(".");
  return `${BigInt(integer).toLocaleString("vi-VN")}${fraction && Number(fraction) !== 0 ? `,${fraction.padEnd(2, "0")}` : ""} đ`;
}

export function displayWeight(value: number | null): string {
  return value !== null && Number.isSafeInteger(value) && value >= 0 ? `${value.toLocaleString("vi-VN")} g` : "Chưa có dữ liệu";
}
