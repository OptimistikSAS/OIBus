import { LogLevel } from './engine.model';

/**
 * DTO used for Log entries
 */
export interface LogDTO {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
}

export interface LogStreamValuesCommandDTO {
  values: [number, string];
  stream: {
    level: LogLevel;
    oibus: string;
    scope: string;
  };
}
export interface LogStreamCommandDTO {
  streams: Array<LogStreamValuesCommandDTO>;
}

export interface LogSearchParam {
  page: number | null;
  start: string | null;
  end: string | null;
  levels: Array<LogLevel>;
  scope: string | null;
  messageContent: string | null;
}
