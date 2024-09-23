import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import { SouthConnectorEntityLight } from '../model/south-connector.model';

export default class SubscriptionService {
  constructor(
    protected readonly validator: JoiValidator,
    private southConnectorRepository: SouthConnectorRepository,
    private northConnectorRepository: NorthConnectorRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService
  ) {}

  async findByNorth(northId: string): Promise<Array<SouthConnectorEntityLight>> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    return this.northConnectorRepository.listNorthSubscriptions(northConnector.id);
  }

  checkSubscription(northId: string, southId: string): boolean {
    return this.northConnectorRepository.checkSubscription(northId, southId);
  }

  async create(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    if (this.checkSubscription(northId, southId)) {
      throw new Error('Subscription already exists');
    }

    this.northConnectorRepository.createSubscription(northId, southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findSouthById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    this.northConnectorRepository.deleteSubscription(northId, southId);
    // TODO this.oibusEngine.updateSubscriptions(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async deleteAllByNorth(northId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findNorthById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.northConnectorRepository.deleteAllSubscriptionsByNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}
