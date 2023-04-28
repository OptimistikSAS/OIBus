import os from 'node:os';

import { OIBusInfo } from '../../../shared/model/engine.model';
import { version } from '../../package.json';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';

export default class OIBusService {
  constructor(private engine: OIBusEngine, private historyEngine: HistoryQueryEngine) {}

  getOIBusInfo(): OIBusInfo {
    return {
      version,
      dataDirectory: process.cwd(),
      binaryDirectory: process.execPath,
      processId: process.pid.toString(),
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()}`,
      architecture: process.arch
    };
  }

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

  async addValues(source: string, values: Array<any>): Promise<void> {
    await this.engine.addValues(source, values);
  }

  async addFile(source: string, filePath: string): Promise<void> {
    await this.engine.addFile(source, filePath);
  }
}
