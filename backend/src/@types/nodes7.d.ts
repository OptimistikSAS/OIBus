declare module '@st-one-io/nodes7' {
  import { EventEmitter } from 'node:events';

  export class S7Endpoint extends EventEmitter {
    constructor(opts: {
      host: string;
      port?: number;
      rack?: number;
      slot?: number;
      srcTSAP?: number;
      dstTSAP?: number;
      autoReconnect?: number;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    readonly isConnected: boolean;
  }

  export class S7ItemGroup {
    constructor(endpoint: S7Endpoint);
    setTranslationCB(cb: (name: string) => string | undefined): void;
    addItems(names: string | Array<string>): void;
    removeItems(names: string | Array<string>): void;
    readAllItems(): Promise<Record<string, unknown>>;
    destroy(): void;
  }
}
