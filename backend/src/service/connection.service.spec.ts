import ConnectionService from './connection.service';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';

const connectionService: ConnectionService = ConnectionService.getInstance();
const dataStreamEngine = new DataStreamEngineMock();
const northConnector = new NorthConnectorMock(testData.north.list[0]);
const southConnector = new SouthConnectorMock(testData.south.list[0]);
const session = {};

describe('ConnectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not get connection if data stream not set', async () => {
    await connectionService.closeSession('north', 'northId', 'currentNorthId', false);
    const result = await connectionService.getConnection('north', 'northId');
    expect(result).toBeNull();
    expect(connectionService.isConnectionUsed('north', 'northId', 'currentNorthId')).toBeFalsy();
  });

  it('getConnection() should get north connection', async () => {
    northConnector.sharableConnection.mockReturnValueOnce(true);
    northConnector.getSession.mockReturnValueOnce(session);
    (dataStreamEngine.getNorth as jest.Mock).mockReturnValueOnce(northConnector);
    await connectionService.init(dataStreamEngine);
    const result = await connectionService.getConnection('north', 'northId');
    expect(dataStreamEngine.getNorth).toHaveBeenCalledWith('northId');
    expect(result).toEqual(session);
  });

  it('getConnection() should get south connection', async () => {
    southConnector.sharableConnection.mockReturnValueOnce(true);
    southConnector.getSession.mockReturnValueOnce(session);
    (dataStreamEngine.getSouth as jest.Mock).mockReturnValueOnce(southConnector);
    await connectionService.init(dataStreamEngine);
    const result = await connectionService.getConnection('south', 'southId');
    expect(dataStreamEngine.getSouth).toHaveBeenCalledWith('southId');
    expect(result).toEqual(session);
  });

  it('getConnection() should return null if connector not sharable', async () => {
    southConnector.sharableConnection.mockReturnValueOnce(false);
    (dataStreamEngine.getSouth as jest.Mock).mockReturnValueOnce(southConnector);
    await connectionService.init(dataStreamEngine);
    const result = await connectionService.getConnection('south', 'southId');
    expect(result).toBeNull();
  });

  it('disconnect() should disconnect north connection if not used', async () => {
    northConnector.isEnabled.mockReturnValueOnce(false);
    northConnector.sharableConnection.mockReturnValueOnce(true);
    (dataStreamEngine.isConnectionUsed as jest.Mock).mockReturnValueOnce(false);
    (dataStreamEngine.getNorth as jest.Mock).mockReturnValueOnce(northConnector);
    await connectionService.init(dataStreamEngine);

    await connectionService.closeSession('north', 'northId', 'currentNorthId', false);
    expect(dataStreamEngine.getNorth).toHaveBeenCalledWith('northId');
    expect(northConnector.isEnabled).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.isConnectionUsed).toHaveBeenCalledWith('north', 'northId', 'currentNorthId');
    expect(northConnector.closeSession).toHaveBeenCalledTimes(1);
  });

  it('disconnect() should disconnect south connection if not used', async () => {
    southConnector.isEnabled.mockReturnValueOnce(false);
    southConnector.sharableConnection.mockReturnValueOnce(true);
    (dataStreamEngine.isConnectionUsed as jest.Mock).mockReturnValueOnce(false);
    (dataStreamEngine.getSouth as jest.Mock).mockReturnValueOnce(southConnector);
    await connectionService.init(dataStreamEngine);

    await connectionService.closeSession('south', 'southId', 'currentSouthId', false);
    expect(dataStreamEngine.getSouth).toHaveBeenCalledWith('southId');
    expect(southConnector.isEnabled).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.isConnectionUsed).toHaveBeenCalledWith('south', 'southId', 'currentSouthId');
    expect(southConnector.closeSession).toHaveBeenCalledTimes(1);
  });

  it('disconnect() should not disconnect north connection if used', async () => {
    northConnector.isEnabled.mockReturnValueOnce(true);
    northConnector.sharableConnection.mockReturnValueOnce(true);
    (dataStreamEngine.getNorth as jest.Mock).mockReturnValueOnce(northConnector);
    await connectionService.init(dataStreamEngine);

    await connectionService.closeSession('north', 'northId', 'currentNorthId', false);
    expect(dataStreamEngine.getNorth).toHaveBeenCalledWith('northId');
    expect(northConnector.isEnabled).toHaveBeenCalledTimes(1);
    expect(northConnector.closeSession).not.toHaveBeenCalled();
  });

  it('disconnect() should not disconnect south connection if used', async () => {
    southConnector.isEnabled.mockReturnValueOnce(true);
    southConnector.sharableConnection.mockReturnValueOnce(true);
    (dataStreamEngine.getSouth as jest.Mock).mockReturnValueOnce(southConnector);
    await connectionService.init(dataStreamEngine);

    await connectionService.closeSession('south', 'southId', 'currentSouthId', false);
    expect(dataStreamEngine.getSouth).toHaveBeenCalledWith('southId');
    expect(southConnector.isEnabled).toHaveBeenCalledTimes(1);
    expect(southConnector.closeSession).not.toHaveBeenCalled();
  });

  it('disconnect() should not disconnect north connection if not found', async () => {
    (dataStreamEngine.getNorth as jest.Mock).mockReturnValueOnce(null);
    await connectionService.init(dataStreamEngine);
    await connectionService.closeSession('north', 'northId', 'currentNorthId', false);
    expect(dataStreamEngine.getNorth).toHaveBeenCalledWith('northId');
    expect(northConnector.isEnabled).not.toHaveBeenCalled();
    expect(northConnector.disconnect).not.toHaveBeenCalled();
  });

  it('disconnect() should not disconnect south connection if not found', async () => {
    (dataStreamEngine.getSouth as jest.Mock).mockReturnValueOnce(null);
    await connectionService.init(dataStreamEngine);
    await connectionService.closeSession('south', 'southId', 'currentNorthId', false);
    expect(dataStreamEngine.getSouth).toHaveBeenCalledWith('southId');
    expect(northConnector.isEnabled).not.toHaveBeenCalled();
    expect(northConnector.disconnect).not.toHaveBeenCalled();
  });
});
