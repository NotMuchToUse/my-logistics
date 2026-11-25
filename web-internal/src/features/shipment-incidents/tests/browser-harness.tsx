import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import '@/index.css';
import fixture from '@/mocks/shipmentIncidents.mock.json';
import { incidentSchema } from '../schemas/shipmentIncidents.schema.ts';
import { createIncidentMock } from '../api/shipmentIncidents.mock.ts';
import { IncidentWorkspace } from '../components/IncidentWorkspace';
import type { IncidentService, IncidentSession } from '../types/shipmentIncidents.types.ts';
import { IncidentError } from '../utils/incidentErrors.ts';

const api = createIncidentMock(fixture.list_response.data.map(row => incidentSchema.parse(row)), fixture.success_response.data);
let fault = '';
let delay = 0;
const service: IncidentService = {
  ...api,
  async list(session, filters) {
    const result = await api.list(session, filters);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (fault === 'list') { fault = ''; throw new Error('Simulated network loss'); }
    return result;
  },
  async create(session, input, key) {
    if (fault === 'validation') { fault = ''; throw new IncidentError('422_VALIDATION_ERROR', 'Kiểm tra dữ liệu', { description: ['Mô tả cần xác minh (Mock)'] }); }
    const result = await api.create(session, input, key);
    if (fault === 'timeout') { fault = ''; throw new Error('Simulated response loss after commit'); }
    return result;
  },
  async assign(session, id, input, key) {
    if (fault === 'conflict') { fault = ''; await api.assign(session, id, { ...input, resolution_note: 'Đã cập nhật bởi phiên khác' }, crypto.randomUUID()); }
    return api.assign(session, id, input, key);
  },
};
export function Harness() {
  const [branch, setBranch] = useState('3');
  const [allowed, setAllowed] = useState(true);
  const session = useMemo<IncidentSession>(() => ({ key: `test:${branch}:${allowed}`, actorId: branch === '3' ? '21' : '23', authenticated: true, branchId: branch, scopeType: 'branch', allowedBranchIds: ['3', '4'], capabilities: { read: allowed, create: allowed, assign: allowed, handoff: allowed } }), [branch, allowed]);
  return <main className="min-w-0 p-4 sm:p-6"><div className="mb-4 flex flex-wrap gap-2 rounded border p-2 text-sm" data-testid="harness"><button onClick={() => setBranch(branch === '3' ? '4' : '3')}>Test đổi chi nhánh</button><button onClick={() => setAllowed(!allowed)}>Test quyền</button><button onClick={() => { fault = 'timeout'; }}>Test timeout</button><button onClick={() => { fault = 'validation'; }}>Test 422</button><button onClick={() => { fault = 'conflict'; }}>Test conflict</button><button onClick={() => { fault = 'list'; }}>Test list error</button><button onClick={() => { delay = 700; }}>Test stale response</button></div><IncidentWorkspace key={session.key} session={session} service={service} /><Toaster /></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
