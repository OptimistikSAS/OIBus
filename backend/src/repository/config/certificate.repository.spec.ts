import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { OIBusAttribute } from '../../../shared/model/connector/form.model';

import { Certificate } from '../../model/certificate.model';
import AuditService from '../../service/audit.service';
import { northManifestList } from '../../service/north-manifests';
import { southManifestList } from '../../service/south-manifests';
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

  it('should find what uses a certificate, by the certificateId or trustedCertificateId of the settings at any depth', () => {
    const certificateId = testData.certificates.list[0].id;
    const setSettings = (table: string, column: string, id: string, settings: object) =>
      database.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?;`).run(JSON.stringify(settings), id);
    setSettings('south_connectors', 'settings', testData.south.list[0].id, { certificateId });
    setSettings('south_connectors', 'settings', testData.south.list[1].id, { authentication: { type: 'cert', certificateId } });
    // another certificate, or the same value under another key
    setSettings('south_connectors', 'settings', testData.south.list[2].id, { certificateId: 'other', name: certificateId });
    setSettings('north_connectors', 'settings', testData.north.list[0].id, { specificSettings: { trustedCertificateId: certificateId } });
    setSettings('history_queries', 'north_settings', testData.historyQueries.list[0].id, { certificateId });
    database.prepare(`UPDATE engines SET https_certificate_source = 'store', https_certificate_id = ?;`).run(certificateId);

    assert.deepStrictEqual(repository.findUsages(certificateId), [
      { type: 'south', name: testData.south.list[0].name },
      { type: 'south', name: testData.south.list[1].name },
      { type: 'north', name: testData.north.list[0].name },
      { type: 'history-query', name: testData.historyQueries.list[0].name },
      { type: 'web-server', name: testData.engine.settings.general.name }
    ]);
    assert.deepStrictEqual(repository.findUsages('unused'), []);

    database.prepare(`UPDATE engines SET https_certificate_source = 'file';`).run();
    assert.ok(!repository.findUsages(certificateId).some(usage => usage.type === 'web-server'));
  });

  it('should rely on manifests naming every certificate field certificateId, and giving none to the items', () => {
    const certificateKeys = (attribute: OIBusAttribute): Array<string> => {
      switch (attribute.type) {
        case 'certificate':
          return [attribute.key];
        case 'object':
          return attribute.attributes.flatMap(certificateKeys);
        case 'array':
          return certificateKeys(attribute.rootAttribute);
        default:
          return [];
      }
    };
    const manifests = [...southManifestList, ...northManifestList];
    assert.ok(manifests.flatMap(manifest => certificateKeys(manifest.settings)).length > 0);
    assert.deepStrictEqual([...new Set(manifests.flatMap(manifest => certificateKeys(manifest.settings)))], ['certificateId']);
    assert.deepStrictEqual(
      southManifestList.flatMap(manifest => certificateKeys(manifest.items.rootAttribute)),
      []
    );
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
    const createCertificate: Certificate = { ...JSON.parse(JSON.stringify(testData.certificates.list[0])), id: 'new id' };
    const created = repository.create(createCertificate);
    assert.deepStrictEqual(stripAuditFields(repository.findById('new id')), stripAuditFields(createCertificate));

    assert.deepStrictEqual(recorded(), [
      ['certificate', created.id, 'CREATE', null, { ...created, privateKey: '<changed>' }, created.createdBy]
    ]);
    // The private key itself must never be persisted in the audit trail, only the fact that it is set
    assert.notStrictEqual((recorded()[0][4] as { privateKey: string }).privateKey, created.privateKey);
  });

  it('should create a trusted certificate, without private key', () => {
    const trusted: Certificate = {
      ...JSON.parse(JSON.stringify(testData.certificates.list[0])),
      id: 'trusted id',
      kind: 'trusted',
      privateKey: ''
    };
    repository.create(trusted);

    assert.deepStrictEqual(stripAuditFields(repository.findById('trusted id')), stripAuditFields(trusted));
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
