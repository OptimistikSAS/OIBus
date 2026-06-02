import type { Writable } from 'node:stream';

import build from 'pino-abstract-transport';
import { buildOptions } from 'pino-syslog/lib/utils';
import { messageBuilderFactory } from 'pino-syslog/lib/rfc5424';
import socketTransport from 'pino-socket';

export interface SyslogTransportOptions {
  host: string;
  port: number;
  protocol: 'udp4' | 'tcp';
  appName: string;
}

class SyslogTransport {
  private readonly formatMessage: (log: unknown) => string;
  private socket: Writable | null = null;

  constructor(private readonly options: SyslogTransportOptions) {
    const syslogOpts = buildOptions({ appname: options.appName, newline: true, enablePipelining: false });
    this.formatMessage = messageBuilderFactory(syslogOpts);
  }

  async connect(): Promise<void> {
    try {
      this.socket = await socketTransport({
        address: this.options.host,
        port: this.options.port,
        mode: this.options.protocol,
        reconnect: true,
        sourceStream: false
      });
    } catch (error: unknown) {
      console.error(`Failed to connect to syslog server at ${this.options.host}:${this.options.port}: ${(error as Error).message}`);
    }
  }

  send(log: unknown): void {
    if (!this.socket) return;
    this.socket.write(this.formatMessage(log));
  }

  end(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

const createTransport = async (opts: SyslogTransportOptions) => {
  const transport = new SyslogTransport(opts);
  await transport.connect();
  return build(
    async source => {
      for await (const log of source) {
        transport.send(log);
      }
    },
    {
      close: () => {
        transport.end();
      }
    }
  );
};

export default createTransport;
