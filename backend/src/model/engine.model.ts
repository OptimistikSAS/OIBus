import { BaseEntity } from './types';
import { LogLevel } from '../../../shared/model/engine.model';

export interface EngineSettings extends BaseEntity {
  name: string;
  port: number;
  version: string;
  proxyEnabled: boolean;
  proxyPort: number | null;
  logParameters: {
    console: {
      level: LogLevel;
    };
    file: {
      level: LogLevel;
      maxFileSize: number;
      numberOfFiles: number;
    };
    database: {
      level: LogLevel;
      maxNumberOfLogs: number;
    };
    loki: {
      level: LogLevel;
      interval: number;
      address: string;
      username: string;
      password: string;
    };
    oia: {
      level: LogLevel;
      interval: number;
    };
  };
}

export class OIBusError extends Error {
  constructor(
    message: string,
    readonly retry: boolean
  ) {
    super(message);
  }
}
