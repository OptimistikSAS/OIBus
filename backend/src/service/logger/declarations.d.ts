declare module 'pino-syslog/lib/utils' {
  interface SyslogOptions {
    appname: string;
    facility: number;
    newline: boolean;
    modern: boolean;
    messageOnly: boolean;
    includeProperties: Array<string>;
    tz: string;
    sync: boolean;
    enablePipelining: boolean;
    pinoLevelToSyslogSeverity: Map<number, number>;
  }
  function buildOptions(options?: Record<string, unknown>): SyslogOptions;
  export { buildOptions, SyslogOptions };
}

declare module 'pino-syslog/lib/rfc5424' {
  import type { SyslogOptions } from 'pino-syslog/lib/utils';
  function messageBuilderFactory(options: SyslogOptions): (log: unknown) => string;
  export { messageBuilderFactory };
}

declare module 'pino-socket' {
  import type { Writable } from 'node:stream';
  interface PinoSocketOptions {
    address?: string;
    port?: number;
    mode?: 'udp4' | 'tcp';
    reconnect?: boolean;
    sourceStream?: false | NodeJS.ReadableStream;
  }
  function socketTransport(options: PinoSocketOptions): Promise<Writable>;
  export = socketTransport;
}
