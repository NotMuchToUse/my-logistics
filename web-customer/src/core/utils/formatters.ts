const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const WEIGHT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatVndCurrency(amount: number): string {
  return VND_FORMATTER.format(amount);
}

export function formatWeight(weightGram: number): string {
  if (weightGram < 1000) {
    return `${WEIGHT_FORMATTER.format(weightGram)} g`;
  }

  return `${WEIGHT_FORMATTER.format(weightGram / 1000)} kg`;
}

export function formatDateTime(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : new Date(
          /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
            ? value
            : `${value.replace(" ", "T")}+07:00`,
        );

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Giá trị ngày giờ không hợp lệ.");
  }

  return `${DATE_TIME_FORMATTER.format(date)} +07:00`;
}
