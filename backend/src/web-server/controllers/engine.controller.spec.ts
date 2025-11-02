import { EngineController } from './engine.controller';
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';

// Mock the services
jest.mock('../../service/oibus.service', () => ({
  toEngineSettingsDTO: jest.fn().mockImplementation(settings => settings)
}));

describe('EngineController', () => {
  let controller: EngineController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      oIBusService: new OIBusServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EngineController();
  });

  it('should return engine settings', async () => {
    const mockSettings = testData.engine.settings;
    (mockRequest.services!.oIBusService.getEngineSettings as jest.Mock).mockReturnValue(mockSettings);

    const result = await controller.getEngineSettings(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(result).toEqual(mockSettings);
  });

  it('should update engine settings', async () => {
    const command: EngineSettingsCommandDTO = testData.engine.command;
    (mockRequest.services!.oIBusService.updateEngineSettings as jest.Mock).mockResolvedValue(undefined);

    await controller.updateEngineSettings(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.updateEngineSettings).toHaveBeenCalledWith(command);
  });

  it('should reset engine metrics', async () => {
    (mockRequest.services!.oIBusService.resetEngineMetrics as jest.Mock).mockResolvedValue(undefined);

    await controller.resetEngineMetrics(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.resetEngineMetrics).toHaveBeenCalled();
  });

  it('should restart OIBus', async () => {
    (mockRequest.services!.oIBusService.restart as jest.Mock).mockResolvedValue(undefined);

    await controller.restart(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.restart).toHaveBeenCalled();
  });

  it('should return OIBus info', async () => {
    const mockInfo = testData.engine.oIBusInfo;
    (mockRequest.services!.oIBusService.getInfo as jest.Mock).mockReturnValue(mockInfo);

    const result = await controller.getInfo(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.getInfo).toHaveBeenCalled();
    expect(result).toEqual(mockInfo);
  });

  it('should check OIBus status', async () => {
    await controller.getOIBusStatus(mockRequest as CustomExpressRequest);
    // No assertions needed as the method doesn't return anything
  });
});
