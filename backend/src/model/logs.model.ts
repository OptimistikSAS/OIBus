import { LogLevel, ScopeType } from '../../shared/model/engine.model';

export interface OIBusLog {
  timestamp: string;
  level: LogLevel;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeName: string | null;
  message: string;
}
