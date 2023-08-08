import fs from 'node:fs/promises';
import fetch from 'node-fetch';
import OIBusService from './oibus.service';
import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import { OibusUpdateCheckResponse } from '../../../shared/model/update.model';
import * as utils from '../service/utils';

jest.mock('node:fs/promises');
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');
jest.mock('../service/utils');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();

let service: OIBusService;
describe('OIBus service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OIBusService(oibusEngine, historyQueryEngine);
  });

  it('should restart OIBus', async () => {
    await service.restartOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.start).toHaveBeenCalled();
    expect(oibusEngine.start).toHaveBeenCalled();
  });

  it('should stop OIBus', async () => {
    await service.stopOIBus();
    expect(oibusEngine.stop).toHaveBeenCalled();
    expect(historyQueryEngine.stop).toHaveBeenCalled();
  });

  it('should add values', async () => {
    await service.addValues('source', []);
    expect(oibusEngine.addExternalValues).toHaveBeenCalledWith('source', []);
  });

  it('should add file', async () => {
    await service.addFile('source', 'filePath');
    expect(oibusEngine.addExternalFile).toHaveBeenCalledWith('source', 'filePath');
  });

  it('should check for update', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    const fetchResponse: OibusUpdateCheckResponse = {
      latestVersion: '1.0.0',
      changelog: 'Changelog'
    };

    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(fetchResponse))));

    const updateData = await service.checkForUpdate();

    expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
    expect(updateData).toEqual({
      hasAvailableUpdate: true,
      actualVersion: 'v3.1.0',
      latestVersion: fetchResponse.latestVersion,
      changelog: fetchResponse.changelog
    });
  });

  it('should handle fetch error during update check', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    try {
      await service.checkForUpdate();
    } catch (error) {
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
      expect(error).toEqual(new Error('Update check failed: Error: error'));
    }
  });

  it('should handle invalid fetch response during update check', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/update?platform=linux&architecture=x64`;
    const expectedFetchOptions = {
      timeout: 10000
    };
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('invalid', { status: 404 })));

    try {
      await service.checkForUpdate();
    } catch (error) {
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedFetchOptions);
      expect(error).toEqual(new Error('Update check failed with status code 404 and message: Not Found'));
    }
  });

  it('should download update', async () => {
    (utils.getOIBusInfo as jest.Mock).mockReturnValue({ architecture: 'x64', platform: 'linux', version: 'v3.1.0' });
    const expectedUrl = `http://localhost:3333/api/oibus?platform=linux&architecture=x64`;
    const expectedFilename = `oibus-linux_x64.zip`;

    await service.downloadUpdate();

    expect(utils.downloadFile).toHaveBeenCalledWith(expectedUrl, expectedFilename, 60000);
    expect(utils.unzip).toHaveBeenCalledWith(expectedFilename, '.');
    expect(utils.unzip).toHaveBeenCalledWith(expectedFilename, '.');
    expect(fs.unlink).toHaveBeenCalledWith(expectedFilename);
  });
});
