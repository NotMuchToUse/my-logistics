import { API_BLOCKED } from '../constants/shipmentIncidents.constants.ts';
import { IncidentError } from '../utils/incidentErrors.ts';
import type { IncidentService } from '../types/shipmentIncidents.types.ts';

export function selectIncidentService(mockMode: boolean, mock: IncidentService): IncidentService {
  const blocked = async (): Promise<never> => { throw new IncidentError('API_CONTRACT_BLOCKED', API_BLOCKED); };
  return mockMode ? mock : { list: blocked, detail: blocked, options: blocked, create: blocked, assign: blocked, handoff: blocked };
}
