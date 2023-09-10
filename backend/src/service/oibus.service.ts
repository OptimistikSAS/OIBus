import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';

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

  async addValues(externalSourceId: string | null, values: Array<any>): Promise<void> {
    await this.engine.addExternalValues(externalSourceId, values);
  }

  async addFile(externalSourceId: string | null, filePath: string): Promise<void> {
    await this.engine.addExternalFile(externalSourceId, filePath);
  }
}
