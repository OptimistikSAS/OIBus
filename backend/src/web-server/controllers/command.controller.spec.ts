import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { CommandSearchParam, OIBusCommandDTO } from '../../../../shared/model/command.model';
import CommandController from './command.controller';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const commandController = new CommandController(validator, schema);

const ctx = new KoaContextMock();
const oibusCommand: OIBusCommandDTO = {
  id: 'id1',
  type: 'UPGRADE',
  version: 'v3.2.0',
  assetId: 'assetId',
  status: 'ERRORED',
  ack: true
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
    jest.resetAllMocks();
  });

  it('searchCommands() should return commands', async () => {
    ctx.query.status = ['ERRORED'];
    ctx.query.types = ['UPGRADE'];
    ctx.query.page = 1;
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    ctx.app.repositoryService.commandRepository.searchCommandsPage.mockReturnValue(page);

    await commandController.searchCommands(ctx);

    expect(ctx.app.repositoryService.commandRepository.searchCommandsPage).toHaveBeenCalledWith(searchParams, 1);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchCommands() should return commands with default search params', async () => {
    ctx.query = {
      types: 'UPGRADE',
      status: 'ERRORED'
    };
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    ctx.app.repositoryService.commandRepository.searchCommandsPage.mockReturnValue(page);

    await commandController.searchCommands(ctx);

    expect(ctx.app.repositoryService.commandRepository.searchCommandsPage).toHaveBeenCalledWith(searchParams, 0);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });
});
