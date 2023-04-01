import Stream from 'node:stream';
import TcpServer from './tcp-server';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';

const logger: pino.Logger = new PinoLogger();
const handleMessage = jest.fn();
const netSocket = { remoteAddress: '1.2.3.4', remotePort: 1234, destroy: jest.fn() };

jest.mock('./socket-session');

class CustomServer extends Stream {
  constructor() {
    super();
  }

  listen() {}
  close() {}
  unref() {}
}
const mockNetServer = new CustomServer();
mockNetServer.listen = jest.fn();
mockNetServer.close = jest.fn();
mockNetServer.unref = jest.fn();
jest.mock('node:net', () => ({ createServer: () => mockNetServer }));

let tcpServer: TcpServer;

describe('TcpServer', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    tcpServer = new TcpServer(1234, handleMessage, logger);
  });

  it('should manage net event', () => {
    const startCallback = jest.fn();

    tcpServer.start(startCallback);

    expect(mockNetServer.listen).toHaveBeenCalledWith(1234, startCallback);

    mockNetServer.emit('listening');
    expect(logger.info).toHaveBeenCalledWith('TCP server listening on port 1234');

    mockNetServer.emit('close');
    expect(logger.info).toHaveBeenCalledWith('TCP server closed');

    mockNetServer.emit('error', 'myNetError');
    expect(logger.error).toHaveBeenCalledWith('myNetError');

    mockNetServer.emit('connection', netSocket);
    expect(logger.info).toHaveBeenCalledWith(`Connection accepted from "${netSocket.remoteAddress}:${netSocket.remotePort}"`);

    tcpServer.stop();
    expect(mockNetServer.close).toHaveBeenCalledTimes(1);
    expect(mockNetServer.unref).toHaveBeenCalledTimes(1);
  });

  it('should properly close send disconnect message', async () => {
    await tcpServer.closeCallback();
    const disconnectMessage = {
      Reply: 'Disconnect',
      TransactionId: '',
      Content: {}
    };
    expect(handleMessage).toHaveBeenCalledWith(JSON.stringify(disconnectMessage));
  });

  it('should properly stop the server and close the socket session', () => {
    tcpServer.stop();
    expect(mockNetServer.close).not.toHaveBeenCalled();
    expect(mockNetServer.unref).not.toHaveBeenCalled();
  });
});
