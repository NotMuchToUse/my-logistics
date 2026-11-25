import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CREATE_TYPES, FIELD_CLASS, SEVERITIES, SEVERITY_LABELS, TYPE_LABELS } from '../constants/shipmentIncidents.constants.ts';
import { createIncidentSchema } from '../schemas/shipmentIncidents.schema.ts';
import { useIncidentMutation } from '../hooks/useIncidentMutation';
import type { CreateIncident, IncidentLookups, IncidentService, IncidentSession } from '../types/shipmentIncidents.types.ts';
import type { EvidenceRegistry } from '../utils/evidence.ts';
import { IncidentEvidenceUploader } from './IncidentEvidenceUploader';

export function CreateIncidentDialog({ service, session, options, registry, onClose, onSaved }: { service: IncidentService; session: IncidentSession; options: IncidentLookups; registry: EvidenceRegistry; onClose: () => void; onSaved: () => void }) {
  const form = useForm<CreateIncident>({ resolver: zodResolver(createIncidentSchema), defaultValues: { shipment_id: '', incident_type: 'damaged', severity: 'medium', description: '', evidence_urls: [] } });
  const [query, setQuery] = useState('');
  const committed = useRef(false);
  const retained = useRef<string[]>([]);
  const evidence = useWatch({ control: form.control, name: 'evidence_urls' });
  const shipmentId = useWatch({ control: form.control, name: 'shipment_id' });
  useEffect(() => { retained.current = evidence; }, [evidence]);
  useEffect(() => () => { if (!committed.current) for (const url of retained.current) registry.remove(url); }, [registry]);
  const mutation = useIncidentMutation((payload: CreateIncident, key) => service.create(session, payload, key), session.key, () => { committed.current = true; onSaved(); });
  useEffect(() => {
    if (mutation.error?.code === '422_VALIDATION_ERROR') for (const [field, messages] of Object.entries(mutation.error.details)) if (field in form.getValues()) form.setError(field as keyof CreateIncident, { message: messages.join(' ') });
  }, [mutation.error, form]);
  const locked = mutation.busy || mutation.uncertain;
  return <Dialog open onOpenChange={open => { if (!open && !locked) onClose(); }}><DialogContent className="max-w-2xl" showCloseButton={!locked}><DialogTitle>Tạo báo cáo sự cố</DialogTitle><DialogDescription>Ghi nhận tình trạng hàng hóa trong phạm vi đang chọn.</DialogDescription><form onSubmit={form.handleSubmit(data => mutation.submit(data))} className="space-y-4">
    <fieldset disabled={locked} className="space-y-4">
      <div className="space-y-2"><label htmlFor="shipment-search">Tìm vận đơn</label><Input id="shipment-search" className="text-base sm:text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nhập mã vận đơn" /><label htmlFor="shipment-id">Vận đơn gặp sự cố</label><select id="shipment-id" className={FIELD_CLASS} {...form.register('shipment_id')}><option value="">Chọn vận đơn</option>{options.shipments.filter(s => s.tracking_code.toLowerCase().includes(query.toLowerCase()) || s.id === shipmentId).map(s => <option key={s.id} value={s.id}>{s.tracking_code} — {s.parcel_summary}</option>)}</select></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="incident-type">Loại sự cố</label><select id="incident-type" className={FIELD_CLASS} {...form.register('incident_type')}>{CREATE_TYPES.map(value => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}</select></div><div><label htmlFor="incident-severity">Mức độ</label><select id="incident-severity" className={FIELD_CLASS} {...form.register('severity')}>{SEVERITIES.map(value => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}</select></div></div>
      <div><label htmlFor="incident-description">Mô tả sự cố</label><textarea id="incident-description" rows={4} className={FIELD_CLASS} {...form.register('description')} /></div>
      <IncidentEvidenceUploader registry={registry} value={evidence} onChange={urls => form.setValue('evidence_urls', urls, { shouldValidate: true })} disabled={locked} />
    </fieldset>
    {Object.entries(form.formState.errors).map(([field, error]) => <p key={field} role="alert" className="text-sm text-destructive">{error.message}</p>)}
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={locked}>Hủy</Button>{mutation.uncertain ? <Button type="button" disabled={mutation.busy} onClick={() => mutation.submit(form.getValues(), true)}>Thử lại lượt gửi</Button> : <Button type="submit" disabled={mutation.busy}>{mutation.busy ? 'Đang lưu…' : 'Lưu báo cáo'}</Button>}</DialogFooter>
  </form></DialogContent></Dialog>;
}
