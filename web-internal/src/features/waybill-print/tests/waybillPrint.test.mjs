import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWaybillGateway } from '../api/waybillPrint.gateway.ts';
import { readWaybillFixture } from '../api/waybillPrint.fixture.ts';
import { createWaybillMock, WaybillError } from '../api/waybillPrint.mock.ts';
import { createPendingOperation } from '../utils/pendingOperation.ts';
import { selectPrintParcels } from '../utils/printSelection.ts';

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('../../../mocks/waybillPrint.mock.json', import.meta.url)), 'utf8'));
const data = readWaybillFixture(fixture);
const uuid = '11111111-1111-4111-8111-111111111111';

function session(overrides = {}) {
  return {
    key: 'user:branch:10',
    branchId: '10',
    authenticated: true,
    roles: ['receptionist'],
    allowedBranchIds: ['10'],
    branchOptions: [{ id: '10', name: 'Chi nhánh 10' }],
    allBranches: false,
    ...overrides,
  };
}

function admin(overrides = {}) {
  return session({ roles: ['system_admin'], allBranches: true, ...overrides });
}

test('fixture rejects inconsistent parcel count, duplicate sequence, and duplicate barcode', () => {
  const duplicateSequence = structuredClone(fixture);
  duplicateSequence.success_response.data.parcels[0].parcel_sequence = 1;
  assert.throws(() => readWaybillFixture(duplicateSequence));

  const duplicateBarcode = structuredClone(fixture);
  duplicateBarcode.success_response.data.parcels[0].parcel_barcode = duplicateBarcode.success_response.data.parcels[1].parcel_barcode;
  assert.throws(() => readWaybillFixture(duplicateBarcode));

  const wrongCount = structuredClone(fixture);
  wrongCount.success_response.data.shipment.parcel_count = 4;
  assert.throws(() => readWaybillFixture(wrongCount));
});

test('parcel selection validates server-issued barcodes and sorts by sequence', () => {
  const selected = selectPrintParcels(data.model, {
    shipmentPublicId: data.model.publicId,
    documentType: 'barcode_sticker',
    parcelBarcodes: [data.model.parcels[0].parcelBarcode, data.model.parcels[1].parcelBarcode],
  });
  assert.deepEqual(selected.map((parcel) => parcel.parcelSequence), [1, 3]);
  assert.throws(() => selectPrintParcels(data.model, {
    shipmentPublicId: data.model.publicId,
    documentType: 'barcode_sticker',
    parcelBarcodes: ['not-a-server-barcode'],
  }));
  assert.throws(() => selectPrintParcels(data.model, {
    shipmentPublicId: data.model.publicId,
    documentType: 'barcode_sticker',
    parcelBarcodes: [data.model.parcels[0].parcelBarcode, data.model.parcels[0].parcelBarcode],
  }));
});

test('print permission and branch scope are enforced in the mock', () => {
  const mock = createWaybillMock(data.model, data.ranges);
  assert.throws(() => mock.shipment(admin(), data.model.publicId), (error) => error.code === '403_FORBIDDEN');
  assert.throws(() => mock.list(session()), (error) => error.code === '403_FORBIDDEN');
  assert.throws(() => mock.shipment(session({ branchId: null }), data.model.publicId), (error) => error.code === '403_BRANCH_SCOPE');
  assert.throws(() => mock.list(admin({ branchId: null, allBranches: false })), (error) => error.code === '403_BRANCH_SCOPE');
});

test('branch admins see shared and permitted ranges but cannot mutate shared ranges', () => {
  const branchRecord = {
    ...data.ranges[0],
    id: '4',
    branch_id: '20',
    prefix: 'BR20',
  };
  const mock = createWaybillMock(data.model, [...data.ranges, branchRecord]);
  const branchAdmin = admin({
    allBranches: false,
    branchId: '10',
    allowedBranchIds: ['10'],
  });
  assert.equal(mock.list(branchAdmin).some((row) => row.id === '4'), false);
  assert.throws(() => mock.deactivate(branchAdmin, '1', uuid), (error) => error.code === '403_BRANCH_SCOPE');
  assert.throws(() => mock.deactivate(branchAdmin, '4', '22222222-2222-4222-8222-222222222222'), (error) => error.code === '403_BRANCH_SCOPE');
  assert.throws(() => mock.save(branchAdmin, {
    prefix: 'NEW',
    branch_id: null,
    start_number: '300',
    end_number: '399',
  }, null, uuid), (error) => error.code === '403_BRANCH_SCOPE');
});

