import { z } from 'zod';
import { CREATE_TYPES, INCIDENT_TYPES, SEVERITIES, STATUSES } from '../constants/shipmentIncidents.constants.ts';

export const internalIdSchema = z.string().regex(/^[1-9]\d*$/, 'Định danh không hợp lệ');
export const publicIdSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export const evidenceUrlSchema = z.string().refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}, 'URL chứng từ không hợp lệ');
export const incidentSchema = z.object({
  id: internalIdSchema, public_id: publicIdSchema, incident_code: z.string().min(1),
  shipment_id: internalIdSchema, branch_id: internalIdSchema,
  incident_type: z.enum(INCIDENT_TYPES), severity: z.enum(SEVERITIES), description: z.string(),
  evidence_urls: z.array(evidenceUrlSchema).nullable(), reported_by: internalIdSchema,
  responsible_user_id: internalIdSchema.nullable(), assigned_handler_id: internalIdSchema.nullable(),
  status: z.enum(STATUSES), resolution_note: z.string().nullable(), resolved_at: z.string().nullable(),
  version: z.number().int().positive(), created_at: z.string(), updated_at: z.string(),
});
// These request models are Mock-only until KHA-35 confirms DTOs and FK representation.
export const createIncidentSchema = z.object({
  shipment_id: internalIdSchema, incident_type: z.enum(CREATE_TYPES), severity: z.enum(SEVERITIES),
  description: z.string().trim().min(1, 'Vui lòng nhập mô tả sự cố'), evidence_urls: z.array(evidenceUrlSchema),
}).strict();
export const assignmentSchema = z.object({ responsible_user_id: internalIdSchema.nullable(), resolution_note: z.string().trim(), version: z.number().int().positive() }).strict();
export const filtersSchema = z.object({
  search: z.string().default(''), incident_type: z.enum(INCIDENT_TYPES).or(z.literal('')).default(''),
  severity: z.enum(SEVERITIES).or(z.literal('')).default(''), status: z.enum(STATUSES).or(z.literal('')).default(''),
  responsible_user_id: internalIdSchema.or(z.literal('')).default(''),
  page: z.number().int().positive().default(1), per_page: z.number().int().min(1).max(100).default(20),
});
export const DEFAULT_FILTERS = filtersSchema.parse({});
