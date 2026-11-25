import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FIELD_CLASS, TYPE_LABELS } from '../constants/shipmentIncidents.constants.ts';
import { assignmentSchema } from '../schemas/shipmentIncidents.schema.ts';
import { incidentError } from '../utils/incidentErrors.ts';
import { useIncidentMutation } from '../hooks/useIncidentMutation';
import type { EvidenceRegistry } from '../utils/evidence.ts';
import type { Assignment, Incident, IncidentLookups, IncidentService, IncidentSession } from '../types/shipmentIncidents.types.ts';
import { EvidenceImage, IncidentSeverityBadge, IncidentStatusBadge } from './IncidentPresentation';
import { displayDate } from '../utils/displayDate';

interface Props { id: string; service: IncidentService; session: IncidentSession; options: IncidentLookups; registry: EvidenceRegistry; onClose: () => void; onSaved: () => void; onRefresh: () => void }
export function IncidentDetailDialog(props: Props) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ revision: number; id: string; row: Incident | null; error: string } | null>(null);
  const current = result?.revision === revision && result.id === props.id ? result : null;
  const row = current?.row ?? null;
  const error = current?.error ?? '';
  const [editing, setEditing] = useState(false);
  const [handoff, setHandoff] = useState(false);
  useEffect(() => {
    let active = true;
    props.service.detail(props.session, props.id).then(response => { if (active) setResult({ revision, id: props.id, row: response.data, error: '' }); }).catch(failure => { if (active) setResult({ revision, id: props.id, row: null, error: incidentError(failure).message }); });
    return () => { active = false; };
  }, [props.service, props.session, props.id, revision]);
  const reload = () => { setEditing(false); setHandoff(false); setRevision(v => v + 1); props.onRefresh(); };
  const saved = () => { reload(); props.onSaved(); };
  if (row && editing) return <AssignmentDialog key={`${row.public_id}:${row.version}`} row={row} {...props} onClose={() => setEditing(false)} onSaved={saved} onReload={reload} />;
  if (row && handoff) return <HandoffDialog row={row} {...props} onClose={() => setHandoff(false)} onSaved={saved} onReload={reload} />;
  const staff = (id: string | null) => id ? props.options.staff.find(s => s.id === id)?.full_name ?? 'Chưa có thông tin' : 'Chưa xác định';
  return <Dialog open onOpenChange={open => { if (!open) props.onClose(); }}><DialogContent className="max-w-2xl"><DialogTitle>Chi tiết sự cố</DialogTitle><DialogDescription>Thông tin hồ sơ và chứng từ hiện trường.</DialogDescription>{error ? <div role="alert">{error}<Button variant="outline" onClick={() => setRevision(v => v + 1)}>Thử lại</Button></div> : !row ? <Skeleton className="h-64" /> : <>
    <div className="flex flex-wrap gap-2"><span className="font-mono text-sm font-medium">{row.incident_code}</span><IncidentStatusBadge value={row.status} /><IncidentSeverityBadge value={row.severity} /></div>
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{[
      ['Vận đơn', props.options.shipments.find(s => s.id === row.shipment_id)?.tracking_code ?? 'Chưa có thông tin'],
      ['Chi nhánh', props.options.branches.find(b => b.id === row.branch_id)?.name ?? 'Chưa có thông tin'],
      ['Loại sự cố', TYPE_LABELS[row.incident_type]], ['Người báo cáo', staff(row.reported_by)], ['Người thụ lý', staff(row.assigned_handler_id)], ['Người chịu trách nhiệm', staff(row.responsible_user_id)],
      ['Thời gian báo cáo', displayDate(row.created_at)], ['Cập nhật', displayDate(row.updated_at)], ['Thời điểm xử lý', displayDate(row.resolved_at)],
    ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>
    <div><h3 className="font-medium">Mô tả</h3><p className="whitespace-pre-wrap break-words text-sm">{row.description}</p></div><div><h3 className="font-medium">Ghi chú xử lý</h3><p className="whitespace-pre-wrap break-words text-sm">{row.resolution_note || 'Chưa có'}</p></div>
    <div><h3 className="mb-2 font-medium">Ảnh chứng từ</h3>{!row.evidence_urls?.length ? <p className="text-sm text-muted-foreground">Chưa có ảnh chứng từ.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{row.evidence_urls.map((url, i) => <EvidenceImage key={`${url}:${i}`} evidence={url} registry={props.registry} name={`Chứng từ ${i + 1}`} />)}</div>}</div>
    <DialogFooter><Button variant="outline" onClick={props.onClose}>Đóng</Button>{['open', 'investigating'].includes(row.status) && <><Button variant="outline" disabled={!props.session.capabilities.assign} onClick={() => setEditing(true)}>Gán trách nhiệm</Button><Button disabled={!props.session.capabilities.handoff} onClick={() => setHandoff(true)}>Chuyển đề xuất đền bù</Button></>}</DialogFooter>
  </>}</DialogContent></Dialog>;
}

function AssignmentDialog({ row, service, session, options, onClose, onSaved, onReload }: Props & { row: Incident; onReload: () => void }) {
  const form = useForm<Assignment>({ resolver: zodResolver(assignmentSchema), defaultValues: { responsible_user_id: row.responsible_user_id, resolution_note: row.resolution_note ?? '', version: row.version } });
  const responsibleId = useWatch({ control: form.control, name: 'responsible_user_id' });
  const [query, setQuery] = useState('');
  const mutation = useIncidentMutation((data: Assignment, key) => service.assign(session, row.public_id, data, key), session.key, onSaved);
  const conflict = mutation.error?.code === '409_VERSION_CONFLICT';
  const locked = mutation.busy || mutation.uncertain || conflict;
  useEffect(() => {
    if (mutation.error?.code === '422_VALIDATION_ERROR') for (const [field, messages] of Object.entries(mutation.error.details)) if (field in form.getValues()) form.setError(field as keyof Assignment, { message: messages.join(' ') });
  }, [mutation.error, form]);
  return <Dialog open onOpenChange={open => { if (!open && !mutation.busy && !mutation.uncertain) onClose(); }}><DialogContent className="max-w-2xl" showCloseButton={!mutation.busy && !mutation.uncertain}><DialogTitle>Gán người chịu trách nhiệm</DialogTitle><DialogDescription><span className="font-mono">{row.incident_code} · {options.shipments.find(s => s.id === row.shipment_id)?.tracking_code}</span> · {TYPE_LABELS[row.incident_type]}</DialogDescription><IncidentSeverityBadge value={row.severity} /><p className="text-sm">Hiện tại: {options.staff.find(s => s.id === row.responsible_user_id)?.full_name ?? 'Chưa xác định'}</p><form className="space-y-4" onSubmit={form.handleSubmit(data => mutation.submit(data))}><fieldset disabled={locked} className="space-y-3"><label htmlFor="staff-search">Tìm nhân viên</label><Input id="staff-search" value={query} onChange={e => setQuery(e.target.value)} /><label htmlFor="responsible-user">Người chịu trách nhiệm</label><select id="responsible-user" className={FIELD_CLASS} {...form.register('responsible_user_id', { setValueAs: value => value || null })}><option value="">Chưa xác định</option>{options.staff.filter(s => `${s.full_name} ${s.employee_code}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) || s.id === responsibleId).map(s => <option key={s.id} value={s.id}>{s.employee_code} — {s.full_name}</option>)}</select><label htmlFor="resolution-note">Ghi chú xử lý</label><textarea id="resolution-note" rows={4} className={FIELD_CLASS} {...form.register('resolution_note')} /></fieldset>{Object.entries(form.formState.errors).map(([field, value]) => <p role="alert" key={field} className="text-sm text-destructive">{value.message}</p>)}{mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}<DialogFooter><Button type="button" variant="outline" disabled={mutation.busy || mutation.uncertain} onClick={onClose}>Hủy</Button>{conflict ? <Button type="button" onClick={onReload}>Tải lại hồ sơ</Button> : mutation.uncertain ? <Button type="button" disabled={mutation.busy} onClick={() => mutation.submit(form.getValues(), true)}>Thử lại lượt gửi</Button> : <Button type="submit" disabled={locked}>Lưu thay đổi</Button>}</DialogFooter></form></DialogContent></Dialog>;
}

function HandoffDialog({ row, service, session, onClose, onSaved, onReload }: Props & { row: Incident; onReload: () => void }) {
  const mutation = useIncidentMutation((version: number, key) => service.handoff(session, row.public_id, version, key), session.key, onSaved);
  const conflict = mutation.error?.code === '409_VERSION_CONFLICT';
  const locked = mutation.busy || mutation.uncertain;
  return <Dialog open onOpenChange={open => { if (!open && !locked) onClose(); }}><DialogContent showCloseButton={!locked}><DialogTitle>Xác nhận chuyển đề xuất đền bù</DialogTitle><DialogDescription>Chuyển hồ sơ {row.incident_code} sang bước đề xuất đền bù?</DialogDescription><p className="text-sm">Mô phỏng chuyển tiếp. Chưa tạo hồ sơ tài chính, chưa phê duyệt hoặc ghi nhận chi phí. Tích hợp thực tế chờ KHA-35/KHA-49.</p>{mutation.error && <p role="alert">{mutation.error.message}</p>}<DialogFooter><Button variant="outline" disabled={locked} onClick={onClose}>Hủy</Button>{conflict ? <Button onClick={onReload}>Tải lại hồ sơ</Button> : <Button disabled={mutation.busy} onClick={() => mutation.submit(row.version, mutation.uncertain)}>{mutation.uncertain ? 'Thử lại lượt gửi' : 'Xác nhận chuyển (Mock)'}</Button>}</DialogFooter></DialogContent></Dialog>;
}
