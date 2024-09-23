import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import testData from '../tests/utils/test-data';
import SubscriptionService from './subscription.service';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: SubscriptionService;
describe('Subscription Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new SubscriptionService(validator, southConnectorRepository, northConnectorRepository, oIAnalyticsMessageService);
  });

  it('findByNorth() should list Subscription by North', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValueOnce(testData.north.list[0].subscriptions);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    const result = await service.findByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(result).toEqual(testData.north.list[0].subscriptions);
  });

  it('findByNorth() should throw an error if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.findByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).not.toHaveBeenCalled();
  });

  it('checkSubscription() should check if subscription is set', () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    expect(service.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);

    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
  });

  it('create() should create a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(false);

    await service.create(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(northConnectorRepository.createSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('create() should throw if subscription already exists', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('Subscription already exists');

    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('South connector not found');

    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('North connector not found');

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.delete(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.deleteSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('South connector not found');

    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('North connector not found');

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('deleteAllByNorth() should delete all subscriptions by North', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteAllByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteAllByNorth() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');

    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });
});
