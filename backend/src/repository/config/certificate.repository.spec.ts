import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import CertificateRepository from './certificate.repository';

const TEST_DB_PATH = 'src/tests/test-config-certificate.db';

let database: Database;
describe('CertificateRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: CertificateRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    repository = new CertificateRepository(database);
  });

  it('should properly find all certificates', () => {
    expect(repository.list().map(stripAuditFields)).toEqual(
      testData.certificates.list.map(stripAuditFields).map(c => expect.objectContaining(c))
    );
  });

  it('should properly find a certificate by its ID', () => {
    expect(stripAuditFields(repository.findById(testData.certificates.list[0].id))).toEqual(
      expect.objectContaining(stripAuditFields(testData.certificates.list[0]))
    );
    expect(repository.findById('bad id')).toEqual(null);
  });

  it('should create a certificate', () => {
    const createCertificate = JSON.parse(JSON.stringify(testData.certificates.list[0]));
    createCertificate.id = 'new id';
    repository.create(createCertificate);
    expect(stripAuditFields(repository.findById('new id'))).toEqual(expect.objectContaining(stripAuditFields(createCertificate)));
  });

  it('should update a certificate', () => {
    const updateCertificate = JSON.parse(JSON.stringify(testData.certificates.list[0]));
    updateCertificate.id = 'new id';
    updateCertificate.expiry = testData.constants.dates.DATE_2;
    updateCertificate.publicKey = 'new public key';
    updateCertificate.privateKey = 'new private key';
    repository.update(updateCertificate);
    const result = repository.findById(updateCertificate.id)!;
    expect(result.expiry).toEqual(updateCertificate.expiry);
    expect(result.publicKey).toEqual(updateCertificate.publicKey);
    expect(result.privateKey).toEqual(updateCertificate.privateKey);
  });

  it('should update name and description certificate', () => {
    repository.updateNameAndDescription('new id', 'new name', 'new description', 'userTest');
    const result = repository.findById('new id')!;
    expect(result.name).toEqual('new name');
    expect(result.description).toEqual('new description');
    expect(result.updatedBy).toEqual('userTest');
  });

  it('should delete certificate', () => {
    repository.delete('new id');
    expect(repository.findById('new id')).toEqual(null);
  });
});
