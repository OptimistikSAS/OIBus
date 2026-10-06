import { LogLevel, ScopeType } from '../../shared/model/domain/logs.model';

import { Instant } from './types';

export interface OIBusLog {
  timestamp: string;
  level: LogLevel;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  itemId: string | null;
  itemName: string | null;
  groupId: string | null;
  groupName: string | null;
  message: string;
}

export interface PinoLog {
  msg: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  itemId?: string | null;
  itemName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  time: Instant;
  level: string;
}
