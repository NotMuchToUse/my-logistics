import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsignedBigIntStringSchema, trackingRangeInputSchema, trackingRangeRecordSchema, printDocumentTypeSchema } from '../schemas/trackingRange.schema.ts';
import { countRangeNumbers, rangesIntersect } from '../utils/trackingRange.utils.ts';

const input = { prefix: 'VS', branch_id: null, start_number: '100', end_number: '200' };
test('accept shared range and explicit branch identifier', () => {
  assert.equal(trackingRangeInputSchema.safeParse(input).success, true);
  assert.equal(trackingRangeInputSchema.safeParse({ ...input, branch_id: '9007199254740993' }).success, true);
});
for (const value of ['', ' ', '-1', '1.2', '1e3', 'NaN', 'Infinity', '18446744073709551616', 9007199254740992]) {
  test(`reject invalid unsigned integer ${JSON.stringify(value)}`, () => assert.equal(unsignedBigIntStringSchema.safeParse(value).success, false));
}
test('preserve exact values above safe integer and leading zeroes', () => {
  for (const value of ['0', '00100', '9007199254740993', '18446744073709551615']) assert.equal(unsignedBigIntStringSchema.parse(value), value);
});
test('prefix length and required validation', () => {
  for (const prefix of ['', '   ', 'A'.repeat(16)]) assert.equal(trackingRangeInputSchema.safeParse({ ...input, prefix }).success, false);
  assert.equal(trackingRangeInputSchema.safeParse({ ...input, prefix: 'A'.repeat(15) }).success, true);
});
test('reversed range fails; singleton accepted', () => {
  assert.equal(trackingRangeInputSchema.safeParse({ ...input, start_number: '201' }).success, false);
  assert.equal(countRangeNumbers({ start_number: '200', end_number: '200' }), '1');
});
test('closed intervals intersect at the boundary', () => {
  assert.equal(rangesIntersect(input, { start_number: '150', end_number: '250' }), true);
  assert.equal(rangesIntersect(input, { start_number: '200', end_number: '300' }), true);
  assert.equal(rangesIntersect(input, { start_number: '201', end_number: '300' }), false);
});
test('large interval count is exact', () => {
  assert.equal(countRangeNumbers({ start_number: '9007199254740993', end_number: '9007199254740995' }), '3');
  assert.equal(countRangeNumbers({ start_number: '0', end_number: '18446744073709551615' }), '18446744073709551616');
});
test('input excludes server-controlled and unconfirmed fields', () => {
  for (const name of ['current_number', 'created_by', 'version', 'is_active', 'deleted_at', 'status']) assert.equal(trackingRangeInputSchema.safeParse({ ...input, [name]: '1' }).success, false);
});
test('record supports exact status enum and preserves allocated number', () => {
  const record = { ...input, id: '1', current_number: '150', created_at: '2026-11-24 10:00:00', updated_at: '2026-11-24 10:00:00' };
  for (const status of ['active', 'exhausted', 'inactive']) assert.equal(trackingRangeRecordSchema.parse({ ...record, status }).current_number, '150');
  assert.equal(trackingRangeRecordSchema.safeParse({ ...record, status: 'deleted' }).success, false);
  assert.equal(trackingRangeRecordSchema.safeParse({ ...record, status: 'active', current_number: '201' }).success, false);
});
test('only three print types belong to this feature', () => {
  for (const value of ['waybill_a4', 'waybill_label', 'barcode_sticker']) assert.equal(printDocumentTypeSchema.safeParse(value).success, true);
  assert.equal(printDocumentTypeSchema.safeParse('delivery_manifest').success, false);
});
