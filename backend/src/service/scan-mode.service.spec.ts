import OIBusEngine from '../engine/oibus-engine';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import ScanModeService, { toScanModeDTO } from './scan-mode.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import testData from '../tests/utils/test-data';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import { validateCronExpression } from './utils';
import { ValidatedCronExpression } from '../../../shared/model/scan-mode.model';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const oibusEngine: OIBusEngine = new OibusEngineMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: ScanModeService;
describe('Scan Mode Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new ScanModeService(validator, scanModeRepository, southCacheRepository, oIAnalyticsMessageService, oibusEngine);
  });

  it('findAll() should find all scan modes', () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);

    const result = service.findAll();

    expect(scanModeRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual(testData.scanMode.list.map(element => toScanModeDTO(element)));
  });

  it('findById() should find a scan mode by id', () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValueOnce(testData.scanMode.list[0]);

    const result = service.findById(testData.scanMode.list[0].id);

    expect(scanModeRepository.findById).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(result).toEqual(toScanModeDTO(testData.scanMode.list[0]));
  });

  it('findById() should return null if id not found', () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValueOnce(null);

    const result = service.findById('id');

    expect(scanModeRepository.findById).toHaveBeenCalledWith('id');
    expect(result).toEqual(null);
  });

  it('create() should create a scan mode', async () => {
    (scanModeRepository.create as jest.Mock).mockReturnValueOnce(testData.scanMode.list[0]);

    const result = await service.create(testData.scanMode.command);

    expect(validator.validate).toHaveBeenCalledWith(scanModeSchema, testData.scanMode.command);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(result).toEqual(toScanModeDTO(testData.scanMode.list[0]));
  });

  it('update() should update a scan mode', async () => {
    (scanModeRepository.findById as jest.Mock)
      .mockReturnValueOnce(testData.scanMode.list[0])
      .mockReturnValueOnce(testData.scanMode.list[1]);

    await service.update(testData.scanMode.list[0].id, testData.scanMode.command);

    expect(validator.validate).toHaveBeenCalledWith(scanModeSchema, testData.scanMode.command);
    expect(scanModeRepository.findById).toHaveBeenNthCalledWith(1, testData.scanMode.list[0].id);
    expect(scanModeRepository.findById).toHaveBeenNthCalledWith(2, testData.scanMode.list[0].id);
    expect(scanModeRepository.findById).toHaveBeenCalledTimes(2);
    expect(scanModeRepository.update).toHaveBeenCalledWith(testData.scanMode.list[0].id, testData.scanMode.command);
    expect(oibusEngine.updateScanMode).toHaveBeenCalledWith(testData.scanMode.list[1]);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('update() should update a scan mode and not update engine', async () => {
    (scanModeRepository.findById as jest.Mock)
      .mockReturnValueOnce(testData.scanMode.list[0])
      .mockReturnValueOnce(testData.scanMode.list[0]);

    await service.update(testData.scanMode.list[0].id, testData.scanMode.command);

    expect(scanModeRepository.update).toHaveBeenCalledWith(testData.scanMode.list[0].id, testData.scanMode.command);
    expect(oibusEngine.updateScanMode).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('update() should not update if the scan mode is not found', async () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.scanMode.list[0].id, testData.scanMode.command)).rejects.toThrow(
      new Error(`Scan mode ${testData.scanMode.list[0].id} not found`)
    );

    expect(scanModeRepository.findById).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(scanModeRepository.update).not.toHaveBeenCalled();
    expect(oibusEngine.updateScanMode).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete a scan mode', async () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValueOnce(testData.scanMode.list[0]);

    await service.delete(testData.scanMode.list[0].id);

    expect(scanModeRepository.findById).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(scanModeRepository.delete).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(southCacheRepository.deleteAllByScanMode).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should not delete if the scan mode is not found', async () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.scanMode.list[0].id)).rejects.toThrow(
      new Error(`Scan mode ${testData.scanMode.list[0].id} not found`)
    );

    expect(scanModeRepository.findById).toHaveBeenCalledWith(testData.scanMode.list[0].id);
    expect(scanModeRepository.delete).not.toHaveBeenCalled();
    expect(southCacheRepository.deleteAllByScanMode).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('verifyCron() should verify cron expression of a scan mode', async () => {
    const validatedCronExpression: ValidatedCronExpression = { nextExecutions: [], humanReadableForm: '' };
    (validateCronExpression as jest.Mock).mockReturnValueOnce(validatedCronExpression);

    const result = await service.verifyCron(testData.scanMode.command);

    expect(validateCronExpression).toHaveBeenCalledWith(testData.scanMode.command.cron);
    expect(result).toEqual(validatedCronExpression);
  });

  it('verifyCron() should throw an error if cron is empty', async () => {
    await expect(service.verifyCron({ ...testData.scanMode.command, cron: '' })).rejects.toThrow(new Error('Cron expression is required'));
  });
});
