import { OIAnalyticsRegistrationController } from './oianalytics-registration.controller';
import { RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';

// Mock the services
jest.mock('../../service/oia/oianalytics-registration.service', () => ({
  toOIAnalyticsRegistrationDTO: jest.fn().mockImplementation(settings => settings)
}));

describe('OIAnalyticsRegistrationController', () => {
  let controller: OIAnalyticsRegistrationController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      oIAnalyticsRegistrationService: new OIAnalyticsRegistrationServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OIAnalyticsRegistrationController();
  });

  it('should return registration settings', async () => {
    const mockSettings = testData.oIAnalytics.registration.completed;
    (mockRequest.services!.oIAnalyticsRegistrationService.getRegistrationSettings as jest.Mock).mockReturnValue(mockSettings);

    const result = await controller.getRegistrationSettings(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsRegistrationService.getRegistrationSettings).toHaveBeenCalled();
    expect(result).toEqual(mockSettings);
  });

  it('should register with OIAnalytics service', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    (mockRequest.services!.oIAnalyticsRegistrationService.register as jest.Mock).mockResolvedValue(undefined);

    await controller.register(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsRegistrationService.register).toHaveBeenCalledWith(command);
  });

  it('should update registration settings', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    (mockRequest.services!.oIAnalyticsRegistrationService.editRegistrationSettings as jest.Mock).mockResolvedValue(undefined);

    await controller.editRegistrationSettings(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsRegistrationService.editRegistrationSettings).toHaveBeenCalledWith(command);
  });

  it('should unregister from OIAnalytics service', async () => {
    (mockRequest.services!.oIAnalyticsRegistrationService.unregister as jest.Mock).mockResolvedValue(undefined);

    await controller.unregister(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsRegistrationService.unregister).toHaveBeenCalled();
  });

  it('should test connection', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    (mockRequest.services!.oIAnalyticsRegistrationService.testConnection as jest.Mock).mockResolvedValue(undefined);

    await controller.testConnection(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIAnalyticsRegistrationService.testConnection).toHaveBeenCalledWith(command);
  });
});
