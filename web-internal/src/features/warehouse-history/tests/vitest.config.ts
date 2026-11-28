import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../../", import.meta.url)) } },
  test: { environment: "jsdom", include: ["src/features/warehouse-history/tests/*.test.{ts,tsx}"], setupFiles: ["./src/test/setup.ts"] },
});
