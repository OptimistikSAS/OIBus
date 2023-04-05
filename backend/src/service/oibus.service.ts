import os from 'node:os';

import { OIBusInfo } from '../../../shared/model/engine.model';
import { version } from '../../package.json';

export default class OIBusService {
  constructor() {}

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
}
