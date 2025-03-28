import { LogLevel, ScopeType } from './engine.model';
import { Instant } from './types';

export interface LogDTO {
  timestamp: string;
  level: LogLevel;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  message: string;
}

export interface Scope {
  scopeId: string;
  scopeName: string;
}

export interface PinoLog {
  msg: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  time: Instant;
  level: string;
}

export const LEVEL_FORMAT: Record<string, LogLevel> = {
  '10': 'trace',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error',
  '60': 'fatal'
};

export interface LogStreamValuesCommandDTO {
  values: Array<[string, string]>;
  stream: {
    level: LogLevel;
    oibus: string;
    oibusName: string;
    scopeType: string;
    scopeId: string | null;
    scopeName: string | null;
  };
}
export interface LogStreamCommandDTO {
  streams: Array<LogStreamValuesCommandDTO>;
}

export interface LogSearchParam {
  page: number;
  start: string | null;
  end: string | null;
  levels: Array<LogLevel>;
  scopeIds: Array<string>;
  scopeTypes: Array<string>;
  messageContent: string | null;
}
