import Joi from 'joi';

import ContentControler from './content.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { OIBusContent } from '../../../../shared/model/engine.model';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const validator = new JoiValidator();
const schema = Joi.object({});
const oibusController = new ContentControler(validator, schema);

const ctx = new KoaContextMock();

const content: OIBusContent = {
  type: 'time-values',
  content: []
};

const fileContent: OIBusContent = {
  type: 'raw',
  filePath: 'filePath'
};

describe('Content controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('should add values', async () => {
    ctx.request.body = content;
    ctx.request.query = { name: 'source', northId: 'northId' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    await oibusController.addContent(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.addExternalContent).toHaveBeenCalledWith('northId', content);
  });

  it('should add values with null as external source', async () => {
    ctx.request.body = content;
    ctx.request.query = { name: 'source', northId: 'northId' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue(null);
    await oibusController.addContent(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.app.oibusService.addExternalContent).not.toHaveBeenCalled();
  });

  it('should not add values if no source name provided', async () => {
    ctx.request.body = content;
    ctx.request.query = { northId: 'northId' };

    await oibusController.addContent(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.app.oibusService.addExternalContent).not.toHaveBeenCalled();
  });

  it('should properly manage internal error when adding values', async () => {
    (ctx.app.oibusService.addExternalContent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('internal error');
    });
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    ctx.request.body = content;
    ctx.request.query = { name: 'source', northId: ['northId1', 'northId2'] };
    await oibusController.addContent(ctx);
    expect(ctx.internalServerError).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('should add file', async () => {
    ctx.request.query = { name: 'source', northId: 'northId' };
    ctx.request.body = fileContent;
    ctx.request.file = { path: 'filePath' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    await oibusController.addContent(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.addExternalContent).toHaveBeenCalledWith('northId', { type: 'raw', filePath: 'filePath' });
  });
});