test('print log retries are idempotent and reject a reused key with different content', () => {
  const mock = createWaybillMock(data.model, data.ranges);
  const command = { shipmentPublicId: data.model.publicId, documentType: 'waybill_a4', parcelBarcodes: [] };
  const first = mock.log(session(), command, uuid);
  assert.deepEqual(mock.log(session(), command, uuid), first);
  assert.equal(mock.logCount(session()), 1);
  assert.throws(() => mock.log(session(), { ...command, documentType: 'waybill_label' }, uuid), (error) => error.code === '409_IDEMPOTENCY_DUPLICATE');
});

test('range mock blocks unconfirmed creation and can edit/deactivate unused records', () => {
  const unused = {
    ...data.ranges[0],
    id: '4',
    prefix: 'UNUSED',
    start_number: '300',
    end_number: '399',
    current_number: '299',
  };
  const mock = createWaybillMock(data.model, [...data.ranges, unused]);
  assert.throws(() => mock.save(admin(), {
    prefix: 'TEST',
    branch_id: null,
    start_number: '300',
    end_number: '399',
  }, null, uuid), (error) => error.code === 'CONTRACT_BLOCKED');
  const edited = mock.save(admin(), {
    prefix: 'TEST',
    branch_id: null,
    start_number: '300',
    end_number: '450',
  }, '4', '22222222-2222-4222-8222-222222222222');
  assert.equal(edited.current_number, '299');
  assert.equal(edited.status, 'active');
  assert.throws(() => mock.save(admin(), {
    prefix: 'TEST',
    branch_id: null,
    start_number: '300',
    end_number: '399',
    current_number: '300',
  }, '4', '33333333-3333-4333-8333-333333333333'), (error) => error.code === '422_VALIDATION_ERROR');
  assert.throws(() => mock.save(admin(), {
    prefix: 'TEST',
    branch_id: null,
    start_number: '9007199254740993',
    end_number: '9007199254741993',
  }, '3', '55555555-5555-4555-8555-555555555555'), (error) => error.code === '422_VALIDATION_ERROR');
  const deactivated = mock.deactivate(admin(), edited.id, '44444444-4444-4444-8444-444444444444');
  assert.equal(deactivated.status, 'inactive');
});

test('ambiguous retry reuses the same idempotency key and payload', async () => {
  const calls = [];
  let shouldFail = true;
  const operation = createPendingOperation(async (payload, key) => {
    calls.push({ payload, key });
    if (shouldFail) {
      shouldFail = false;
      throw new Error('simulated timeout');
    }
    return { payload, key };
  }, () => 'user:branch:10', () => uuid);
  await assert.rejects(operation.run({ documentType: 'waybill_a4' }), /simulated timeout/);
  assert.deepEqual(operation.pendingPayload, { documentType: 'waybill_a4' });
  const result = await operation.run({ documentType: 'waybill_label' }, true);
  assert.equal(calls[0].key, calls[1].key);
  assert.deepEqual(calls[0].payload, calls[1].payload);
  assert.deepEqual(result.payload, { documentType: 'waybill_a4' });
  assert.equal(operation.pending, false);
});

test('validation failure clears pending state, but changed context refuses an old retry', async () => {
  const validation = createPendingOperation(async () => {
    throw new WaybillError('422_VALIDATION_ERROR', 'invalid');
  }, () => 'user:branch:10', () => uuid);
  await assert.rejects(validation.run({ value: 1 }), (error) => error.code === '422_VALIDATION_ERROR');
  assert.equal(validation.pending, false);

  let context = 'user:branch:10';
  let executions = 0;
  const ambiguous = createPendingOperation(async () => {
    executions += 1;
    throw new Error('timeout');
  }, () => context, () => uuid);
  await assert.rejects(ambiguous.run({ value: 1 }), /timeout/);
  context = 'user:branch:20';
  await assert.rejects(ambiguous.run({ value: 1 }, true), (error) => error.code === 'CONTEXT_CHANGED');
  assert.equal(executions, 1);
});

test('double submit is synchronously locked before the second mutation starts', async () => {
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  let executions = 0;
  const operation = createPendingOperation(async () => {
    executions += 1;
    await response;
    return 'saved';
  }, () => 'user:branch:10', () => uuid);
  const first = operation.run({ value: 1 });
  await assert.rejects(operation.run({ value: 2 }), (error) => error.code === 'OPERATION_BUSY');
  assert.equal(executions, 1);
  release();
  assert.equal(await first, 'saved');
});

test('API mode is fail-closed and does not invoke mock operations', async () => {
  const mock = createWaybillMock(data.model, data.ranges);
  const gateway = createWaybillGateway(false, mock);
  await assert.rejects(gateway.shipment(session(), data.model.publicId), (error) => error instanceof WaybillError && error.code === 'CONTRACT_BLOCKED');
  assert.equal(mock.logCount(session()), 0);
});
