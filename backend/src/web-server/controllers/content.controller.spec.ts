import { ContentController } from './content.controller';
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

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentController();
  });

  it('should wrap any JSON body as any-content and add it to each north connector', async () => {
    const northId = 'northId1,northId2';
    const dataSourceId = 'dataSourceId';
    const body = { foo: 'bar', count: 42 };
    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);
    await controller.addContent(northId, dataSourceId, body, mockRequest as CustomExpressRequest);
    const expectedContent = { type: 'any-content', content: JSON.stringify(body) };
    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', dataSourceId, expectedContent);
    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId2', dataSourceId, expectedContent);
  });

  it('should add file', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';
    const mockFile = {
      path: 'filePath'
    } as Express.Multer.File;

    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);

    await controller.addFile(northId, dataSourceId, mockFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', dataSourceId, {
      type: 'any',
      filePath: 'filePath'
    });
    expect(fs.unlink).toHaveBeenCalledWith('filePath');
  });

  it('should add file and not throw if unlink fails', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';
    const mockFile = {
      path: 'filePath'
    } as Express.Multer.File;
    (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('unlink error'));
    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);

    await expect(controller.addFile(northId, dataSourceId, mockFile, mockRequest as CustomExpressRequest)).resolves.not.toThrow();

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', dataSourceId, {
      type: 'any',
      filePath: 'filePath'
    });
    expect(fs.unlink).toHaveBeenCalledWith('filePath');
  });

  it('should throw an error if file is missing', async () => {
    const northId = 'northId1';
    const dataSourceId = 'dataSourceId';

    await expect(controller.addFile(northId, dataSourceId, undefined!, mockRequest as CustomExpressRequest)).rejects.toThrow(
      'Missing file'
    );
  });
});
