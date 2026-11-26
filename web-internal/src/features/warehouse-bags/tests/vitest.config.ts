/// <reference types="node" />
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../../", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/features/warehouse-bags/tests/warehouse-bags-hook.test.ts", "src/features/warehouse-bags/tests/warehouse-bags-components.test.tsx", "src/features/warehouse-bags/tests/warehouse-bags-page.test.tsx", "src/features/warehouse-bags/tests/warehouse-bags-demo.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
