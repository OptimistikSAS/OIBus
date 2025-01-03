import ConnectionService, { ManagedConnectionDTO, ManagedConnection } from './connection.service';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import { SouthSettings } from '../../shared/model/south-settings.model';

const promiseReject = jest.fn();
const promiseResolve = jest.fn();
const promiseFn = jest.fn();

jest.mock('./deferred-promise', () => {
  return {
    __esModule: true,
    default: class {
      reject = () => promiseReject();
      resolve = () => promiseResolve();
      get promise() {
        return promiseFn();
      }
    }
  };
});

const serviceLogger: pino.Logger = new PinoLogger();
const connectionLogger: pino.Logger = new PinoLogger();

const closeFn = jest.fn(() => Promise.resolve());
const mockSession = { close: closeFn };
const connectionDTO: ManagedConnectionDTO<{ close: jest.Mock }> = {
  type: 'opcua',
  connectorSettings: {
    foo: 'bar',
    bar: 'baz'
  } as unknown as SouthSettings,
  createSessionFn: jest.fn(() => Promise.resolve(mockSession)),
  settings: {
    closeFnName: 'close',
    sharedConnection: false
  }
};

const sharedConnectionDTO: ManagedConnectionDTO<{ close: jest.Mock }> = {
  type: 'opcua',
  connectorSettings: {
    foo: 'bar',
    bar: 'baz'
  } as unknown as SouthSettings,
  createSessionFn: jest.fn(() => Promise.resolve(mockSession)),
  settings: {
    closeFnName: 'close',
    sharedConnection: true
  }
};

describe('ConnectionService', () => {
  let connectionService: ConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    (serviceLogger.child as jest.Mock).mockReturnValue(serviceLogger);
    connectionService = new ConnectionService(serviceLogger);
    (serviceLogger.child as jest.Mock).mockReturnValue(connectionLogger);
  });

  it('should create a new connection', () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    const connectionMetadata = connectionService['findConnection']('connectorId', connectionDTO);

    expect(serviceLogger.debug).toHaveBeenCalledWith('New connection of type "opcua" created');
    expect(connectionMetadata).toStrictEqual({
      instance: connection,
      reliantConnectorIds: new Set(['connectorId']),
      connectorSettings: connectionDTO.connectorSettings,
      sharedConnection: false
    });
  });

  it('should return an existing connection if it matches the settings', () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    const newConnection: ManagedConnection<{ close: jest.Mock }> = connectionService.create('connectorId2', connectionDTO);

    const sharedConnection = connectionService.create('sharedConnectorId', sharedConnectionDTO);
    const newSharedConnection: ManagedConnection<{ close: jest.Mock }> = connectionService.create(
      'sharedConnectorId2',
      sharedConnectionDTO
    );

    expect(connection).not.toEqual(newConnection); // Not to be equal, since these are not shared connections
    expect(sharedConnection).toStrictEqual(newSharedConnection); // To be equal, since these are shared connections

    expect(connection).not.toEqual(sharedConnection);
    expect(newConnection).not.toEqual(newSharedConnection);

    expect((serviceLogger.debug as jest.Mock).mock.calls).toEqual([
      ['New connection of type "opcua" created'], // First connection (not shared)
      ['New connection of type "opcua" created'], // Second connection (not shared)
      ['New connection of type "opcua" created'] // First shared connection
    ]);
    expect((serviceLogger.trace as jest.Mock).mock.calls).toEqual([
      ['Connection of type "opcua" already exists, returning existing connection'] // Second shared connection
    ]);
  });

  it('should remove a connection used by one connector', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    const sharedConnection = connectionService.create('sharedConnectorId', sharedConnectionDTO);

    const connectionCloseSpy = jest.spyOn(connection, 'close');
    const sharedConnectionCloseSpy = jest.spyOn(sharedConnection, 'close');

    await connectionService.remove('opcua', 'connectorId');
    await connectionService.remove('opcua', 'sharedConnectorId');

    // Ensure that the connections are removed
    expect(connectionService['findConnection']('connectorId', connectionDTO)).toBeNull();
    expect(connectionService['findConnection']('sharedConnectorId', sharedConnectionDTO)).toBeNull();

    // Ensure that the close function is called
    expect(connectionCloseSpy).toHaveBeenCalled();
    expect(sharedConnectionCloseSpy).toHaveBeenCalled();

    expect((serviceLogger.debug as jest.Mock).mock.calls).toEqual([
      ['New connection of type "opcua" created'], // Connection (not shared)
      ['New connection of type "opcua" created'], // Shared connection

      ['Connector "connectorId" removed from connection of type "opcua"'], // Connection (not shared)
      ['Connection of type "opcua" removed'], // Connection (not shared)
      ['Connector "sharedConnectorId" removed from connection of type "opcua"'], // Shared connection
      ['Connection of type "opcua" removed'] // Shared connection
    ]);

    expect((serviceLogger.trace as jest.Mock).mock.calls).toEqual([
      ['No reliant connectors left for connection of type "opcua", closing connection'],
      ['No reliant connectors left for connection of type "opcua", closing connection']
    ]);
  });

  it('should not remove a connection with unknown type', async () => {
    await connectionService.remove('unknown', 'connectorId');
    expect(serviceLogger.trace).toHaveBeenCalledWith('Connection type "unknown" not found. Nothing to remove');
  });

  it('should not remove a connection with unknown connector id', async () => {
    connectionService.create('connectorId', connectionDTO);
    await connectionService.remove('opcua', 'unknown');
    expect(serviceLogger.trace).toHaveBeenCalledWith('No connection found for connector "unknown" of type "opcua". Nothing to remove');
  });

  it('should not close a connection with reliant connectors', async () => {
    connectionService.create('sharedConnectorId', sharedConnectionDTO);
    const sharedConnection2 = connectionService.create('sharedConnectorId2', sharedConnectionDTO);

    const sharedConnectionCloseSpy = jest.spyOn(sharedConnection2, 'close');

    await connectionService.remove('opcua', 'sharedConnectorId2');

    // Ensure that the connection is removed
    const connectionMeta = connectionService['findConnection']('sharedConnectorId', sharedConnectionDTO);
    expect(connectionMeta?.reliantConnectorIds).toEqual(new Set(['sharedConnectorId']));

    // Ensure that the close function is not called
    expect(sharedConnectionCloseSpy).not.toHaveBeenCalled();

    expect((serviceLogger.debug as jest.Mock).mock.calls).toEqual([
      ['New connection of type "opcua" created'], // Shared connection

      ['Connector "sharedConnectorId2" removed from connection of type "opcua"'] // Shared connection
    ]);

    expect((serviceLogger.trace as jest.Mock).mock.calls).not.toEqual([
      ['No reliant connectors left for connection of type "opcua", closing connection']
    ]);
  });

  it('should not find a connection which does not exist', () => {
    const foundConnection = connectionService['findConnection']('unknown', connectionDTO);
    expect(foundConnection).toBeNull();
  });
});

