/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_WAREHOUSE_BAGS_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// declare module "jsbarcode" {
//   function JsBarcode(
//     element: unknown,
//     text: string,
//     options?: Record<string, unknown>,
//   ): void;
//   export = JsBarcode;
// }
