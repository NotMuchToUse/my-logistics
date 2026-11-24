import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parcelInputSchema, parcelListSchema, moneyInputSchema, contactSchema, shipmentDraftSchema, paymentMethodSchema } from '../schemas/shipment-create.schema.ts';
import { summarizeParcels } from '../utils/shipment-create.utils.ts';
import { assertShipmentCreateMockEnabled, calculateMockShipmentQuote, canMockCollectAtCounter, createMockShipment, getMockFreightPaymentStatus } from '../api/shipment-create.mock.ts';
const parcel = { lengthCm: 30, widthCm: 20, heightCm: 10, actualWeightGram: 1000 };
const contact = { name: 'Test', phone: '0900000000', provinceId: 901, districtId: 911, wardId: 921, addressDetail: 'Địa chỉ mẫu' };
const draft = (overrides = {}) => ({
  sender: { ...contact },
  receiver: { ...contact },
  parcels: [{ ...parcel }],
  serviceTypeId: 1,
  cargoCategoryId: 1,
  selectedVasIds: [],
  codAmount: '250000',
  declaredValue: '1000000',
  paymentMethod: 'ngttn',
  ...overrides,
});
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
test('shipment draft requires an active cargo category selection', () => {
  assert.equal(shipmentDraftSchema.safeParse(draft()).success, true);
  assert.equal(shipmentDraftSchema.safeParse(draft({ cargoCategoryId: 0 })).success, false);
});
test('mock quote uses the service divisor, tariff, VAS, surcharge, discount, VAT and keeps COD separate', () => {
  const quote = calculateMockShipmentQuote(draft({ selectedVasIds: [1] }));
  assert.ok(quote);
  assert.equal(quote.volumetricWeightGram, 1200);
  assert.equal(quote.chargeableWeightGram, 1200);
  assert.equal(quote.baseFreight, 40000);
  assert.deepEqual(quote.surcharges.map(({ code, amount }) => ({ code, amount })), [{ code: 'FUEL', amount: 2000 }]);
  assert.deepEqual(quote.valueAddedServices.map(({ code, amount }) => ({ code, amount })), [{ code: 'DECLARED_VALUE_INSURANCE', amount: 5000 }]);
  assert.equal(quote.discount, 2000);
  assert.equal(quote.vat, 3600);
  assert.equal(quote.totalFreight, 48600);
  assert.equal(quote.codAmount, 250000);
});
test('mock route fixtures select near and far tariffs and include only configured surcharges', () => {
  const near = calculateMockShipmentQuote(draft({
    sender: { ...contact },
    receiver: { ...contact, provinceId: 902, districtId: 912, wardId: 922 },
    serviceTypeId: 2,
  }));
  const far = calculateMockShipmentQuote(draft({
    sender: { ...contact, provinceId: 902, districtId: 912, wardId: 922 },
    receiver: { ...contact },
    serviceTypeId: 3,
  }));
  assert.equal(near?.route.zoneType, 'inter_region_near');
  assert.equal(near?.baseFreight, 34000);
  assert.deepEqual(near?.surcharges.map(({ code }) => code), ['FUEL']);
  assert.equal(far?.route.zoneType, 'inter_region_far');
  assert.equal(far?.volumetricWeightGram, 1000);
  assert.equal(far?.baseFreight, 25000);
  assert.deepEqual(far?.surcharges.map(({ code }) => code), ['FUEL', 'REMOTE_AREA']);
});
test('mock quote updates when parcel dimensions or service change and fails closed for missing tariff fixtures', () => {
  const original = calculateMockShipmentQuote(draft());
  const largerParcel = calculateMockShipmentQuote(draft({ parcels: [{ ...parcel, lengthCm: 60 }] }));
  const unsupported = calculateMockShipmentQuote(draft({ serviceTypeId: 1, receiver: { ...contact, provinceId: 902 } }));
  assert.ok(original && largerParcel);
  assert.notEqual(largerParcel.totalFreight, original.totalFreight);
  assert.equal(unsupported, null);
});
test('mock counter collection fixture grants Receptionist only and supports test overrides', () => {
  assert.equal(canMockCollectAtCounter(['receptionist']), true);
  assert.equal(canMockCollectAtCounter(['coordinator']), false);
  assert.equal(canMockCollectAtCounter(['coordinator'], { coordinator: true }), true);
});
test('mock freight payment status follows the selected payment method and counter confirmation', () => {
  assert.equal(getMockFreightPaymentStatus('ngttn', false), 'unpaid');
  assert.equal(getMockFreightPaymentStatus('ngttn', true), 'paid_at_counter');
  assert.equal(getMockFreightPaymentStatus('ngtts', true), 'invoiced_postpaid');
  assert.equal(getMockFreightPaymentStatus('nntn', true), 'unpaid');
  assert.match(createMockShipment('ngttn', false).mockPublicId, /^MOCK-SHP-\d{6}$/);
});
test('shipment creation fails closed outside Mock mode', () => {
  assert.doesNotThrow(() => assertShipmentCreateMockEnabled(true));
  assert.throws(() => assertShipmentCreateMockEnabled(false), /POST \/api\/v1\/shipments/);
});
