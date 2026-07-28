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
    ): { fileName: string; contentType: string; body: string | Buffer } => ({
      fileName: 'certificate.pem',
      contentType: 'application/x-pem-file',
      body: ''
    })
  );
  exportPrivateKey = mock.fn(
    async (
      _certificateId: string,
      _passphrase: string,
      _requestedBy: string
    ): Promise<{ fileName: string; contentType: string; body: string }> => ({
      fileName: 'private-key.pem',
      contentType: 'application/x-pem-file',
      body: ''
    })
  );
  delete = mock.fn(async (_certificateId: string): Promise<void> => undefined);
}
