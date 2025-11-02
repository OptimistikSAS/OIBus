import { ScanModeController } from './scan-mode.controller';
import { ScanModeCommandDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';

// Mock the services
jest.mock('../../service/scan-mode.service', () => ({
  toScanModeDTO: jest.fn().mockImplementation(scanMode => scanMode)
}));

describe('ScanModeController', () => {
  let controller: ScanModeController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      scanModeService: new ScanModeServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ScanModeController();
  });

  it('should return a list of scan modes', async () => {
    const mockScanModes = testData.scanMode.list;
    (mockRequest.services!.scanModeService.list as jest.Mock).mockReturnValue(mockScanModes);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.list).toHaveBeenCalled();
    expect(result).toEqual(mockScanModes);
  });

  it('should return a scan mode by ID', async () => {
    const mockScanMode = testData.scanMode.list[0];
    const scanModeId = mockScanMode.id;
    (mockRequest.services!.scanModeService.findById as jest.Mock).mockReturnValue(mockScanMode);

    const result = await controller.findById(scanModeId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.findById).toHaveBeenCalledWith(scanModeId);
    expect(result).toEqual(mockScanMode);
  });

  it('should create a new scan mode', async () => {
    const command: ScanModeCommandDTO = testData.scanMode.command;
    const createdScanMode = testData.scanMode.list[0];
    (mockRequest.services!.scanModeService.create as jest.Mock).mockResolvedValue(createdScanMode);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.create).toHaveBeenCalledWith(command);
    expect(result).toEqual(createdScanMode);
  });

  it('should update an existing scan mode', async () => {
    const scanModeId = testData.scanMode.list[0].id;
    const command: ScanModeCommandDTO = testData.scanMode.command;
    (mockRequest.services!.scanModeService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(scanModeId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.update).toHaveBeenCalledWith(scanModeId, command);
  });

  it('should delete a scan mode', async () => {
    const scanModeId = testData.scanMode.list[0].id;
    (mockRequest.services!.scanModeService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(scanModeId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.delete).toHaveBeenCalledWith(scanModeId);
  });

  it('should validate a cron expression', async () => {
    const command = { cron: testData.scanMode.command.cron };
    const validatedCronExpression: ValidatedCronExpression = {
      isValid: true,
      errorMessage: '',
      nextExecutions: [],
      humanReadableForm: ''
    };
    (mockRequest.services!.scanModeService.verifyCron as jest.Mock).mockReturnValue(validatedCronExpression);

    const result = await controller.verifyCron(command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.scanModeService.verifyCron).toHaveBeenCalledWith(command);
    expect(result).toEqual(validatedCronExpression);
  });
});
