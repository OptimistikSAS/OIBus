import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CommandSearchParam } from '../../../shared/model/command.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import OIAnalyticsCommandServiceMock from '../../tests/__mocks__/service/oia/oianalytics-command-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import type { OIAnalyticsCommandController as OIAnalyticsCommandControllerShape } from './oianalytics-command.controller';

const nodeRequire = createRequire(import.meta.url);

let mockCommandServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let OIAnalyticsCommandController: typeof OIAnalyticsCommandControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockCommandServiceModule = { toOIBusCommandDTO: mock.fn((command: unknown) => command) };
  mockModule(nodeRequire, '../../service/oia/oianalytics-command.service', mockCommandServiceModule);
  const mod = reloadModule<{ OIAnalyticsCommandController: typeof OIAnalyticsCommandControllerShape }>(
    nodeRequire,
    './oianalytics-command.controller'
  );
  OIAnalyticsCommandController = mod.OIAnalyticsCommandController;
});

describe('OIAnalyticsCommandController', () => {
  let controller: OIAnalyticsCommandControllerShape;
  let commandService: OIAnalyticsCommandServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    commandService = new OIAnalyticsCommandServiceMock();
    mockRequest = {
      services: Object.assign({} as CustomExpressRequest['services'], { oIAnalyticsCommandService: commandService })
    } as Partial<CustomExpressRequest>;
    mockCommandServiceModule.toOIBusCommandDTO = mock.fn((command: unknown) => command);
    controller = new OIAnalyticsCommandController();
  });

  it('should return commands with search parameters', async () => {
    const types = 'update-version,restart-engine';
    const status = 'ERRORED,RETRIEVED';
    const page = 1;
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;
    const ack = true;

    const searchParams: CommandSearchParam = {
      types: ['update-version', 'restart-engine'],
      status: ['ERRORED', 'RETRIEVED'],
      page: 1,
      start,
      end,
      ack
    };

    const expectedResult = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 1);
    commandService.search = mock.fn(() => expectedResult);

    const result = await controller.search(types, status, start, end, ack, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(commandService.search.mock.calls.length, 1);
    assert.deepStrictEqual(commandService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return commands with default search parameters', async () => {
    const searchParams: CommandSearchParam = {
      types: [],
      status: [],
      page: 0,
      start: undefined,
      end: undefined,
      ack: undefined
    };

    const expectedResult = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 0);
    commandService.search = mock.fn(() => expectedResult);

    const result = await controller.search(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(commandService.search.mock.calls.length, 1);
    assert.deepStrictEqual(commandService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should delete a command', async () => {
    const commandId = 'id';
    commandService.delete = mock.fn(async () => undefined);

    await controller.delete(commandId, mockRequest as CustomExpressRequest);

    assert.strictEqual(commandService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(commandService.delete.mock.calls[0].arguments[0], commandId);
  });
});
