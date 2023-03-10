import Stream from 'node:stream'
import TcpServer from './tcp-server.js'

const logger = { error: jest.fn(), info: jest.fn() }
const handleMessage = jest.fn()
const netSocket = { remoteAddress: '1.2.3.4', remotePort: 1234, destroy: jest.fn() }

jest.mock('./socket-session')

const mockNetServer = new Stream()
mockNetServer.listen = jest.fn()
mockNetServer.close = jest.fn()
mockNetServer.unref = jest.fn()
jest.mock('node:net', () => ({ createServer: () => mockNetServer }))

let tcpServer = null

describe('TcpServer', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    tcpServer = new TcpServer(1234, handleMessage, logger)
  })

  it('should manage net event', () => {
    expect(tcpServer.port).toEqual(1234)

    const startCallback = jest.fn()

    tcpServer.start()

      expect(mockNetServer.listen).toHaveBeenCalledWith(1234, startCallback)

    mockNetServer.emit('listening')
    expect(logger.info).toHaveBeenCalledWith('TCP server listening on port 1234.')

    mockNetServer.emit('close')
    expect(logger.info).toHaveBeenCalledWith('TCP server closed.')

    mockNetServer.emit('error', 'myNetError')
    expect(logger.error).toHaveBeenCalledWith('myNetError')

    mockNetServer.emit('connection', netSocket)
    expect(logger.info).toHaveBeenCalledWith(`Connection accepted from "${netSocket.remoteAddress}:${netSocket.remotePort}".`)

    // Reject connection with an existing session
    tcpServer.socketSession = {}
    mockNetServer.emit('connection', netSocket)
    expect(logger.error).toHaveBeenCalledWith('Session already open, closing connection from '
        + `"${netSocket.remoteAddress}:${netSocket.remotePort}".`)
    expect(netSocket.destroy).toHaveBeenCalledTimes(1)
  })

  it('should properly close send disconnect message', async () => {
    await tcpServer.closeCallback('mySocket')
    expect(logger.info).toHaveBeenCalledWith('Connection with "mySocket" closed.')
    const disconnectMessage = {
      Reply: 'Disconnect',
      TransactionId: '',
      Content: {},
    }
    expect(handleMessage).toHaveBeenCalledWith(JSON.stringify(disconnectMessage))
  })

  it('should properly send a message', () => {
    const sendMessage = jest.fn()
    tcpServer.socketSession = { sendMessage }
    tcpServer.sendMessage('myMessage')

    expect(sendMessage).toHaveBeenCalledWith('myMessage')

    sendMessage.mockClear()
    tcpServer.socketSession = null
    tcpServer.sendMessage('myMessage')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('should properly stop the server and close the socket session', () => {
    const close = jest.fn()
    tcpServer.socketSession = { close }
    tcpServer.netServer = mockNetServer

    tcpServer.stop()
    expect(close).toHaveBeenCalledTimes(1)
    expect(mockNetServer.close).toHaveBeenCalledTimes(1)
    expect(mockNetServer.unref).toHaveBeenCalledTimes(1)

    jest.clearAllMocks()
    tcpServer.socketSession = null
    tcpServer.netServer = null

    tcpServer.stop()
    expect(close).not.toHaveBeenCalled()
    expect(mockNetServer.close).not.toHaveBeenCalled()
    expect(mockNetServer.unref).not.toHaveBeenCalled()
  })
})
