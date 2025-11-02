import { Controller, FormField, Post, Query, Request, Route, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { OIBusContent, OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import { ValidationError } from 'joi';

@Route('/api/content')
@Tags('Content')
/**
 * Content endpoints
 * @description Endpoints used to add content into north connectors caches
 */
export class ContentController extends Controller {
  @Post('/')
  @SuccessResponse(204, 'No Content')
  async addContent(
    @Query() northId: string | undefined,
    @Request() request: CustomExpressRequest,
    @UploadedFile() file?: Express.Multer.File,
    @FormField() timeValues?: OIBusTimeValueContent
  ): Promise<void> {
    const normalizedNorthIds = northId ? (northId.split(',').filter(id => id.trim() !== '') as Array<string>) : [];
    if (normalizedNorthIds.length === 0) {
      throw new ValidationError('northId must be specified in query params', [], null);
    }

    // Determine content type based on whether a file was uploaded
    let content: OIBusContent;
    if (file) {
      content = { type: 'any', filePath: file.path };
    } else if (timeValues) {
      content = timeValues;
    } else {
      throw new ValidationError('Either a file or time-values content must be provided', [], null);
    }

    const oIBusService = request.services.oIBusService;
    for (const id of normalizedNorthIds) {
      await oIBusService.addExternalContent(id, content, 'api');
    }
  }
}
