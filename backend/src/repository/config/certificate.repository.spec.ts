import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import CertificateRepository from './certificate.repository';
import AuditService from '../../service/audit.service';

const TEST_DB_PATH = 'src/tests/test-config-certificate.db';

let database: Database;
describe('CertificateRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: CertificateRepository;
  let auditService: AuditService;
  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new CertificateRepository(database, auditService);
  });

  it('should properly find all certificates', () => {
    const result = repository.list().map(stripAuditFields);
    const expected = testData.certificates.list.map(stripAuditFields);
    assert.strictEqual(result.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.deepStrictEqual(result[i], expected[i]);
    }
  });

  it('should properly find a certificate by its ID', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.certificates.list[0].id)),
      stripAuditFields(testData.certificates.list[0])
    );
    assert.strictEqual(repository.findById('bad id'), null);
  });

  it('should create a certificate', () => {
    const createCertificate = JSON.parse(JSON.stringify(testData.certificates.list[0]));
    createCertificate.id = 'new id';
    const created = repository.create(createCertificate);
    assert.deepStrictEqual(stripAuditFields(repository.findById('new id')), stripAuditFields(createCertificate));

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'certificate',
      created.id,
      'CREATE',
      null,
      { ...created, privateKey: '' },
      created.createdBy
    ]);
    // The private key itself must never be persisted in the audit trail
    assert.notStrictEqual((recordMock.mock.calls[0].arguments[4] as { privateKey: string }).privateKey, created.privateKey);
  });

  it('should update a certificate', () => {
    const updateCertificate = JSON.parse(JSON.stringify(testData.certificates.list[0]));
    updateCertificate.id = 'new id';
    updateCertificate.expiry = testData.constants.dates.DATE_2;
    updateCertificate.publicKey = 'new public key';
    updateCertificate.privateKey = 'new private key';
    const before = repository.findById(updateCertificate.id);
    repository.update(updateCertificate);
    const result = repository.findById(updateCertificate.id)!;
    assert.strictEqual(result.expiry, updateCertificate.expiry);
    assert.strictEqual(result.publicKey, updateCertificate.publicKey);
    assert.strictEqual(result.privateKey, updateCertificate.privateKey);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'certificate',
      updateCertificate.id,
      'UPDATE',
      { ...before, privateKey: '' },
      { ...result, privateKey: '' },
      updateCertificate.updatedBy
    ]);
    // The private key itself must never be persisted in the audit trail, before or after
    assert.notStrictEqual((recordMock.mock.calls[0].arguments[3] as { privateKey: string }).privateKey, before!.privateKey);
    assert.notStrictEqual((recordMock.mock.calls[0].arguments[4] as { privateKey: string }).privateKey, result.privateKey);
  });

  it('should update name and description certificate', () => {
    const before = repository.findById('new id');
    repository.updateNameAndDescription('new id', 'new name', 'new description', 'userTest');
    const result = repository.findById('new id')!;
    assert.strictEqual(result.name, 'new name');
    assert.strictEqual(result.description, 'new description');
    assert.strictEqual(result.updatedBy, 'userTest');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'certificate',
      'new id',
      'UPDATE',
      { ...before, privateKey: '' },
      { ...result, privateKey: '' },
      'userTest'
    ]);
  });

  it('should delete certificate', () => {
    const before = repository.findById('new id');
    repository.delete('new id', 'userTest');
    assert.strictEqual(repository.findById('new id'), null);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'certificate',
      'new id',
      'DELETE',
      { ...before, privateKey: '' },
      null,
      'userTest'
    ]);
  });
});
