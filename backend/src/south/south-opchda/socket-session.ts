import pino from 'pino';

/**
 * Class representing a connected socketSession.
 */
export default class SocketSession {
  private readonly name: string;
  private receivedMessage: string;
  constructor(
    private socket: any,
    private logger: pino.Logger,
    private closeCallback: () => Promise<void>,
    private handleMessage: (message: string) => Promise<void>
  ) {
    this.name = `${socket.remoteAddress}:${socket.remotePort}`;
    this.receivedMessage = '';
    this.bindSocketEvents();
  }

  bindSocketEvents(): void {
    this.socket.on('data', async (data: any) => {
      const content = data.toString();
      const responses: Array<any> = [];

      if (content.includes('\n')) {
        const messageParts = content.split('\n');

        messageParts.forEach((messagePart: string, index: number) => {
          if (index === 0) {
            this.receivedMessage += messagePart;
            responses.push(this.receivedMessage);
            this.receivedMessage = '';
          } else if (index === messageParts.length - 1) {
            this.receivedMessage = messagePart;
          } else {
            responses.push(messagePart);
          }
        });
      } else {
        this.receivedMessage += content;
      }

      await Promise.all(responses.map(response => this.handleMessage(response.trim())));
    });

    this.socket.on('close', async () => {
      this.logger.info(`Socket "${this.name}" closed.`);
      await this.closeCallback();
    });

    this.socket.on('error', (error: Error) => {
      this.logger.error(`Error on socket ${this.name}: ${error}`);
    });
  }

  sendMessage(message: string): void {
    this.socket.write(`${message}\n`);
  }

  close(): void {
    this.socket.destroy();
  }
}
