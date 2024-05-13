import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import pino from 'pino';
import { OIBusContent } from '../../../shared/model/engine.model';

export default class OIBusService {
  constructor(
    private engine: OIBusEngine,
    private historyEngine: HistoryQueryEngine
  ) {}

  async restartOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
    await this.engine.start();
    await this.historyEngine.start();
  }

  async stopOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
  }

  async addExternalContent(northId: string, content: OIBusContent): Promise<void> {
    await this.engine.addExternalContent(northId, content);
  }

  setLogger(logger: pino.Logger) {
    this.engine.setLogger(logger);
    this.historyEngine.setLogger(logger);
  }
}
