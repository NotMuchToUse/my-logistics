import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateEvidence, type EvidenceRegistry } from '../utils/evidence.ts';
import { EvidenceImage } from './IncidentPresentation';

export function IncidentEvidenceUploader({ registry, value, onChange, disabled }: { registry: EvidenceRegistry; value: string[]; onChange: (urls: string[]) => void; disabled: boolean }) {
  const [files, setFiles] = useState<Record<string, { name: string; size: number }>>({});
  const [errors, setErrors] = useState<string[]>([]);
  return <section className="space-y-3"><label htmlFor="incident-evidence" className="text-sm font-medium">Ảnh chứng từ (JPEG, PNG, WebP; tối đa 5MB/ảnh)</label><Input id="incident-evidence" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => {
    const added: string[] = []; const rejected: string[] = []; const names = { ...files };
    for (const file of Array.from(event.target.files ?? [])) {
      const error = validateEvidence(file);
      if (error) { rejected.push(`${file.name}: ${error}`); continue; }
      try { const url = registry.add(file); added.push(url); names[url] = { name: file.name, size: file.size }; }
      catch { rejected.push(`${file.name}: Không thể tạo ảnh xem trước.`); }
    }
    setFiles(names); setErrors(rejected); onChange([...value, ...added]); event.target.value = '';
  }} /><p className="text-xs text-muted-foreground">Ảnh chỉ được giữ trong phiên Mock, chưa tải lên máy chủ.</p>{errors.map((error, i) => <p role="alert" className="text-sm text-destructive" key={i}>{error}</p>)}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{value.map(url => <div key={url} className="min-w-0 space-y-2 rounded-md border p-2"><EvidenceImage evidence={url} registry={registry} name={files[url]?.name ?? 'Ảnh chứng từ'} /><p className="break-all text-xs">{files[url]?.name} · {Math.ceil((files[url]?.size ?? 0) / 1024)} KB · Sẵn sàng mô phỏng</p><Button type="button" variant="outline" disabled={disabled} onClick={() => { registry.remove(url); onChange(value.filter(item => item !== url)); }}>Xóa ảnh</Button></div>)}</div></section>;
}
