/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK: string;
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
