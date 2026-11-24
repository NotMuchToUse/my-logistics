export interface CatalogApiError {
  code: string;
  message: string;
  details: Record<string, string[]>;
}

export function normalizeCatalogError(error: unknown): CatalogApiError {
  if (typeof error === "object" && error !== null && "success" in error) {
    const candidate = error as {
      success?: unknown;
      error?: {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      };
    };
    if (candidate.success === false && typeof candidate.error === "object" && candidate.error !== null) {
      const details =
        typeof candidate.error.details === "object" &&
        candidate.error.details !== null
          ? candidate.error.details as Record<string, string[]>
          : {};
      return {
        code: typeof candidate.error.code === "string" ? candidate.error.code : "500_INTERNAL_ERROR",
        message:
          typeof candidate.error.message === "string"
            ? candidate.error.message
            : "Không thể xử lý danh mục.",
        details,
      };
    }
  }

  return {
    code: "500_INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Không thể kết nối đến máy chủ.",
    details: {},
  };
}

export function createCatalogMutationGuard() {
  let inFlight = false;
  return {
    run<T>(operation: () => Promise<T>): Promise<T> | null {
      if (inFlight) return null;
      inFlight = true;
      return operation().finally(() => {
        inFlight = false;
      });
    },
  };
}

export function isStaleCatalogRequest(requestSequence: number, latestSequence: number): boolean {
  return requestSequence !== latestSequence;
}
