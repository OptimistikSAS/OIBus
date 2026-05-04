import { mock } from 'node:test';
import { Certificate } from '../../../../model/certificate.model';

/**
 * Create a mock object for Certificate repository
 */
export default class CertificateRepositoryMock {
  list = mock.fn((): Array<Certificate> => []);
  findById = mock.fn((_id: string): Certificate | null => null);
  create = mock.fn((_certificate: Omit<Certificate, 'createdAt' | 'updatedAt'>): Certificate => ({}) as Certificate);
  update = mock.fn((_certificate: Omit<Certificate, 'createdBy' | 'createdAt' | 'updatedAt'>): void => undefined);
  updateNameAndDescription = mock.fn(
    (_certificateId: string, _newName: string, _newDescription: string, _updatedBy: string): void => undefined
  );
  delete = mock.fn((_id: string): void => undefined);
}
