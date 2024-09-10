import JoiValidator from '../web-server/controllers/validators/joi.validator';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIBusEngine from '../engine/oibus-engine';
import SubscriptionRepository from '../repository/subscription.repository';
import { Subscription } from '../model/subscription.model';
import SouthConnectorRepository from '../repository/south-connector.repository';
import NorthConnectorRepository from '../repository/north-connector.repository';

export default class SubscriptionService {
  constructor(
    protected readonly validator: JoiValidator,
    private subscriptionRepository: SubscriptionRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private northConnectorRepository: NorthConnectorRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private oibusEngine: OIBusEngine
  ) {}

  async findByNorth(northId: string): Promise<Array<Subscription>> {
    const northConnector = this.northConnectorRepository.findById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    return this.subscriptionRepository.listSouthByNorth(northConnector.id);
  }

  checkSubscription(northId: string, southId: string): boolean {
    return this.subscriptionRepository.checkSubscription(northId, southId);
  }

  async create(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    if (await this.checkSubscription(northId, southId)) {
      throw new Error('Subscription already exists');
    }

    this.subscriptionRepository.create(northId, southId);
    this.oIAnalyticsMessageService.createFullConfigMessage();
  }

  async delete(northId: string, southId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    const southConnector = this.southConnectorRepository.findById(southId);
    if (!southConnector) {
      throw new Error('South connector not found');
    }

    this.subscriptionRepository.delete(northId, southId);
    this.oibusEngine.updateSubscriptions(northId);
    this.oIAnalyticsMessageService.createFullConfigMessage();
  }

  async deleteAllByNorth(northId: string): Promise<void> {
    const northConnector = this.northConnectorRepository.findById(northId);
    if (!northConnector) {
      throw new Error('North connector not found');
    }

    this.subscriptionRepository.deleteAllByNorth(northId);
    this.oIAnalyticsMessageService.createFullConfigMessage();
  }
}
