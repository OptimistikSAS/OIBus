import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { Certificate } from '../../model/certificate.model';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import CertificateRepository from './certificate.repository';

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
  let auditService: Mocked<AuditService>;
  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new CertificateRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test. */
  const recorded = () => auditService.record.mock.calls.map(call => call.arguments);

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
    const createCertificate: Certificate = { ...JSON.parse(JSON.stringify(testData.certificates.list[0])), id: 'new id' };
    const created = repository.create(createCertificate);
    assert.deepStrictEqual(stripAuditFields(repository.findById('new id')), stripAuditFields(createCertificate));

    assert.deepStrictEqual(recorded(), [
      ['certificate', created.id, 'CREATE', null, { ...created, privateKey: '<changed>' }, created.createdBy]
    ]);
    // The private key itself must never be persisted in the audit trail, only the fact that it is set
    assert.notStrictEqual((recorded()[0][4] as { privateKey: string }).privateKey, created.privateKey);
  });

  it('should update a certificate', () => {
    const updateCertificate: Certificate = {
      ...JSON.parse(JSON.stringify(testData.certificates.list[0])),
      id: 'new id',
      expiry: testData.constants.dates.DATE_2,
      publicKey: 'new public key',
      privateKey: 'new private key'
    };
    const before = repository.findById(updateCertificate.id);
    repository.update(updateCertificate);
    const result = repository.findById(updateCertificate.id)!;
    assert.strictEqual(result.expiry, updateCertificate.expiry);
    assert.strictEqual(result.publicKey, updateCertificate.publicKey);
    assert.strictEqual(result.privateKey, updateCertificate.privateKey);

    assert.deepStrictEqual(recorded(), [
      [
        'certificate',
        updateCertificate.id,
        'UPDATE',
        { ...before, privateKey: '' },
        { ...result, privateKey: '<changed>' },
        updateCertificate.updatedBy
      ]
    ]);
    // The private key itself must never be persisted in the audit trail, before or after
    assert.notStrictEqual((recorded()[0][3] as { privateKey: string }).privateKey, before!.privateKey);
    assert.notStrictEqual((recorded()[0][4] as { privateKey: string }).privateKey, result.privateKey);
  });

  it('should update name and description certificate', () => {
    const before = repository.findById('new id');
    repository.updateNameAndDescription('new id', 'new name', 'new description', 'userTest');
    const result = repository.findById('new id')!;
    assert.strictEqual(result.name, 'new name');
    assert.strictEqual(result.description, 'new description');
    assert.strictEqual(result.updatedBy, 'userTest');

    assert.deepStrictEqual(recorded(), [
      ['certificate', 'new id', 'UPDATE', { ...before, privateKey: '' }, { ...result, privateKey: '' }, 'userTest']
    ]);
  });

  it('should delete certificate', () => {
    const before = repository.findById('new id');
    repository.delete('new id', 'userTest');
    assert.strictEqual(repository.findById('new id'), null);

    assert.deepStrictEqual(recorded(), [['certificate', 'new id', 'DELETE', { ...before, privateKey: '' }, null, 'userTest']]);
  });
});
