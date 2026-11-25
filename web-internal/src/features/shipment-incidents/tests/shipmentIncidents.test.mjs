import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIncidentMock } from '../api/shipmentIncidents.mock.ts';
import { selectIncidentService } from '../api/shipmentIncidents.gateway.ts';
import { createIncidentSchema, incidentSchema, DEFAULT_FILTERS } from '../schemas/shipmentIncidents.schema.ts';
import { INCIDENT_TYPES, SEVERITIES, STATUSES } from '../constants/shipmentIncidents.constants.ts';
import { createPendingOperation } from '../utils/pendingOperation.ts';
import { createEvidenceRegistry, validateEvidence } from '../utils/evidence.ts';
import { incidentError, IncidentError } from '../utils/incidentErrors.ts';

const fixture = JSON.parse(readFileSync(new URL('../../../mocks/shipmentIncidents.mock.json', import.meta.url), 'utf8'));
const seed = fixture.list_response.data;
const options = fixture.success_response.data;
const mock = () => createIncidentMock(seed, options);
const session = (overrides = {}) => ({ key: 'test:3', authenticated: true, actorId: '21', branchId: '3', scopeType: 'branch', allowedBranchIds: ['3', '4'], capabilities: { read: true, create: true, assign: true, handoff: true }, ...overrides });
const payload = (overrides = {}) => ({ shipment_id: '10', incident_type: 'damaged', severity: 'medium', description: '  Kiện hàng bị hỏng  ', evidence_urls: [], ...overrides });
const key = () => crypto.randomUUID();
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('fixture parses every enum, nullable evidence and large IDs losslessly', () => {
  seed.forEach(row => incidentSchema.parse(row));
  for (const [field, values] of [['incident_type', INCIDENT_TYPES], ['severity', SEVERITIES], ['status', STATUSES]]) assert.deepEqual(new Set(seed.map(row => row[field])), new Set(values));
  assert.equal(incidentSchema.parse({ ...seed[0], id: '18446744073709551615' }).id, '18446744073709551615');
  assert.ok(seed.some(row => row.evidence_urls === null)); assert.ok(seed.some(row => row.evidence_urls?.length === 0)); assert.ok(seed.some(row => row.evidence_urls?.length > 1));
});
test('pagination and branch partition are applied before page slicing', async () => {
  const api = mock(); const first = await api.list(session(), DEFAULT_FILTERS);
  assert.equal(first.data.length, 20); assert.equal(first.meta.pagination.total, 24);
  assert.equal((await api.list(session(), { ...DEFAULT_FILTERS, page: 2 })).data.length, 4);
  assert.ok(first.data.every(row => row.branch_id === '3'));
  const other = await api.list(session({ key: 'test:4', branchId: '4', scopeType: 'post_office' }), DEFAULT_FILTERS);
  assert.equal(other.meta.pagination.total, 4); assert.ok(other.data.every(row => row.branch_id === '4'));
});
test('list searches incident and tracking codes and combines filters', async () => {
  const api = mock();
  assert.equal((await api.list(session(), { ...DEFAULT_FILTERS, search: seed[0].incident_code })).data.length, 1);
  assert.equal((await api.list(session(), { ...DEFAULT_FILTERS, search: 'VS26112500010' })).meta.pagination.total, 12);
  const result = await api.list(session(), { ...DEFAULT_FILTERS, incident_type: 'lost', severity: 'medium', status: 'investigating', responsible_user_id: '22' });
  assert.ok(result.data.length); assert.ok(result.data.every(row => row.incident_type === 'lost' && row.severity === 'medium' && row.status === 'investigating'));
  assert.equal((await api.list(session(), { ...DEFAULT_FILTERS, search: 'missing' })).meta.pagination.total_pages, 0);
});
test('unauthorized, missing permission and unsupported or ungranted scopes fail closed', async () => {
  const api = mock();
  await rejects(api.list(session({ authenticated: false }), DEFAULT_FILTERS), '401_UNAUTHORIZED');
  await rejects(api.list(session({ capabilities: { read: false } }), DEFAULT_FILTERS), '403_FORBIDDEN');
  for (const overrides of [{ branchId: null }, { branchId: '99' }, { scopeType: 'warehouse' }, { scopeType: 'hq_all' }, { scopeType: 'region_center' }]) await rejects(api.list(session(overrides), DEFAULT_FILTERS), '403_BRANCH_SCOPE');
  await rejects(api.detail(session(), seed[24].public_id), '404_NOT_FOUND');
  await rejects(api.detail(session(), '100'), '422_VALIDATION_ERROR');
});
test('lookups only expose eligible staff and shipments in selected scope', async () => {
  const result = (await mock().options(session())).data;
  assert.deepEqual(result.staff.map(s => s.id), ['21', '22']);
  assert.deepEqual(result.shipments.map(s => s.id), ['10', '11']);
});
for (const type of ['damaged', 'lost', 'wet_contaminated']) test(`creates ${type}, trims description and leaves responsibility unassigned`, async () => {
  const api = mock(); const created = (await api.create(session(), payload({ incident_type: type }), key())).data;
  assert.equal(created.description, 'Kiện hàng bị hỏng'); assert.equal(created.status, 'open'); assert.equal(created.version, 1);
  assert.equal(created.responsible_user_id, null); assert.equal(created.reported_by, '21');
  assert.equal((await api.list(session(), DEFAULT_FILTERS)).meta.pagination.total, 25);
});
test('create rejects whitespace, missing/out-of-scope shipment, response fields and non-task enums', async () => {
  const api = mock();
  for (const input of [{ description: '   ' }, { shipment_id: '' }, { shipment_id: '12' }, { incident_type: 'other' }, { severity: 'urgent' }, { reported_by: '999' }, { branch_id: '4' }]) await rejects(api.create(session(), payload(input), key()), '422_VALIDATION_ERROR');
  assert.equal(createIncidentSchema.parse(payload()).severity, 'medium');
});
test('evidence payload rejects blobs, base64 and dangerous protocols', async () => {
  for (const url of ['blob:abc', 'data:image/png;base64,abc', 'javascript:alert(1)', 'https://user:password@example.test/a']) await rejects(mock().create(session(), payload({ evidence_urls: [url] }), key()), '422_VALIDATION_ERROR');
  const urls = ['https://incident.mock.invalid/evidence/a', 'https://incident.mock.invalid/evidence/b'];
  assert.deepEqual((await mock().create(session(), payload({ evidence_urls: urls }), key())).data.evidence_urls, urls);
});
test('create replay is deduplicated and changed payload with same UUID is rejected', async () => {
  const api = mock(); const uuid = key(); const first = await api.create(session(), payload(), uuid);
  assert.deepEqual((await api.create(session(), payload(), uuid)).data, first.data);
  assert.equal((await api.list(session(), DEFAULT_FILTERS)).meta.pagination.total, 25);
  await rejects(api.create(session(), payload({ description: 'changed' }), uuid), '409_IDEMPOTENCY_DUPLICATE');
  await rejects(api.create(session(), payload(), 'bad-key'), '400_BAD_REQUEST');
});
test('assignment increments version without changing reporter or handler; allows mock unassignment', async () => {
  const api = mock(); const row = seed[0];
  const assigned = (await api.assign(session(), row.public_id, { responsible_user_id: '22', resolution_note: 'Kiểm tra bàn giao', version: 1 }, key())).data;
  assert.equal(assigned.version, 2); assert.equal(assigned.status, 'investigating'); assert.equal(assigned.reported_by, row.reported_by); assert.equal(assigned.assigned_handler_id, row.assigned_handler_id);
  const removed = (await api.assign(session(), row.public_id, { responsible_user_id: null, resolution_note: '', version: 2 }, key())).data;
  assert.equal(removed.responsible_user_id, null); assert.equal(removed.version, 3);
});
test('assignment rejects customer, inactive/outside staff, read-only state and permission denial', async () => {
  const api = mock();
  for (const id of ['23', '24', '25', '999']) await rejects(api.assign(session(), seed[0].public_id, { responsible_user_id: id, resolution_note: '', version: 1 }, key()), '422_VALIDATION_ERROR');
  for (const row of seed.filter(r => r.branch_id === '3' && ['closed', 'resolved', 'compensation_requested'].includes(r.status))) await rejects(api.assign(session(), row.public_id, { responsible_user_id: '22', resolution_note: '', version: 1 }, key()), '422_VALIDATION_ERROR');
  await rejects(api.assign(session({ capabilities: { read: true, assign: false } }), seed[0].public_id, { responsible_user_id: '22', resolution_note: '', version: 1 }, key()), '403_FORBIDDEN');
});
test('concurrent assignment rejects stale version without overwrite', async () => {
  const api = mock(); const id = seed[0].public_id;
  await api.assign(session(), id, { responsible_user_id: '22', resolution_note: 'first', version: 1 }, key());
  await rejects(api.assign(session(), id, { responsible_user_id: '21', resolution_note: 'stale', version: 1 }, key()), '409_VERSION_CONFLICT');
  const current = (await api.detail(session(), id)).data; assert.equal(current.responsible_user_id, '22'); assert.equal(current.resolution_note, 'first');
});
test('handoff permits unassigned records, is idempotent and rejects terminal/forbidden cases', async () => {
  const api = mock(); const id = seed[0].public_id; const uuid = key();
  const result = await api.handoff(session(), id, 1, uuid);
  assert.equal(result.data.status, 'compensation_requested'); assert.equal(result.data.responsible_user_id, null);
  assert.deepEqual((await api.handoff(session(), id, 1, uuid)).data, result.data);
  await rejects(api.handoff(session(), id, 2, key()), '422_VALIDATION_ERROR');
  await rejects(api.handoff(session({ capabilities: { read: true, handoff: false } }), seed[1].public_id, 1, key()), '403_FORBIDDEN');
});
test('API mode blocks every operation and never invokes mock', async () => {
  let calls = 0; const api = selectIncidentService(false, new Proxy({}, { get: () => () => { calls++; } }));
  for (const method of ['list', 'detail', 'options', 'create', 'assign', 'handoff']) await rejects(api[method](), 'API_CONTRACT_BLOCKED');
  assert.equal(calls, 0);
});
test('ambiguous timeout keeps exact payload and key; retry avoids duplicate create', async () => {
  const api = mock(); const calls = []; let first = true;
  const operation = createPendingOperation(async (data, uuid) => { calls.push([data, uuid]); const result = await api.create(session(), data, uuid); if (first) { first = false; throw new Error('timeout'); } return result; }, () => 'scope3');
  await rejects(operation.run(payload()), 'OUTCOME_UNKNOWN'); assert.ok(operation.pending);
  await rejects(operation.run(payload({ description: 'changed' })), 'OUTCOME_UNKNOWN');
  await operation.run(payload({ description: 'ignored during retry' }), true);
  assert.deepEqual(calls[0], calls[1]); assert.equal(operation.pending, false);
  assert.equal((await api.list(session(), DEFAULT_FILTERS)).meta.pagination.total, 25);
});
test('double submit is synchronously blocked and old context response cannot succeed', async () => {
  let finish; let scope = '3';
  const operation = createPendingOperation(() => new Promise(resolve => { finish = resolve; }), () => scope);
  const pending = operation.run(payload());
  await rejects(operation.run(payload()), 'BUSY'); scope = '4'; finish({}); await rejects(pending, 'CONTEXT_CHANGED');
});
test('422 and conflict release pending operation; unknown and rate-limit errors retain it', async () => {
  for (const [code, retained] of [['422_VALIDATION_ERROR', false], ['409_VERSION_CONFLICT', false], ['429_TOO_MANY_REQUESTS', true], ['500_INTERNAL_ERROR', true], ['409_IDEMPOTENCY_DUPLICATE', true]]) {
    const operation = createPendingOperation(async () => { throw new IncidentError(code, 'error'); }, () => '3');
    await rejects(operation.run(payload()), code); assert.equal(operation.pending, retained);
  }
});
test('upload whitelist accepts three MIME types and rejects empty, oversized and executable names', () => {
  for (const [type, name] of [['image/jpeg', 'photo.jpg'], ['image/png', 'photo.png'], ['image/webp', 'photo.webp']]) assert.equal(validateEvidence({ type, name, size: 100 }), null);
  for (const file of [{ type: 'image/svg+xml', name: 'x.svg', size: 1 }, { type: 'image/png', name: 'x.php.png', size: 1 }, { type: 'image/png', name: 'x.png', size: 0 }, { type: 'image/png', name: 'x.png', size: 5 * 1024 * 1024 + 1 }]) assert.ok(validateEvidence(file));
});
test('evidence preview is distinct from payload and cleanup revokes each live URL once', () => {
  let n = 0; const revoked = []; const registry = createEvidenceRegistry({ createObjectURL: () => `blob:test-${++n}`, revokeObjectURL: url => revoked.push(url) });
  const file = new File(['png'], 'photo.png', { type: 'image/png' }); const a = registry.add(file); const b = registry.add(file);
  assert.ok(a.startsWith('https://incident.mock.invalid/')); assert.equal(registry.preview(a), 'blob:test-1');
  registry.remove(a); registry.remove(a); assert.equal(registry.preview(b), 'blob:test-2'); registry.dispose(); registry.dispose();
  assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2']);
});
test('error adapter retains field errors but hides raw server details', () => {
  for (const code of ['400_BAD_REQUEST', '401_UNAUTHORIZED', '403_FORBIDDEN', '403_BRANCH_SCOPE', '404_NOT_FOUND', '409_VERSION_CONFLICT', '409_IDEMPOTENCY_DUPLICATE', '422_VALIDATION_ERROR', '429_TOO_MANY_REQUESTS', '500_INTERNAL_ERROR']) {
    const error = incidentError({ success: false, error: { code, message: 'SQL SELECT secret', details: { description: ['Required'] } } });
    assert.equal(error.code, code); assert.ok(!error.message.includes('SQL')); assert.deepEqual(error.details.description, ['Required']);
  }
});
