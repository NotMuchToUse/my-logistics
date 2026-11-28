import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "src/features/shipment-detail/__tests__/**/*.test.{ts,tsx}",
      "src/features/warehouse-audit/**/*.test.{ts,tsx}",
      "src/features/warehouse-outbound-linehaul/tests/**/*.test.{ts,tsx}",
      "src/core/stores/__tests__/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./src/test/setup.ts"],
  },
});
