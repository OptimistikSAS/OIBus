import { Body, Controller, Post, Query, Request, Route, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { OIBusSetpointContent, OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';

@Route('/api/content')
@Tags('Content')
/**
 * Content endpoints
 * @description Endpoints used to add content into north connectors caches
 */
export class ContentController extends Controller {
  /**
   * Uploads a file and adds it to the specified North connector(s) cache.
   * The file will be processed according to the North connector's configuration.
   * @summary Inject a file into North connector cache(s) queue
   */
  @Post('/file')
  @SuccessResponse(204, 'No Content')
  async addFile(
    @Query() northId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const oIBusService = request.services.oIBusService;
    const normalizedNorthIds = northId.split(',').filter(id => id.trim() !== '');
    for (const id of normalizedNorthIds) {
      await oIBusService.addExternalContent(id, { type: 'any', filePath: file.path }, 'api');
    }
  }

  /**
   * Adds time-value or setpoint content directly to the specified North connector(s) cache queue.
   * This allows external systems to push processed data directly into OIBus.
   * @summary Inject structured content into North connector cache(s) queue
   */
  @Post('/content')
  @SuccessResponse(204, 'No Content')
  async addContent(
    @Query() northId: string,
    @Body() content: OIBusTimeValueContent | OIBusSetpointContent,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const oIBusService = request.services.oIBusService;
    const normalizedNorthIds = northId.split(',').filter(id => id.trim() !== '');
    for (const id of normalizedNorthIds) {
      await oIBusService.addExternalContent(id, content, 'api');
    }
  }
}
