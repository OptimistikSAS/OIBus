import { Database } from 'better-sqlite3';
import { Certificate } from '../../model/certificate.model';
import AuditService from '../../service/audit.service';

const CERTIFICATES_TABLE = 'certificates';

/**
 * Repository used for managing certificates within OIBus
 */
export default class CertificateRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {}

  list(): Array<Certificate> {
    const query = `SELECT id,
                              name,
                              description,
                              public_key,
                              private_key,
                              certificate,
                              certificate_chain,
                              expiry,
                              created_by,
                              updated_by,
                              created_at,
                              updated_at
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
                              certificate_chain,
                              expiry,
                              created_by,
                              updated_by,
                              created_at,
                              updated_at
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toCertificate(result as Record<string, string>) : null;
  }

  create(certificate: Omit<Certificate, 'createdAt' | 'updatedAt'>): Certificate {
    const insertQuery =
      `INSERT INTO ${CERTIFICATES_TABLE} (id, name, description, public_key, private_key, certificate, certificate_chain, expiry, created_by, updated_by, created_at, updated_at) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    const result = this.database
      .prepare(insertQuery)
      .run(
        certificate.id,
        certificate.name,
        certificate.description,
        certificate.publicKey,
        certificate.privateKey,
        certificate.certificate,
        certificate.certificateChain,
        certificate.expiry,
        certificate.createdBy,
        certificate.updatedBy
      );

    const query = `SELECT id,
                              name,
                              description,
                              public_key,
                              private_key,
                              certificate,
                              certificate_chain,
                              expiry,
                              created_by,
                              updated_by,
                              created_at,
                              updated_at
                       FROM ${CERTIFICATES_TABLE}
                       WHERE ROWID = ?;`;
    const created = this.toCertificate(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
    this.auditService.record('certificate', created.id, 'CREATE', null, created as unknown as Record<string, unknown>, created.createdBy);
    return created;
  }

  update(certificate: Omit<Certificate, 'createdBy' | 'createdAt' | 'updatedAt'>): void {
    const before = this.findById(certificate.id);
    const query =
      `UPDATE ${CERTIFICATES_TABLE} SET name = ?, description = ?, public_key  = ?, private_key = ?, certificate = ?, certificate_chain = ?, ` +
      `expiry = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        certificate.name,
        certificate.description,
        certificate.publicKey,
        certificate.privateKey,
        certificate.certificate,
        certificate.certificateChain,
        certificate.expiry,
        certificate.updatedBy,
        certificate.id
      );
    const after = this.findById(certificate.id);
    this.auditService.record(
      'certificate',
      certificate.id,
      'UPDATE',
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      certificate.updatedBy
    );
  }

  updateNameAndDescription(certificateId: string, newName: string, newDescription: string, updatedBy: string): void {
    const before = this.findById(certificateId);
    const query = `UPDATE ${CERTIFICATES_TABLE}
                       SET name        = ?,
                           description = ?,
                           updated_by  = ?,
                           updated_at  = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                       WHERE id = ?;`;
    this.database.prepare(query).run(newName, newDescription, updatedBy, certificateId);
    const after = this.findById(certificateId);
    this.auditService.record(
      'certificate',
      certificateId,
      'UPDATE',
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      updatedBy
    );
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    const query = `DELETE
                       FROM ${CERTIFICATES_TABLE}
                       WHERE id = ?;`;
    this.database.prepare(query).run(id);
    if (before) {
      this.auditService.record('certificate', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
    }
  }

  private toCertificate(result: Record<string, string>): Certificate {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      publicKey: result.public_key,
      privateKey: result.private_key,
      certificate: result.certificate,
      certificateChain: result.certificate_chain ?? null,
      expiry: result.expiry,
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
}