describe('ManagedConnectionClass', () => {
  let connectionService: ConnectionService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (serviceLogger.child as jest.Mock).mockReturnValue(serviceLogger);
    connectionService = new ConnectionService(serviceLogger);
    (serviceLogger.child as jest.Mock).mockReturnValue(connectionLogger);
  });

  it('should create a new session', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    const session = await connection.getSession();

    expect(session).toBeDefined();
    expect(connectionDTO.createSessionFn).toHaveBeenCalled();
    expect(promiseResolve).toHaveBeenCalled();
    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([['Getting session'], ['Creating new session'], ['Session created']]);
  });

  it('should return an existing session', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    const session1 = await connection.getSession();
    const session2 = await connection.getSession();

    expect(session1).toStrictEqual(session2);
    expect(connectionDTO.createSessionFn).toHaveBeenCalledTimes(1);
    expect(promiseResolve).toHaveBeenCalledTimes(1);
    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([
      ['Getting session'],
      ['Creating new session'],
      ['Session created'],

      ['Getting session'],
      ['Session already exists, returning existing session']
    ]);
  });

  it('should throw an error when creating a session fails', async () => {
    (connectionDTO.createSessionFn as jest.Mock).mockReturnValueOnce(null);
    const connection = connectionService.create('connectorId', connectionDTO);

    await expect(connection.getSession()).rejects.toThrow('Session create function returned null');
    expect((connectionLogger.error as jest.Mock).mock.calls).toEqual([
      ['Session could not be created: Session create function returned null']
    ]);
  });

  it('should throw an error when creating a session throws an error', async () => {
    (connectionDTO.createSessionFn as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Dummy error');
    });
    const connection = connectionService.create('connectorId', connectionDTO);

    await expect(connection.getSession()).rejects.toThrow('Dummy error');
    expect((connectionLogger.error as jest.Mock).mock.calls).toEqual([['Session could not be created: Dummy error']]);
  });

  it('should wait when two sessions are created at the same time', async () => {
    // promiseFn will be called when promise is awaited
    // and we assign that resolve function to promiseResolve
    // so getSession will be able to resolve the promise
    promiseFn.mockReturnValueOnce(
      new Promise(resolve => {
        promiseResolve.mockImplementationOnce(resolve);
      })
    );

    // mock the creation time of the session
    (connectionDTO.createSessionFn as jest.Mock).mockImplementationOnce(() => {
      return new Promise(resolve => setTimeout(() => resolve(mockSession), 1000));
    });

    const connection = connectionService.create('connectorId', connectionDTO);
    connection.getSession();
    connection.getSession();

    jest.advanceTimersByTime(1000);
    await jest.runAllTimersAsync();

    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([
      ['Getting session'], // First getSession
      ['Creating new session'], // First getSession
      ['Getting session'], // Second getSession
      ['Session created'], // First getSession
      ['Session already exists, returning existing session'] // Second getSession
    ]);
  });

  it('should close a session', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    await connection.getSession();
    // Mock having no reliant connectors
    connectionService['findConnection']('connectorId', connectionDTO)!.reliantConnectorIds.clear();
    (connectionLogger.trace as jest.Mock).mockClear(); // Clear the trace calls

    await connection.close();

    expect(closeFn).toHaveBeenCalled();
    expect(connection['_session']).toBeNull();
    expect(promiseResolve).toHaveBeenCalled();
    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([['Closing session'], ['Session closed']]);
  });

  it('should not close an already closed session', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    await connection.getSession();
    // Mock having no reliant connectors
    connectionService['findConnection']('connectorId', connectionDTO)!.reliantConnectorIds.clear();

    await connection.close();
    (connectionLogger.trace as jest.Mock).mockClear(); // Clear the trace calls
    promiseResolve.mockClear(); // Clear the resolve calls

    await connection.close();

    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(connection['_session']).toBeNull();
    expect(promiseResolve).not.toHaveBeenCalled();
    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([['Closing session'], ['Session does not exist, nothing to close']]);
  });

  it('should not close a session with reliant connectors', async () => {
    const connection = connectionService.create('connectorId', connectionDTO);
    await connection.getSession();
    (connectionLogger.trace as jest.Mock).mockClear(); // Clear the trace calls
    promiseResolve.mockClear(); // Clear the resolve calls

    await connection.close();

    expect(closeFn).not.toHaveBeenCalled();
    expect(connection['_session']).not.toBeNull();
    expect(promiseResolve).not.toHaveBeenCalled();
    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([
      ['Closing session'],
      ['Session is still being used by other connectors, not closing the session']
    ]);
  });

  it('should throw an error when closing a session fails', async () => {
    closeFn.mockImplementationOnce(() => {
      throw new Error('Dummy error');
    });

    const connection = connectionService.create('connectorId', connectionDTO);
    await connection.getSession();
    // Mock having no reliant connectors
    connectionService['findConnection']('connectorId', connectionDTO)!.reliantConnectorIds.clear();

    await expect(connection.close()).rejects.toThrow('Dummy error');
    expect(promiseResolve).toHaveBeenCalled();
    expect((connectionLogger.error as jest.Mock).mock.calls).toEqual([['Session could not be closed: Dummy error']]);
  });

  it('should wait when two sessions are being closed at the same time', async () => {
    // promiseFn will be called when promise is awaited
    // and we assign that resolve function to promiseResolve
    // so getSession will be able to resolve the promise
    promiseFn.mockReturnValueOnce(
      new Promise(resolve => {
        promiseResolve.mockImplementationOnce(resolve);
      })
    );

    // mock the creation time of the session
    closeFn.mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve(), 1000));
    });

    const connection = connectionService.create('connectorId', connectionDTO);
    // manually setting the session, because using "await connection.getSession()" will cause weird behaviors
    connection['_session'] = mockSession;
    connection['reliantConnectorIds'].clear();

    connection.close();
    connection.close();

    jest.advanceTimersByTime(1000);
    await jest.runAllTimersAsync();

    expect((connectionLogger.trace as jest.Mock).mock.calls).toEqual([
      ['Closing session'],
      ['Closing session'],
      ['Session closed'],
      ['Session does not exist, nothing to close']
    ]);
  });
});
