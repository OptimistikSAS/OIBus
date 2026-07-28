import os from 'node:os';
import type { Writable } from 'node:stream';

import build from 'pino-abstract-transport';
import { buildOptions } from 'pino-syslog/lib/utils';
import { messageBuilderFactory } from 'pino-syslog/lib/rfc5424';
import socketTransport from 'pino-socket';
import { PinoLog } from '../../model/logs.model';

export interface SyslogTransportOptions {
  host: string;
  port: number;
  protocol: 'udp4' | 'tcp';
  appName: string;
}

/**
 * RFC 5424 HOSTNAME/APP-NAME/PROCID/MSGID header fields must each be a single
 * PRINTUSASCII token (no spaces), 1-48 characters, or the NILVALUE "-". `appName`
 * comes from the user-editable engine name, which may contain spaces, so it (and
 * the OS hostname, just in case) must be sanitized before going in the header —
 * otherwise it shifts every field after it, as seen with "OIBus dev macOS ARM".
 */
export const toSyslogField = (value: string | undefined | null): string => {
  if (!value) return '-';
  const sanitized = value
    .replace(/\s+/g, '-')
    .replace(/[^\x21-\x7e]/g, '')
    .slice(0, 48);
  return sanitized || '-';
};

class SyslogTransport {
  private readonly formatMessage: (log: unknown) => string;
  private readonly hostname = toSyslogField(os.hostname());
  private readonly pid = process.pid;
  private socket: Writable | null = null;

  constructor(private readonly options: SyslogTransportOptions) {
    const syslogOpts = buildOptions({ appname: toSyslogField(options.appName), newline: true, enablePipelining: false });
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
      // pino-socket's UDP mode forwards `dgram.send()` failures (e.g. ECONNREFUSED when nothing is
      // listening) straight to the write callback, which makes this Writable emit a genuine 'error'
      // event. With no listener, Node's default behavior is to throw and crash the whole process —
      // a down/unreachable syslog server must never take OIBus down with it, so this only logs it.
      this.socket.on('error', (error: Error) => {
        console.error(`Syslog socket error at ${this.options.host}:${this.options.port}: ${error.message}`);
      });
    } catch (error: unknown) {
      console.error(`Failed to connect to syslog server at ${this.options.host}:${this.options.port}: ${(error as Error).message}`);
    }
  }

  send(log: PinoLog): void {
    if (!this.socket) return;
    try {
      // pino is configured with `timestamp: pino.stdTimeFunctions.isoTime`, so `log.time` is an ISO
      // string here. pino-syslog's rfc5424 formatter calls `DateTime.fromMillis(data.time)`, which
      // requires epoch milliseconds, so it must be converted back before formatting.
      // `base: undefined` on the pino instance also strips the default `hostname`/`pid` fields, so
      // they're supplied here instead.
      // Mutated in place rather than spread into a new object. All configured transports (this one,
      // sqlite, oia, loki, console, file) share a single worker thread (pino.transport({ targets })
      // spawns one worker for the whole array), but each target's pino-abstract-transport `build()`
      // call runs its own private split2 stream that independently JSON.parses the same raw ndjson
      // line — so `log` here is a private object, never shared with the other transports, and safe
      // to overwrite in place, avoiding an allocation on every single log line.
      const record = log as unknown as { time: number; hostname: string; pid: number };
      record.time = Date.parse(log.time);
      record.hostname = this.hostname;
      record.pid = this.pid;
      this.socket.write(this.formatMessage(record));
    } catch (error: unknown) {
      console.error(`Failed to write message to syslog server at ${this.options.host}:${this.options.port}: ${(error as Error).message}`);
    }
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
      close: async () => {
        await transport.end();
      }
    }
  );
};

export default createTransport;
