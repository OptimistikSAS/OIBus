import { CertificateController } from './certificate.controller';
import { CertificateCommandDTO } from '../../../shared/model/certificate.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import CertificateServiceMock from '../../tests/__mocks__/service/certificate-service.mock';

// Mock the services
jest.mock('../../service/certificate.service', () => ({
  toCertificateDTO: jest.fn().mockImplementation(cert => cert)
}));

describe('CertificateController', () => {
  let controller: CertificateController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      certificateService: new CertificateServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CertificateController();
  });

  it('should return a list of certificates', async () => {
    const mockCertificates = testData.certificates.list;
    mockRequest.services!.certificateService.list.mockReturnValue(mockCertificates);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.certificateService.list).toHaveBeenCalled();
    expect(result).toEqual(mockCertificates);
  });

  it('should return a certificate by ID', async () => {
    const mockCertificate = testData.certificates.list[0];
    const certificateId = 'test-id';
    mockRequest.services!.certificateService.findById.mockReturnValue(mockCertificate);

    const result = await controller.findById(certificateId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.certificateService.findById).toHaveBeenCalledWith(certificateId);
    expect(result).toEqual(mockCertificate);
  });

  it('should create a new certificate', async () => {
    const command: CertificateCommandDTO = testData.certificates.command;
    const createdCertificate = testData.certificates.list[0];
    mockRequest.services!.certificateService.create.mockResolvedValue(createdCertificate);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.certificateService.create).toHaveBeenCalledWith(command);
    expect(result).toEqual(createdCertificate);
  });

  it('should update an existing certificate', async () => {
    const certificateId = 'test-id';
    const command: CertificateCommandDTO = testData.certificates.command;
    mockRequest.services!.certificateService.update.mockResolvedValue(undefined);

    await controller.update(certificateId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.certificateService.update).toHaveBeenCalledWith(certificateId, command);
  });

  it('should delete a certificate', async () => {
    const certificateId = 'test-id';
    mockRequest.services!.certificateService.delete.mockResolvedValue(undefined);

    await controller.delete(certificateId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.certificateService.delete).toHaveBeenCalledWith(certificateId);
  });
});
