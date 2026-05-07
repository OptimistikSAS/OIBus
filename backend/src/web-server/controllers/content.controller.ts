import { Body, Controller, Post, Query, Request, Route, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { OIBusAnyContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import fs from 'node:fs/promises';
import { OIBusValidationError } from '../../model/types';

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
    @Query() dataSourceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    if (!file || !file.path) {
      throw new OIBusValidationError('Missing file');
    }
    const oIBusService = request.services.oIBusService;
    try {
      const normalizedNorthIds = northId.split(',').filter(id => id.trim() !== '');
      for (const id of normalizedNorthIds) {
        await oIBusService.addExternalContent(id, dataSourceId, { type: 'any', filePath: file.path });
      }
    } finally {
      // Cleanup: This block runs NO MATTER WHAT (success or failure)
      try {
        await fs.unlink(file.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }

  /**
   * Adds any JSON content directly to the specified North connector(s) cache queue.
   * The body can be any valid JSON object or array. It is serialized and wrapped as
   * an OIBus any-content payload, allowing external systems to push arbitrary data
   * directly into OIBus for further processing by North connectors.
   * @summary Inject any JSON content into North connector cache(s) queue
   */
  @Post('/content')
  @SuccessResponse(204, 'No Content')
  async addContent(
    @Query() northId: string,
    @Query() dataSourceId: string,
    @Body() body: Record<string, unknown>,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const oIBusService = request.services.oIBusService;
    const anyContent: OIBusAnyContent = { type: 'any-content', content: JSON.stringify(body) };
    const normalizedNorthIds = northId.split(',').filter(id => id.trim() !== '');
    for (const id of normalizedNorthIds) {
      await oIBusService.addExternalContent(id, dataSourceId, anyContent);
    }
  }
}
