import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants/shipmentIncidents.constants.ts';
import type { Incident } from '../types/shipmentIncidents.types.ts';
import type { EvidenceRegistry } from '../utils/evidence.ts';

export function IncidentStatusBadge({ value }: { value: Incident['status'] }) {
  const colors = { open: 'bg-slate-100 text-slate-700 border-slate-200', investigating: 'bg-blue-50 text-blue-700 border-blue-200', compensation_requested: 'bg-amber-50 text-amber-700 border-amber-200', resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200', closed: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge variant="outline" className={colors[value]}>{STATUS_LABELS[value]}</Badge>;
}
export function IncidentSeverityBadge({ value }: { value: Incident['severity'] }) {
  const colors = { low: 'bg-slate-100 text-slate-700 border-slate-200', medium: 'bg-blue-50 text-blue-700 border-blue-200', high: 'bg-amber-50 text-amber-700 border-amber-200', critical: 'bg-red-50 text-red-700 border-red-200' };
  return <Badge variant="outline" className={colors[value]}>{SEVERITY_LABELS[value]}</Badge>;
}
export function EvidenceImage({ evidence, registry, name }: { evidence: string; registry: EvidenceRegistry; name: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const preview = registry.preview(evidence);
  // Only session-owned object URLs are rendered in Mock. Remote evidence needs an approved upload origin.
  if (!preview || failed) return <div className="rounded border p-3 text-sm text-muted-foreground">{name}: ảnh không khả dụng trong phiên.</div>;
  return <><Button type="button" variant="ghost" className="h-auto w-full p-0" onClick={() => setExpanded(true)} aria-label={`Xem ảnh ${name}`}><img src={preview} alt={name} onError={() => setFailed(true)} className="h-28 w-full rounded object-contain" /></Button><Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-w-2xl"><DialogTitle>{name}</DialogTitle><DialogDescription>Ảnh chứng từ mô phỏng trong phiên.</DialogDescription><img src={preview} alt={name} className="max-h-[65vh] w-full object-contain" onError={() => setFailed(true)} /></DialogContent></Dialog></>;
}
