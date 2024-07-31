import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { CommandSearchParam, OIBusCommandDTO } from '../../../../shared/model/command.model';
import OianalyticsCommandController from './oianalytics-command.controller';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const commandController = new OianalyticsCommandController(validator, schema);

const ctx = new KoaContextMock();
const oibusCommand: OIBusCommandDTO = {
  id: 'id1',
  type: 'update-version',
  version: 'v3.2.0',
  assetId: 'assetId'
};
const page = {
  content: [oibusCommand],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};

describe('Command controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('search() should return commands', async () => {
    ctx.query.status = ['ERRORED'];
    ctx.query.types = ['UPGRADE'];
    ctx.query.page = 1;
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    ctx.app.repositoryService.oianalyticsCommandRepository.search.mockReturnValue(page);

    await commandController.search(ctx);

    expect(ctx.app.repositoryService.oianalyticsCommandRepository.search).toHaveBeenCalledWith(searchParams, 1);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('search() should return commands with default search params', async () => {
    ctx.query = {
      types: 'UPGRADE',
      status: 'ERRORED'
    };
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    ctx.app.repositoryService.oianalyticsCommandRepository.search.mockReturnValue(page);

    await commandController.search(ctx);

    expect(ctx.app.repositoryService.oianalyticsCommandRepository.search).toHaveBeenCalledWith(searchParams, 0);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });
});
