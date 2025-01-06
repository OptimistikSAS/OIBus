import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import CertificateController from './certificate.controller';
import testData from '../../tests/utils/test-data';
import { toCertificateDTO } from '../../service/certificate.service';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const certificateController = new CertificateController(validator, schema);

const ctx = new KoaContextMock();

describe('Certificate controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should find all certificates', async () => {
    ctx.app.certificateService.findAll.mockReturnValue(testData.certificates.list);

    await certificateController.findAll(ctx);

    expect(ctx.app.certificateService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.certificates.list.map(element => toCertificateDTO(element)));
  });

  it('should find a certificate by id', async () => {
    ctx.params.id = 'id';
    ctx.app.certificateService.findById.mockReturnValue(testData.certificates.list[0]);

    await certificateController.findById(ctx);

    expect(ctx.app.certificateService.findById).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(toCertificateDTO(testData.certificates.list[0]));
  });

  it('should return not found', async () => {
    ctx.params.id = 'id';
    ctx.app.certificateService.findById.mockReturnValue(null);

    await certificateController.findById(ctx);

    expect(ctx.app.certificateService.findById).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('should create a certificate', async () => {
    ctx.request.body = testData.certificates.command;
    ctx.app.certificateService.create.mockReturnValue(testData.certificates.list[0]);

    await certificateController.create(ctx);

    expect(ctx.app.certificateService.create).toHaveBeenCalledWith(testData.certificates.command);
    expect(ctx.created).toHaveBeenCalledWith(toCertificateDTO(testData.certificates.list[0]));
  });

  it('should not create a certificate if bad request', async () => {
    ctx.request.body = testData.certificates.command;
    ctx.app.certificateService.create.mockImplementationOnce(() => {
      throw new Error('bad request');
    });
    await certificateController.create(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('should update a certificate', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.certificates.command;

    await certificateController.update(ctx);

    expect(ctx.app.certificateService.update).toHaveBeenCalledWith('id', testData.certificates.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should not update a certificate if bad request', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.certificates.command;
    ctx.app.certificateService.update.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await certificateController.update(ctx);

    expect(ctx.app.certificateService.update).toHaveBeenCalledWith('id', testData.certificates.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('should delete a certificate', async () => {
    ctx.params.id = 'id';

    await certificateController.delete(ctx);

    expect(ctx.app.certificateService.delete).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should return not found when deleting an unknown certificate', async () => {
    ctx.params.id = 'id';
    ctx.app.certificateService.delete.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await certificateController.delete(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });
});
