import { mock } from 'node:test';
import { Certificate } from '../../../model/certificate.model';
import { CertificateCommandDTO } from '../../../../shared/model/certificate.model';

/**
 * Create a mock object for Certificate Service
 */
export default class CertificateServiceMock {
  list = mock.fn((): Array<Certificate> => []);
  findById = mock.fn((_certificateId: string): Certificate => ({}) as Certificate);
  create = mock.fn(async (_command: CertificateCommandDTO, _createdBy: string): Promise<Certificate> => ({}) as Certificate);
  update = mock.fn(async (_certificateId: string, _command: CertificateCommandDTO, _updatedBy: string): Promise<void> => undefined);
  delete = mock.fn(async (_certificateId: string): Promise<void> => undefined);
}
