export function validateEvidence(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Chỉ nhận JPEG, PNG hoặc WebP.';
  if (!file.size) return 'Không nhận file rỗng.';
  if (file.size > 5 * 1024 * 1024) return 'Ảnh vượt giới hạn 5MB.';
  if (/(?:^|\.)(?:php\d*|phtml|phar|html?|svg|exe|com|bat|cmd|js|sh|ps1|scr)(?:\.|$)/i.test(file.name) || !/\.(?:jpe?g|png|webp)$/i.test(file.name)) return 'Tên file hoặc phần mở rộng không an toàn.';
  return null;
}

// Preview URLs live in memory only, independently from synthetic evidence identifiers.
export function createEvidenceRegistry(urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL) {
  const previews = new Map<string, string>();
  return {
    add(file: File) {
      const error = validateEvidence(file);
      if (error) throw new Error(error);
      const evidence = `https://incident.mock.invalid/evidence/${crypto.randomUUID()}`;
      previews.set(evidence, urls.createObjectURL(file)); return evidence;
    },
    preview(evidence: string) { return previews.get(evidence) ?? null; },
    remove(evidence: string) { const url = previews.get(evidence); if (url) urls.revokeObjectURL(url); previews.delete(evidence); },
    dispose() { for (const url of previews.values()) urls.revokeObjectURL(url); previews.clear(); },
  };
}
export type EvidenceRegistry = ReturnType<typeof createEvidenceRegistry>;
