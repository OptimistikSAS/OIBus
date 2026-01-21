import { ContentController } from './content.controller';
import { OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';

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
  });
});
