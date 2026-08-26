import { Controller, Get, Post, Request, Route, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { CustomExpressRequest } from '../express';
import fs from 'node:fs/promises';
import { ConfigImportResponseDTO } from '../../../shared/model/config-transfer.model';
import { OIBusValidationError } from '../../model/types';

@Route('/api/config-transfer')
@Tags('Config Transfer')
/**
 * Config Transfer API
 * @description Endpoints for exporting and importing a full, secret-free snapshot of the OIBus
 * configuration
 */
export class ConfigTransferController extends Controller {
  /**
   * Exports the full OIBus configuration (engine, scan modes, ip filters, certificates, south and
   * north connectors, history queries, transformers and users) as a single, secret-free,
   * version-stamped JSON file
   * @summary Export configuration
   * @responseHeader Content-Type application/json
   * @responseHeader Content-Disposition attachment; filename=oibus-config-export.json
   */
  @Get('/export')
  @SuccessResponse(200, 'Configuration exported successfully')
  exportConfiguration(@Request() request: CustomExpressRequest): void {
    const configTransferService = request.services.configTransferService;
    const envelope = configTransferService.exportConfiguration();
    request.res!.attachment('oibus-config-export.json');
    request.res!.contentType('application/json');
    request.res!.status(200).send(JSON.stringify(envelope, null, 2));
  }

  /**
   * Imports a previously exported configuration file, transactionally wiping and recreating every
   * in-scope section of the local configuration (scan modes, ip filters, certificates, transformers,
   * south and north connectors, history queries and users) from it, preserving each entity's original
   * id. This is a full replace, not a merge, and cannot be undone. The engine's own settings and the
   * OIAnalytics registration are never touched. Older exports are brought forward with the
   * settings-upgrade registry before being applied; nothing is written if the file is malformed, too
   * new for this OIBus version, or fails validation after any upgrades.
   *
   * On success, OIBus restarts itself so the running engine picks up the newly written configuration
   * — the wipe+recreate only touches the database, and the in-memory south/north connectors and
   * history queries the engine is already running would otherwise keep operating against rows that
   * no longer exist.
   * @summary Import configuration
   * @param file The configuration export file (JSON) to import
   */
  @Post('/import')
  @SuccessResponse(200, 'Configuration imported successfully')
  async importConfiguration(
    @UploadedFile('file') file: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<ConfigImportResponseDTO> {
    if (!file || !file.path) {
      throw new OIBusValidationError('Missing file "file"');
    }
    const configImportService = request.services.configImportService;
    try {
      const content = await fs.readFile(file.path, 'utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new OIBusValidationError('Uploaded file is not valid JSON');
      }
      const response = await configImportService.importConfiguration(parsed, request.user.id);
      request.services.oIBusService.restart();
      return response;
    } finally {
      try {
        await fs.unlink(file.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }
}
