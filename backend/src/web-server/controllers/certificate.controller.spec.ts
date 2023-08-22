import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import CertificateController from './certificate.controller';
import { CertificateCommandDTO, CertificateDTO } from '../../../../shared/model/certificate.model';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const certificateController = new CertificateController(validator, schema);

const ctx = new KoaContextMock();
const certificateCommand: CertificateCommandDTO = {
  name: 'cert',
  description: 'description',
  regenerateCertificate: true,
  options: {
    commonName: 'cn',
    localityName: 'ch',
    stateOrProvinceName: 'sav',
    countryName: 'fr',
    organizationName: 'opt',
    keySize: 2048,
    daysBeforeExpiry: 10
  }
};
const certificate1: CertificateDTO = {
  id: '1',
  name: 'cert1',
  description: 'cert1 desc',
  publicKey: 'pub1',
  certificate: 'cert',
  expiry: '2033-01-01T00:00:00Z'
};

describe('Certificate controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should find all certificates', async () => {
    ctx.app.repositoryService.certificateRepository.findAll.mockReturnValue([certificate1]);

    await certificateController.findAll(ctx);

    expect(ctx.app.repositoryService.certificateRepository.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([certificate1]);
  });

  it('should find a certificate by id', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);

    await certificateController.findById(ctx);

    expect(ctx.app.repositoryService.certificateRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(certificate1);
  });

  it('should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(null);

    await certificateController.findById(ctx);

    expect(ctx.app.repositoryService.certificateRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('should create a certificate', async () => {
    ctx.request.body = certificateCommand;
    ctx.app.repositoryService.certificateRepository.create.mockReturnValue(certificate1);
    ctx.app.encryptionService.generateSelfSignedCertificate.mockReturnValue({
      private: 'pk',
      public: 'pub',
      cert: 'cert',
      fingerprint: 'f'
    });

    await certificateController.create(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, certificateCommand);
    expect(ctx.app.encryptionService.generateSelfSignedCertificate).toHaveBeenCalledWith(certificateCommand.options);
    expect(ctx.app.repositoryService.certificateRepository.create).toHaveBeenCalled();
    expect(ctx.created).toHaveBeenCalledWith(certificate1);
  });

  it('should fail to create a certificate on error', async () => {
    ctx.request.body = certificateCommand;
    ctx.app.repositoryService.certificateRepository.create.mockReturnValue(certificate1);
    ctx.app.encryptionService.generateSelfSignedCertificate.mockImplementation(() => {
      throw new Error('cert error');
    });

    await certificateController.create(ctx);
    expect(validator.validate).toHaveBeenCalledWith(schema, certificateCommand);
    expect(ctx.badRequest).toHaveBeenCalledWith('cert error');
  });

  it('should fail to create a certificate with bad body', async () => {
    ctx.request.body = {
      options: null
    };

    await certificateController.create(ctx);
    expect(ctx.app.encryptionService.generateSelfSignedCertificate).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('should update a certificate with only name and description', async () => {
    ctx.params.id = 'id';
    ctx.request.body = {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: false,
      options: null
    };

    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);

    await certificateController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: false,
      options: null
    });
    expect(ctx.app.repositoryService.certificateRepository.updateNameAndDescription).toHaveBeenCalledWith(
      '1',
      'new-name',
      'new-description'
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should regenerate a certificate', async () => {
    ctx.params.id = 'id';
    ctx.request.body = certificateCommand;

    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);
    ctx.app.encryptionService.generateSelfSignedCertificate.mockReturnValue({
      private: 'pk',
      public: 'pub',
      cert: 'cert',
      fingerprint: 'f'
    });

    await certificateController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, certificateCommand);
    expect(ctx.app.encryptionService.generateSelfSignedCertificate).toHaveBeenCalledWith(certificateCommand.options);
    expect(ctx.app.repositoryService.certificateRepository.update).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should fail to regenerate a certificate on error', async () => {
    ctx.params.id = 'id';
    ctx.request.body = certificateCommand;

    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);
    ctx.app.encryptionService.generateSelfSignedCertificate.mockImplementationOnce(() => {
      throw new Error('cert error');
    });

    await certificateController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, certificateCommand);
    expect(ctx.app.encryptionService.generateSelfSignedCertificate).toHaveBeenCalledWith(certificateCommand.options);
    expect(ctx.badRequest).toHaveBeenCalledWith('cert error');
  });

  it('should fail to update a certificate when not found', async () => {
    ctx.params.id = 'id';
    ctx.request.body = {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: false,
      options: null
    };

    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(null);

    await certificateController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: false,
      options: null
    });
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('should fail to regenerate with null options', async () => {
    ctx.params.id = 'id';
    ctx.request.body = {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: true,
      options: null
    };

    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);

    await certificateController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, {
      name: 'new-name',
      description: 'new-description',
      regenerateCertificate: true,
      options: null
    });
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('should delete a certificate', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(certificate1);

    await certificateController.delete(ctx);

    expect(ctx.app.repositoryService.certificateRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.certificateRepository.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should return not found when deleting an unknown certificate', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.certificateRepository.findById.mockReturnValue(null);

    await certificateController.delete(ctx);

    expect(ctx.app.repositoryService.certificateRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.certificateRepository.delete).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
