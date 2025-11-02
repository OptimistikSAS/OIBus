import { ContentController } from './content.controller';
import { OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import { ValidationError } from 'joi';
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

    await controller.addContent(northId, mockRequest as CustomExpressRequest, undefined, timeValuesContent);

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId1', timeValuesContent, 'api');
    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith('northId2', timeValuesContent, 'api');
  });

  it('should add file content', async () => {
    const northId = 'northId1';
    const mockFile = {
      path: 'filePath'
    } as Express.Multer.File;

    (mockRequest.services!.oIBusService.addExternalContent as jest.Mock).mockResolvedValue(undefined);

    await controller.addContent(northId, mockRequest as CustomExpressRequest, mockFile);

    expect(mockRequest.services!.oIBusService.addExternalContent).toHaveBeenCalledWith(
      'northId1',
      { type: 'any', filePath: 'filePath' },
      'api'
    );
  });

  it('should throw error when northId is not specified', async () => {
    await expect(controller.addContent(undefined, mockRequest as CustomExpressRequest)).rejects.toThrow(ValidationError);
  });

  it('should throw error when neither file nor timeValues is provided', async () => {
    const northId = 'northId1';

    await expect(controller.addContent(northId, mockRequest as CustomExpressRequest)).rejects.toThrow(ValidationError);
  });
});
