import { z } from "zod";
import axiosClient, { USE_MOCK } from "@/core/api/axiosClient";
import geographyMock from "@/mocks/shipment-create.mock.json";
import catalogMock from "@/mocks/masterData.mock.json";

const optionSchema = z.object({ id: z.number().int().positive(), name: z.string(), is_active: z.number().optional() });
const listSchema = z.object({
  success: z.literal(true), data: z.array(optionSchema),
  meta: z.object({ pagination: z.object({ page: z.number().int().positive(), total_pages: z.number().int().nonnegative() }) }),
});
export type CatalogOption = z.infer<typeof optionSchema>;
export type CatalogResource = "provinces" | "districts" | "wards" | "service-types" | "value-added-services";

export async function fetchOptions(resource: CatalogResource, parentId: number | null, signal: AbortSignal): Promise<CatalogOption[]> {
  if (USE_MOCK) {
    switch (resource) {
      case "provinces": return geographyMock.data.provinces;
      case "districts": return geographyMock.data.districts.filter((row) => row.province_id === parentId);
      case "wards": return geographyMock.data.wards.filter((row) => row.district_id === parentId);
      case "service-types": return catalogMock.success_response.data.service_types;
      case "value-added-services": return catalogMock.success_response.data.value_added_services;
    }
  }
  const geographic = resource === "provinces" || resource === "districts" || resource === "wards";
  const rows: CatalogOption[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await axiosClient.get<unknown>(`/api/v1/${geographic ? "public" : "master-data"}/${resource}`, {
      signal,
      params: { page, per_page: 100, ...(resource === "districts" ? { province_id: parentId } : {}), ...(resource === "wards" ? { district_id: parentId } : {}) },
    });
    const envelope = listSchema.parse(response.data);
    if (envelope.meta.pagination.page !== page) throw new Error("Phân trang danh mục không hợp lệ.");
    rows.push(...envelope.data.filter((row) => row.is_active !== 0));
    totalPages = envelope.meta.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return rows;
}
