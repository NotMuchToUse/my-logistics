import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickupSchema } from '../schemas/pickup.schema.ts';
import { createMockPickupService, DEMO_ADDRESSES, DEMO_BRANCHES, DEMO_CUSTOMER, eligibleBranches, ownedAddresses, normalizeDraft } from '../api/pickup.mock.ts';

const draft = { handoverMode: 'driver_pickup', addressId: '1', branchPublicId: '', parcelCount: 2, weightGram: 1500 };
for (const [name, field, value] of [
  ['TC17 zero parcels', 'parcelCount', 0], ['TC18 negative parcels', 'parcelCount', -1],
  ['TC19 fractional parcels', 'parcelCount', 1.5], ['TC20 zero weight', 'weightGram', 0],
  ['TC21 negative weight', 'weightGram', -1], ['TC22 empty number', 'weightGram', NaN],
  ['TC22 infinite number', 'weightGram', Infinity], ['integer gram storage', 'weightGram', 0.5],
]) test(name, () => assert.equal(pickupSchema.safeParse({ ...draft, [field]: value }).success, false));

test('TC09 address required', () => assert.equal(pickupSchema.safeParse({ ...draft, addressId: '' }).success, false));
test('TC15 branch required', () => assert.equal(pickupSchema.safeParse({ ...draft, handoverMode: 'counter_dropoff' }).success, false));
test('TC10 mock pickup success', () => {
  const result = createMockPickupService().create(DEMO_CUSTOMER.public_id, draft, 'pickup-key');
  assert.equal(result.status, 'pending'); assert.equal(result.handover_mode, 'driver_pickup');
  assert.equal(result.estimated_parcel_count, 2); assert.equal(result.estimated_weight_gram, 1500);
});
test('TC16 mock dropoff success', () => {
  const result = createMockPickupService().create(DEMO_CUSTOMER.public_id, { ...draft, handoverMode: 'counter_dropoff', branchPublicId: DEMO_BRANCHES[0].public_id }, 'dropoff-key');
  assert.equal(result.handover_mode, 'counter_dropoff');
});
test('TC08 unknown customer has no addresses', () => assert.deepEqual(createMockPickupService().options('other-customer').addresses, []));
test('TC31 ownership, sender role and deletion filter', () => {
  const items = [...DEMO_ADDRESSES, { ...DEMO_ADDRESSES[0], id: 8, customer_id: 999 }, { ...DEMO_ADDRESSES[0], id: 9, address_role: 'receiver' }, { ...DEMO_ADDRESSES[0], id: 10, deleted_at: '2026-11-23' }];
  assert.deepEqual(ownedAddresses(items, 101).map((item) => item.id), [1, 2]);
  assert.throws(() => createMockPickupService().create('other-customer', draft, 'key'), (error) => error.error.code === '403_FORBIDDEN');
  assert.throws(() => createMockPickupService().create(DEMO_CUSTOMER.public_id, { ...draft, addressId: '8' }, 'key'), (error) => error.error.code === '422_VALIDATION_ERROR');
});
test('Only active nondeleted dropoff branches with valid coordinates', () => {
  for (const change of [{ is_active: 0 }, { accepts_customer_dropoff: 0 }, { deleted_at: '2026-11-23' }, { latitude: NaN }, { longitude: 181 }]) {
    assert.equal(eligibleBranches([{ ...DEMO_BRANCHES[0], ...change }]).length, 0);
  }
});
test('TC29 replay same key returns same receipt; changed command is rejected', () => {
  const service = createMockPickupService();
  const result = service.create(DEMO_CUSTOMER.public_id, draft, 'same-key');
  assert.strictEqual(service.create(DEMO_CUSTOMER.public_id, draft, 'same-key'), result);
  assert.throws(() => service.create(DEMO_CUSTOMER.public_id, { ...draft, parcelCount: 3 }, 'same-key'), (error) => error.error.code === '409_IDEMPOTENCY_DUPLICATE');
});
test('TC32 inactive selection is removed from local command', () => {
  assert.equal(normalizeDraft({ ...draft, branchPublicId: 'old-branch' }).branchPublicId, '');
  assert.equal(normalizeDraft({ ...draft, handoverMode: 'counter_dropoff', branchPublicId: DEMO_BRANCHES[0].public_id }).addressId, '');
});
