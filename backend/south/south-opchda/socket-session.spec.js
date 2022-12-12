import Stream from 'node:stream'
import SocketSession from './socket-session.js'

const logger = { error: jest.fn() }
const closeCallback = jest.fn()
const handleMessage = jest.fn()
let socket = null
let socketSession = null

describe('SocketSession', () => {
  beforeEach(() => {
    socket = new Stream()

    socket.remoteAddress = '1.2.3.4'
    socket.remotePort = '1234'
    socketSession = new SocketSession(socket, logger, closeCallback, handleMessage)
  })

  it('it should manage socket event', () => {
    expect(socketSession.name).toEqual(`${socket.remoteAddress}:${socket.remotePort}`)

    socket.emit('close')
    expect(closeCallback).toHaveBeenCalledTimes(1)

    socket.emit('error', 'myError')
    expect(logger.error).toHaveBeenCalledWith('myError')

    socket.emit('data', 'my first ')
    socket.emit('data', 'message in\n three parts\n')
    socket.emit('data', 'my second message\n')
    socket.emit('data', 'my third message\n')
    expect(handleMessage).toHaveBeenCalledTimes(4)
    expect(handleMessage).toHaveBeenCalledWith('my first message in')
    expect(handleMessage).toHaveBeenCalledWith('three parts')
    expect(handleMessage).toHaveBeenCalledWith('my second message')
    expect(handleMessage).toHaveBeenCalledWith('my third message')
  })

  it('it should write message in socket', () => {
    socket.write = jest.fn()
    socketSession.sendMessage('my message to send')
    expect(socket.write).toHaveBeenCalledWith('my message to send\n')
  })

  it('it should properly close socket if opened', () => {
    socket.destroy = jest.fn()
    socketSession.close()
    expect(socket.destroy).toHaveBeenCalledWith()
  })

  it('it should not close socket if it does not exist', () => {
    socket.destroy = jest.fn()

    socketSession.socket = null
    socketSession.close()
    expect(socket.destroy).not.toHaveBeenCalledWith()
  })
})
