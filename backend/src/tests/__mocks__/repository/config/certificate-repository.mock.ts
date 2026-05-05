import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { Certificate } from '../../../../model/certificate.model';
import CertificateRepository from '../../../../repository/config/certificate.repository';

/**
 * Create a mock object for Certificate repository
 */
export default class CertificateRepositoryMock extends CertificateRepository {
  constructor() {
    super({} as Database);
  }
  override list = mock.fn((): Array<Certificate> => []);
  override findById = mock.fn((_id: string): Certificate | null => null);
  override create = mock.fn((_certificate: Omit<Certificate, 'createdAt' | 'updatedAt'>): Certificate => ({}) as Certificate);
  override update = mock.fn((_certificate: Omit<Certificate, 'createdBy' | 'createdAt' | 'updatedAt'>): void => undefined);
  override updateNameAndDescription = mock.fn(
    (_certificateId: string, _newName: string, _newDescription: string, _updatedBy: string): void => undefined
  );
  override delete = mock.fn((_id: string): void => undefined);
}
