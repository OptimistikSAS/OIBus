import { Database } from 'better-sqlite3';
import { Certificate } from '../../../shared/model/certificate.model';

export const CERTIFICATES_TABLE = 'certificates';

/**
 * Repository used for managing certificates within OIBus
 */
export default class CertificateRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<Certificate> {
    const query = `SELECT id,
                              name,
                              description,
                              public_key  as publicKey,
                              private_key as privateKey,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE};`;
    return this.database.prepare(query).all() as Array<Certificate>;
  }

  findById(id: string): Certificate | null {
    const query = `SELECT id,
                              name,
                              description,
                              public_key  as publicKey,
                              private_key as privateKey,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    return this.database.prepare(query).get(id) as Certificate | null;
  }

  create(certificate: Certificate): Certificate {
    const insertQuery = `INSERT INTO ${CERTIFICATES_TABLE} (id, name, description, public_key, private_key, certificate, expiry)
                             VALUES (?, ?, ?, ?, ?, ?, ?);`;
    const result = this.database
      .prepare(insertQuery)
      .run(
        certificate.id,
        certificate.name,
        certificate.description,
        certificate.publicKey,
        certificate.privateKey,
        certificate.certificate,
        certificate.expiry
      );

    const query = `SELECT id,
                              name,
                              description,
                              public_key  as publicKey,
                              private_key as privateKey,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE}
                       WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as Certificate;
  }

  update(certificate: Certificate): void {
    const query =
      `UPDATE ${CERTIFICATES_TABLE} SET name = ?, description = ?, public_key  = ?, private_key = ?, certificate = ?, ` +
      'expiry = ? WHERE id = ?;';
    this.database
      .prepare(query)
      .run(
        certificate.name,
        certificate.description,
        certificate.publicKey,
        certificate.privateKey,
        certificate.certificate,
        certificate.expiry,
        certificate.id
      );
  }

  updateNameAndDescription(certificateId: string, newName: string, newDescription: string): void {
    const query = `UPDATE ${CERTIFICATES_TABLE}
                       SET name        = ?,
                           description = ?
                       WHERE id = ?;`;
    this.database.prepare(query).run(newName, newDescription, certificateId);
  }

  delete(id: string): void {
    const query = `DELETE
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
