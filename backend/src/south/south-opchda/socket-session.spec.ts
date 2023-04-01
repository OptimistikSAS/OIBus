import Stream from 'node:stream';
import SocketSession from './socket-session';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';

const logger: pino.Logger = new PinoLogger();
const closeCallback = jest.fn();
const handleMessage = jest.fn();

class CustomSocket extends Stream {
  constructor(public remoteAddress: string, public remotePort: string) {
    super();
  }

  write() {}
  destroy() {}
}
let socket: CustomSocket;
let socketSession: SocketSession;

describe('SocketSession', () => {
  beforeEach(() => {
    socket = new CustomSocket('1.2.3.4', '1234');

    socketSession = new SocketSession(socket, logger, closeCallback, handleMessage);
  });

  it('it should manage socket event', () => {
    socket.emit('close');
    expect(closeCallback).toHaveBeenCalledTimes(1);

    socket.emit('error', new Error('myError'));
    expect(logger.error).toHaveBeenCalledWith(`Error on socket 1.2.3.4:1234: ${new Error('myError')}`);

    socket.emit('data', 'my first ');
    socket.emit('data', 'message in\n three parts\n');
    socket.emit('data', 'my second message\n');
    socket.emit('data', 'my third message\n');
    expect(handleMessage).toHaveBeenCalledTimes(4);
    expect(handleMessage).toHaveBeenCalledWith('my first message in');
    expect(handleMessage).toHaveBeenCalledWith('three parts');
    expect(handleMessage).toHaveBeenCalledWith('my second message');
    expect(handleMessage).toHaveBeenCalledWith('my third message');
  });

  it('it should write message in socket', () => {
    socket.write = jest.fn();
    socketSession.sendMessage('my message to send');
    expect(socket.write).toHaveBeenCalledWith('my message to send\n');
  });

  it('it should properly close socket if opened', () => {
    socket.destroy = jest.fn();
    socketSession.close();
    expect(socket.destroy).toHaveBeenCalledWith();
  });
});
