import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import testData from '../tests/utils/test-data';
import { ipFilterSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import IPFilterService, { toIPFilterDTO } from './ip-filter.service';
import IpFilterRepositoryMock from '../tests/__mocks__/repository/config/ip-filter-repository.mock';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import IpFilterRepository from '../repository/config/ip-filter.repository';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';

let validator: { validate: ReturnType<typeof mock.fn> };
let ipFilterRepository: IpFilterRepositoryMock;
let oIAnalyticsMessageService: OianalyticsMessageServiceMock;
let service: IPFilterService;

describe('IP Filter Service', () => {
  beforeEach(() => {
    validator = { validate: mock.fn() };
    ipFilterRepository = new IpFilterRepositoryMock();
    oIAnalyticsMessageService = new OianalyticsMessageServiceMock();
    service = new IPFilterService(
      validator as unknown as JoiValidator,
      ipFilterRepository as unknown as IpFilterRepository,
      oIAnalyticsMessageService as unknown as OIAnalyticsMessageService
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should list all ip filters', () => {
    ipFilterRepository.list.mock.mockImplementationOnce(() => testData.ipFilters.list);

    const result = service.list();

    assert.ok(ipFilterRepository.list.mock.calls.length > 0);
    assert.deepStrictEqual(result, testData.ipFilters.list);
  });

  it('should find an ip filter by id', () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => testData.ipFilters.list[0]);

    const result = service.findById(testData.ipFilters.list[0].id);

    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.deepStrictEqual(result, testData.ipFilters.list[0]);
  });

  it('should not get if the ip filter is not found', () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.findById(testData.ipFilters.list[0].id), {
      message: `IP filter "${testData.ipFilters.list[0].id}" not found`
    });
    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
  });

  it('should create an ip filter', async () => {
    ipFilterRepository.create.mock.mockImplementationOnce(() => testData.ipFilters.list[0]);
    ipFilterRepository.list.mock.mockImplementationOnce(() => testData.ipFilters.list);

    const result = await service.create(testData.ipFilters.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [ipFilterSchema, testData.ipFilters.command]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
    assert.deepStrictEqual(result, testData.ipFilters.list[0]);
  });

  it('should update an ip filter', async () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => testData.ipFilters.list[0]);
    ipFilterRepository.list.mock.mockImplementationOnce(() => testData.ipFilters.list);

    await service.update(testData.ipFilters.list[0].id, testData.ipFilters.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [ipFilterSchema, testData.ipFilters.command]);
    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.ok(ipFilterRepository.list.mock.calls.length > 0);
    assert.deepStrictEqual(ipFilterRepository.update.mock.calls[0].arguments, [
      testData.ipFilters.list[0].id,
      testData.ipFilters.command,
      'userTest'
    ]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
  });

  it('should not update if the ip filter is not found', async () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.update(testData.ipFilters.list[0].id, testData.ipFilters.command, 'userTest'), {
      message: `IP filter "${testData.ipFilters.list[0].id}" not found`
    });

    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.strictEqual(ipFilterRepository.update.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 0);
  });

  it('should delete an ip filter', async () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => testData.ipFilters.list[0]);
    ipFilterRepository.list.mock.mockImplementationOnce(() => testData.ipFilters.list);

    await service.delete(testData.ipFilters.list[0].id);

    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.deepStrictEqual(ipFilterRepository.delete.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
  });

  it('should not delete if the IP filter is not found', async () => {
    ipFilterRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.delete(testData.ipFilters.list[0].id), {
      message: `IP filter "${testData.ipFilters.list[0].id}" not found`
    });

    assert.deepStrictEqual(ipFilterRepository.findById.mock.calls[0].arguments, [testData.ipFilters.list[0].id]);
    assert.strictEqual(ipFilterRepository.delete.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 0);
  });

  it('should properly convert to DTO', () => {
    const ipFilter = testData.ipFilters.list[0];
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    assert.deepStrictEqual(toIPFilterDTO(ipFilter, getUserInfo), {
      id: ipFilter.id,
      address: ipFilter.address,
      description: ipFilter.description,
      createdBy: getUserInfo(ipFilter.createdBy),
      updatedBy: getUserInfo(ipFilter.updatedBy),
      createdAt: ipFilter.createdAt,
      updatedAt: ipFilter.updatedAt
    });
  });
});
