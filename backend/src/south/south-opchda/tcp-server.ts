import net from 'node:net';

import SocketSession from './socket-session';
import pino from 'pino';
import { Server } from 'net';

/**
 * Class TcpServer - Create a TCP netServer to communicate with the HDA agent
 */
export default class TcpServer {
  private netServer: Server | null = null;
  private socketSession: SocketSession | null = null;
  constructor(private port: number, private handleMessage: (message: string) => Promise<void>, private logger: pino.Logger) {
    this.netServer = null;
  }

  start(callback: () => void): void {
    this.netServer = net.createServer();

    // Bind netServer events
    this.bindServerEvents();

    // Start listening
    this.netServer.listen(this.port, callback);
  }

  bindServerEvents(): void {
    if (!this.netServer) {
      return;
    }
    this.netServer.on('listening', () => {
      this.logger.info(`TCP server listening on port ${this.port}`);
    });

    this.netServer.on('connection', socket => {
      const name = `${socket.remoteAddress}:${socket.remotePort}`;
      this.logger.info(`New connection attempt from "${name}"`);

      if (!this.socketSession) {
        this.socketSession = new SocketSession(socket, this.logger, this.closeCallback.bind(this), this.handleMessage.bind(this));
        this.logger.info(`Connection accepted from "${name}"`);
      } else {
        this.logger.error(`Session already open, closing connection from "${name}"`);
        socket.destroy();
      }
    });

    this.netServer.on('close', () => {
      this.logger.info('TCP server closed');
    });

    this.netServer.on('error', error => {
      this.logger.error(error);
    });
  }

  async closeCallback(): Promise<void> {
    this.socketSession = null;
    const disconnectMessage = {
      Reply: 'Disconnect',
      TransactionId: '',
      Content: {}
    };
    await this.handleMessage(JSON.stringify(disconnectMessage));
  }

  sendMessage(message: string): void {
    if (this.socketSession) {
      this.socketSession.sendMessage(message);
    }
  }

  stop(): void {
    if (this.socketSession) {
      this.socketSession.close();
      this.socketSession = null;
    }

    if (this.netServer) {
      this.netServer.close();
      this.netServer.unref();
      this.netServer = null;
    }
  }
}
