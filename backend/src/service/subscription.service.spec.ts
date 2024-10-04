import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import testData from '../tests/utils/test-data';
import SubscriptionService from './subscription.service';
import SubscriptionRepository from '../repository/subscription.repository';
import SubscriptionRepositoryMock from '../tests/__mocks__/repository/subscription-repository.mock';
import SouthConnectorRepository from '../repository/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/south-connector-repository.mock';
import NorthConnectorRepository from '../repository/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/north-connector-repository.mock';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const subscriptionRepository: SubscriptionRepository = new SubscriptionRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const oibusEngine: OIBusEngine = new OibusEngineMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: SubscriptionService;
describe('Subscription Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new SubscriptionService(
      validator,
      subscriptionRepository,
      southConnectorRepository,
      northConnectorRepository,
      oIAnalyticsMessageService,
      oibusEngine
    );
  });

  it('findByNorth() should list Subscription by North', async () => {
    (subscriptionRepository.listSouthByNorth as jest.Mock).mockReturnValueOnce(testData.subscriptions.list);
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    const result = await service.findByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(subscriptionRepository.listSouthByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(result).toEqual(testData.subscriptions.list);
  });

  it('findByNorth() should throw an error if North not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.findByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');
    expect(northConnectorRepository.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(subscriptionRepository.listSouthByNorth).not.toHaveBeenCalled();
  });

  it('checkSubscription() should check if subscription is set', () => {
    (subscriptionRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    expect(service.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);

    expect(subscriptionRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
  });

  it('create() should create a subscription', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (subscriptionRepository.checkSubscription as jest.Mock).mockReturnValueOnce(false);

    await service.create(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(subscriptionRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(subscriptionRepository.create).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('create() should throw if subscription already exists', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (subscriptionRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('Subscription already exists');

    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if South not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('South connector not found');

    expect(subscriptionRepository.checkSubscription).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if North not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.create(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('North connector not found');

    expect(southConnectorRepository.findById).not.toHaveBeenCalled();
    expect(subscriptionRepository.checkSubscription).not.toHaveBeenCalled();
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete a subscription', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.delete(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(subscriptionRepository.delete).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oibusEngine.updateSubscriptions).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should throw if South not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('South connector not found');

    expect(subscriptionRepository.delete).not.toHaveBeenCalled();
    expect(oibusEngine.updateSubscriptions).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should throw if North not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow('North connector not found');

    expect(southConnectorRepository.findById).not.toHaveBeenCalled();
    expect(subscriptionRepository.delete).not.toHaveBeenCalled();
    expect(oibusEngine.updateSubscriptions).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('deleteAllByNorth() should delete all subscriptions by North', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteAllByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(subscriptionRepository.deleteAllByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteAllByNorth() should throw if North not found', async () => {
    (northConnectorRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');

    expect(subscriptionRepository.deleteAllByNorth).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });
});
