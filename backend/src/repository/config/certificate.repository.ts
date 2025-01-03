import { Database } from 'better-sqlite3';
import { Certificate } from '../../model/certificate.model';

const CERTIFICATES_TABLE = 'certificates';

/**
 * Repository used for managing certificates within OIBus
 */
export default class CertificateRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<Certificate> {
    const query = `SELECT id,
                              name,
                              description,
                              public_key,
                              private_key,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toCertificate(result as Record<string, string>));
  }

  findById(id: string): Certificate | null {
    const query = `SELECT id,
                              name,
                              description,
                              public_key,
                              private_key,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toCertificate(result as Record<string, string>) : null;
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
                              public_key,
                              private_key,
                              certificate,
                              expiry
                       FROM ${CERTIFICATES_TABLE}
                       WHERE ROWID = ?;`;
    return this.toCertificate(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
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

  private toCertificate(result: Record<string, string>): Certificate {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      publicKey: result.public_key,
      privateKey: result.private_key,
      certificate: result.certificate,
      expiry: result.expiry
    };
  }
}
