export const PAYMENT_METHODS = ["ngttn", "ngtts", "nntn"] as const;

export const PAYMENT_METHOD_LABELS = {
  ngttn: "Người gửi trả tiền ngay",
  ngtts: "Người gửi trả tiền sau",
  nntn: "Người nhận trả tiền",
} satisfies Record<(typeof PAYMENT_METHODS)[number], string>;
