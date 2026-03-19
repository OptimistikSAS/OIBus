import { ContentController } from './content.controller';
import { OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('ContentController', () => {
  let controller: ContentController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      oIBusService: new OIBusServiceMock()
    }
  } as CustomExpressRequest;

  const timeValuesContent: OIBusTimeValueContent = {
    type: 'time-values',
    content: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentController();
  });

  it('should add time values content', async () => {
    const northId = 'northId1,northId2';
    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);
    await controller.addContent(northId, timeValuesContent, mockRequest as CustomExpressRequest);
    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', timeValuesContent);
    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId2', timeValuesContent);
  });

  it('should add file', async () => {
    const northId = 'northId1';
    const mockFile = {
      path: 'filePath'
    } as Express.Multer.File;

    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);

    await controller.addFile(northId, mockFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', { type: 'any', filePath: 'filePath' });
    expect(fs.unlink).toHaveBeenCalledWith('filePath');
  });

  it('should add file and not throw if unlink fails', async () => {
    const northId = 'northId1';
    const mockFile = {
      path: 'filePath'
    } as Express.Multer.File;
    (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('unlink error'));
    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);

    await expect(controller.addFile(northId, mockFile, mockRequest as CustomExpressRequest)).resolves.not.toThrow();

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', { type: 'any', filePath: 'filePath' });
    expect(fs.unlink).toHaveBeenCalledWith('filePath');
  });

  it('should throw an error if file is missing', async () => {
    const northId = 'northId1';

    await expect(controller.addFile(northId, undefined!, mockRequest as CustomExpressRequest)).rejects.toThrow('Missing file');
  });
});
