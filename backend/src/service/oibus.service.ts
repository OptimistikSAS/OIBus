import os from 'node:os';

import { OIBusInfo } from '../../../shared/model/engine.model';

export default class OIBusService {
  constructor() {}

  getOIBusInfo(): OIBusInfo {
    return {
      version: '3.0',
      dataDirectory: process.cwd(),
      binaryDirectory: process.execPath,
      processId: process.pid.toString(),
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()}`,
      architecture: process.arch
    };
  }
}
