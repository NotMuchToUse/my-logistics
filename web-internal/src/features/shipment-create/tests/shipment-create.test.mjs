import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parcelInputSchema, parcelListSchema, moneyInputSchema, contactSchema, shipmentDraftSchema, paymentMethodSchema } from '../schemas/shipment-create.schema.ts';
import { summarizeParcels } from '../utils/shipment-create.utils.ts';
const parcel = { lengthCm: 30, widthCm: 20, heightCm: 10, actualWeightGram: 1000 };
test('valid parcel and upper dimensional limit', () => {
  assert.equal(parcelInputSchema.safeParse(parcel).success, true);
  assert.equal(parcelInputSchema.safeParse({ ...parcel, lengthCm: 999999.99 }).success, true);
});
for (const value of [0, -1, NaN, Infinity, '', 1.001, 1000000]) test(`reject invalid dimension ${value}`, () => assert.equal(parcelInputSchema.safeParse({ ...parcel, lengthCm: value }).success, false));
for (const value of [0, -1, NaN, Infinity, '', 1.5, 4294967296]) test(`reject invalid weight ${value}`, () => assert.equal(parcelInputSchema.safeParse({ ...parcel, actualWeightGram: value }).success, false));
test('cannot have zero parcels', () => assert.equal(parcelListSchema.safeParse([]).success, false));
test('totals after deleting middle parcel', () => {
  const parcels = [1000, 1500, 2000].map((actualWeightGram) => ({ ...parcel, actualWeightGram }));
  assert.deepEqual(summarizeParcels(parcels), { count: 3, actualWeightGram: 4500 });
  parcels.splice(1, 1);
  assert.deepEqual(summarizeParcels(parcels), { count: 2, actualWeightGram: 3000 });
});
test('invalid and overflowing totals never display as valid', () => {
  for (const parcels of [[], [{}], [{ actualWeightGram: NaN }], [{ actualWeightGram: 4294967295 }, { actualWeightGram: 1 }]]) assert.equal(summarizeParcels(parcels).actualWeightGram, null);
});
test('money preserves cents, rejects empty and overflow', () => {
  for (const value of ['0', '250000', '9999999999999.99']) assert.equal(moneyInputSchema.safeParse(value).success, true);
  for (const value of ['', '-1', 'Infinity', '1e3', '1.001', '10000000000000']) assert.equal(moneyInputSchema.safeParse(value).success, false);
});
test('contact trims name and retains phone leading zero', () => {
  const contact = { name: ' Test ', phone: '0900000000', provinceId: 1, districtId: 2, wardId: 3, addressDetail: ' Test ' };
  assert.equal(contactSchema.parse(contact).phone, '0900000000');
  assert.equal(contactSchema.parse(contact).name, 'Test');
  assert.equal(contactSchema.safeParse({ ...contact, provinceId: 0 }).success, false);
  assert.equal(contactSchema.safeParse({ ...contact, phone: '123' }).success, false);
});
test('payment methods match declared enums only', () => {
  for (const value of ['ngttn', 'ngtts', 'nntn']) assert.equal(paymentMethodSchema.safeParse(value).success, true);
  assert.equal(paymentMethodSchema.safeParse('paid').success, false);
});
test('duplicate VAS rejected', () => assert.equal(shipmentDraftSchema.shape.selectedVasIds.safeParse([1, 1]).success, false));
