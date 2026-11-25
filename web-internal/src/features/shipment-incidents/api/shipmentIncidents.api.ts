import { USE_MOCK } from '@/core/api/axiosClient';
import fixture from '@/mocks/shipmentIncidents.mock.json';
import { createIncidentMock } from './shipmentIncidents.mock.ts';
import { incidentSchema } from '../schemas/shipmentIncidents.schema.ts';
import { selectIncidentService } from './shipmentIncidents.gateway.ts';

// No HTTP calls until IncidentCompensation/routes.php and its DTOs are implemented.
// Confirmed requests must use core axiosClient; never fall back to Mock on an API error.
export const incidentService = selectIncidentService(USE_MOCK, createIncidentMock(fixture.list_response.data.map(row => incidentSchema.parse(row)), fixture.success_response.data));
