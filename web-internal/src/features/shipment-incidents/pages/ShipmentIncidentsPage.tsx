import { useMemo } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { USE_MOCK } from '@/core/api/axiosClient';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { useBranchScopeStore } from '@/core/stores/useBranchScopeStore';
import { incidentService } from '../api/shipmentIncidents.api';
import { API_BLOCKED } from '../constants/shipmentIncidents.constants.ts';
import { IncidentWorkspace } from '../components/IncidentWorkspace';
import type { IncidentSession } from '../types/shipmentIncidents.types.ts';

export function ShipmentIncidentsPage() {
  const auth = useAuthStore();
  const branch = useBranchScopeStore();
  const canRead = USE_MOCK || auth.permissions.includes('compensation.read');
  const mockBranchId = branch.activeScope && ['branch', 'post_office'].includes(branch.activeScope.scope_type)
    ? branch.activeScope.branch_id
    : branch.scopes.find(scope => ['branch', 'post_office'].includes(scope.scope_type))?.branch_id ?? null;
  const activeBranchId = USE_MOCK ? mockBranchId : branch.activeBranchId;
  const activeScopeType = USE_MOCK && activeBranchId !== branch.activeBranchId
    ? branch.scopes.find(scope => scope.branch_id === activeBranchId && ['branch', 'post_office'].includes(scope.scope_type))?.scope_type ?? ''
    : branch.activeScope?.scope_type ?? '';
  const session = useMemo<IncidentSession>(() => ({
    key: JSON.stringify([auth.user?.public_id, auth.token, auth.permissions, activeBranchId, activeScopeType, branch.scopes]),
    actorId: USE_MOCK ? (activeBranchId === 4 ? '23' : '21') : null, authenticated: auth.isAuthenticated, branchId: activeBranchId === null ? null : String(activeBranchId),
    scopeType: activeScopeType, allowedBranchIds: branch.scopes.filter(s => s.branch_id !== null && ['branch', 'post_office'].includes(s.scope_type)).map(s => String(s.branch_id)),
    capabilities: {
      read: canRead,
      create: USE_MOCK && canRead,
      assign: USE_MOCK && canRead,
      handoff: USE_MOCK && canRead,
    },
  }), [auth.user, auth.token, auth.permissions, auth.isAuthenticated, activeBranchId, activeScopeType, branch.scopes, canRead]);
  if (!session.authenticated || !session.capabilities.read) return <EmptyState title="Không có quyền xem sự cố" description="Tài khoản cần quyền xem hồ sơ sự cố trong phạm vi được cấp." />;
  if (!USE_MOCK) return <EmptyState title="Tích hợp chưa sẵn sàng" description={API_BLOCKED} />;
  return <IncidentWorkspace key={session.key} service={incidentService} session={session} />;
}
