export interface ILogger {
  trace(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  debug(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  info(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  warn(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  error(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  fatal(obj: unknown, msg?: string, ...args: Array<unknown>): void;
  child(bindings: Record<string, unknown>, options?: Record<string, unknown>): ILogger;
}
