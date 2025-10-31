import { Instant } from './types';
import { LogLevel, ScopeType } from '../../shared/model/logs.model';

export interface OIBusLog {
  timestamp: string;
  level: LogLevel;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  message: string;
}

export interface PinoLog {
  msg: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  time: Instant;
  level: string;
}
