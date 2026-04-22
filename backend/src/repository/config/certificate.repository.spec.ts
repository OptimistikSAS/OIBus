import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
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
  beforeEach(() => {
    repository = new CertificateRepository(database);
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
    repository.create(createCertificate);
    assert.deepStrictEqual(stripAuditFields(repository.findById('new id')), stripAuditFields(createCertificate));
  });

  it('should update a certificate', () => {
    const updateCertificate = JSON.parse(JSON.stringify(testData.certificates.list[0]));
    updateCertificate.id = 'new id';
    updateCertificate.expiry = testData.constants.dates.DATE_2;
    updateCertificate.publicKey = 'new public key';
    updateCertificate.privateKey = 'new private key';
    repository.update(updateCertificate);
    const result = repository.findById(updateCertificate.id)!;
    assert.strictEqual(result.expiry, updateCertificate.expiry);
    assert.strictEqual(result.publicKey, updateCertificate.publicKey);
    assert.strictEqual(result.privateKey, updateCertificate.privateKey);
  });

  it('should update name and description certificate', () => {
    repository.updateNameAndDescription('new id', 'new name', 'new description', 'userTest');
    const result = repository.findById('new id')!;
    assert.strictEqual(result.name, 'new name');
    assert.strictEqual(result.description, 'new description');
    assert.strictEqual(result.updatedBy, 'userTest');
  });

  it('should delete certificate', () => {
    repository.delete('new id');
    assert.strictEqual(repository.findById('new id'), null);
  });
});
