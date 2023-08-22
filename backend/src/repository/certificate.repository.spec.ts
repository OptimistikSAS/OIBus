import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import CertificateRepository, { CERTIFICATES_TABLE } from './certificate.repository';
import { Certificate, CertificateDTO } from '../../../shared/model/certificate.model';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: CertificateRepository;

describe('Certificate repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new CertificateRepository(database);
  });

  it('should properly list certificates', () => {
    const expectedValue: Array<CertificateDTO> = [
      {
        id: 'id1',
        name: 'cert1',
        description: 'certificate1',
        publicKey: 'pub1',
        certificate: 'cert1',
        expiry: '2033-01-01T12:00:00Z'
      },
      {
        id: 'id2',
        name: 'cert2',
        description: 'certificate2',
        publicKey: 'pub2',
        certificate: 'cert2',
        expiry: '2033-01-01T12:00:00Z'
      }
    ];
    all.mockReturnValueOnce(expectedValue);
    const certificates = repository.findAll();
    const query = `SELECT id,
                              name,
                              description,
                              public_key  as publicKey,
                              private_key as privateKey,
                              certificate,
                              expiry
                       FROM certificates;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(certificates).toEqual(expectedValue);
  });

  it('should properly find by id', () => {
    const expectedValue: Certificate = {
      id: 'id2',
      name: 'cert2',
      description: 'certificate2',
      publicKey: 'pub2',
      certificate: 'cert2',
      privateKey: 'pk',
      expiry: '2033-01-01T12:00:00Z'
    };
    get.mockReturnValueOnce(expectedValue);
    const certificate = repository.findById('id2');
    const query = `SELECT id,
                              name,
                              description,
                              public_key  as publicKey,
                              private_key as privateKey,
                              certificate,
                              expiry
                       FROM certificates
                       WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(get).toHaveBeenCalledWith('id2');
    expect(certificate).toEqual(expectedValue);
  });

  it('should create a certificate', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    const command: Certificate = {
      id: 'id2',
      name: 'cert2',
      description: 'certificate2',
      publicKey: 'pub2',
      certificate: 'cert2',
      privateKey: 'pk',
      expiry: '2033-01-01T12:00:00Z'
    };
    repository.create(command);
    const insertQuery = `INSERT INTO certificates (id, name, description, public_key, private_key, certificate, expiry)
                             VALUES (?, ?, ?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith(
      'id2',
      command.name,
      command.description,
      command.publicKey,
      command.privateKey,
      command.certificate,
      command.expiry
    );
  });

  it('should update a certificate', () => {
    const command: Certificate = {
      id: 'id2',
      name: 'cert2',
      description: 'certificate2',
      publicKey: 'pub2',
      certificate: 'cert2',
      privateKey: 'pk',
      expiry: '2033-01-01T12:00:00Z'
    };
    repository.update(command);
    const updateQuery =
      'UPDATE certificates SET name = ?, description = ?, public_key  = ?, ' + 'private_key = ?, certificate = ?, expiry = ? WHERE id = ?;';
    expect(database.prepare).toHaveBeenCalledWith(updateQuery);
    expect(run).toHaveBeenCalledWith(
      command.name,
      command.description,
      command.publicKey,
      command.privateKey,
      command.certificate,
      command.expiry,
      'id2'
    );
  });

  it('should update name and description only', () => {
    repository.updateNameAndDescription('id1', 'new', 'desc');
    const query = `UPDATE certificates
                       SET name        = ?,
                           description = ?
                       WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('new', 'desc', 'id1');
  });

  it('should delete a certificate', () => {
    repository.delete('id1');
    const query = `DELETE
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });
});
