import { useMemo } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { USE_MOCK } from '@/core/api/axiosClient';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { getScopeKey, useBranchScopeStore } from '@/core/stores/useBranchScopeStore';
import { incidentService } from '../api/shipmentIncidents.api';
import { API_BLOCKED } from '../constants/shipmentIncidents.constants.ts';
import { IncidentWorkspace } from '../components/IncidentWorkspace';
import type { IncidentSession } from '../types/shipmentIncidents.types.ts';

export function ShipmentIncidentsPage() {
  const auth = useAuthStore();
  const branch = useBranchScopeStore();
  const session = useMemo<IncidentSession>(() => ({
    key: JSON.stringify([auth.user?.public_id, auth.token, auth.permissions, branch.activeScope && getScopeKey(branch.activeScope), branch.scopes]),
    actorId: null, authenticated: auth.isAuthenticated, branchId: branch.activeBranchId === null ? null : String(branch.activeBranchId),
    scopeType: branch.activeScope?.scope_type ?? '', allowedBranchIds: branch.scopes.filter(s => s.branch_id !== null && ['branch', 'post_office'].includes(s.scope_type)).map(s => String(s.branch_id)),
    capabilities: { read: auth.permissions.includes('compensation.read'), create: false, assign: false, handoff: false },
  }), [auth.user, auth.token, auth.permissions, auth.isAuthenticated, branch.activeScope, branch.activeBranchId, branch.scopes]);
  if (!session.authenticated || !session.capabilities.read) return <EmptyState title="Không có quyền xem sự cố" description="Tài khoản cần quyền xem hồ sơ sự cố trong phạm vi được cấp." />;
  if (!USE_MOCK) return <EmptyState title="Tích hợp chưa sẵn sàng" description={API_BLOCKED} />;
  return <IncidentWorkspace key={session.key} service={incidentService} session={session} />;
}
