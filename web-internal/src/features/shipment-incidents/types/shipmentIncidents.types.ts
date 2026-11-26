import type { z } from 'zod';
import type { assignmentSchema, createIncidentSchema, filtersSchema, incidentSchema } from '../schemas/shipmentIncidents.schema.ts';
import type { ApiPaginationResponse, ApiSuccessResponse } from '@/types/api.types';
export type Incident = z.infer<typeof incidentSchema>;
export type CreateIncident = z.infer<typeof createIncidentSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type Filters = z.infer<typeof filtersSchema>;
export interface IncidentSession {
  key: string; actorId: string | null; branchId: string | null; authenticated: boolean;
  scopeType: string; allowedBranchIds: string[];
  capabilities: { read: boolean; create: boolean; assign: boolean; handoff: boolean };
}
export interface StaffOption { id: string; branch_id: string; full_name: string; employee_code: string; eligible: boolean; user_type: string }
export interface ShipmentOption { id: string; branch_id: string; tracking_code: string; parcel_summary: string }
export interface IncidentLookups { staff: StaffOption[]; shipments: ShipmentOption[]; branches: { id: string; name: string }[] }
export interface IncidentService {
  list(session: IncidentSession, filters: Filters): Promise<ApiPaginationResponse<Incident>>;
  detail(session: IncidentSession, id: string): Promise<ApiSuccessResponse<Incident>>;
  options(session: IncidentSession): Promise<ApiSuccessResponse<IncidentLookups>>;
  create(session: IncidentSession, input: CreateIncident, key: string): Promise<ApiSuccessResponse<Incident>>;
  assign(session: IncidentSession, id: string, input: Assignment, key: string): Promise<ApiSuccessResponse<Incident>>;
  handoff(session: IncidentSession, id: string, version: number, key: string): Promise<ApiSuccessResponse<Incident>>;
}
