import { mock } from 'node:test';
import { Certificate, CertificateImportCommand } from '../../../model/certificate.model';
import { CertificateCommandDTO, CertificateExportFormat } from '../../../../shared/model/certificate.model';

/**
 * Create a mock object for Certificate Service
 */
export default class CertificateServiceMock {
  list = mock.fn((): Array<Certificate> => []);
  findById = mock.fn((_certificateId: string): Certificate => ({}) as Certificate);
  create = mock.fn(async (_command: CertificateCommandDTO, _createdBy: string): Promise<Certificate> => ({}) as Certificate);
  update = mock.fn(async (_certificateId: string, _command: CertificateCommandDTO, _updatedBy: string): Promise<void> => undefined);
  import = mock.fn(async (_command: CertificateImportCommand, _createdBy: string): Promise<Certificate> => ({}) as Certificate);
  exportCertificate = mock.fn(
    (
      _certificateId: string,
      _format: CertificateExportFormat,
      _includeChain: boolean
    ): { extension: string; content: string | Buffer } => ({
      extension: 'pem',
      content: ''
    })
  );
  exportPrivateKey = mock.fn(async (_certificateId: string, _passphrase: string, _requestedBy: string): Promise<string> => '');
  delete = mock.fn(async (_certificateId: string): Promise<void> => undefined);
}
