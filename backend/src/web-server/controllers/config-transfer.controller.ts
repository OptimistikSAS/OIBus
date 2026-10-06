import fs from 'node:fs/promises';

import { Controller, Get, Post, Request, Route, SuccessResponse, Tags, UploadedFile } from 'tsoa';

import { ConfigImportPreviewDTO, ConfigImportResponseDTO } from '../../../shared/model/oia/config-transfer.model';

import { OIBusValidationError } from '../../model/types';
import { CustomExpressRequest } from '../express';

@Route('/api/config-transfer')
@Tags('Config Transfer')
/**
 * Config Transfer API
 * @description Endpoints for exporting and importing a full, secret-free snapshot of the OIBus
 * configuration
 */
export class ConfigTransferController extends Controller {
  /**
   * Exports the full OIBus configuration (engine, scan modes, ip filters, certificates, south
   * connectors with their configuration workflows, north connectors, history queries, transformers
   * and users) as a single, secret-free JSON file: the same DTOs OIBus sends to OIAnalytics, under
   * `config`, stamped with the `oibusVersion` they come from
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
   * Upgrades and validates a configuration export file exactly like the import does, and returns the
   * resulting configuration (engine settings, scan modes, ip filters, certificates, transformers, south
   * connectors with their items and configuration workflows, north connectors, history queries and users) without
   * writing anything, so it can be reviewed before running the actual import. Rejects for the same
   * reasons the import would.
   * @summary Preview configuration import
   * @param file The configuration export file (JSON) to preview
   */
  @Post('/preview')
  @SuccessResponse(200, 'Configuration import previewed successfully')
  async previewConfiguration(
    @UploadedFile('file') file: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<ConfigImportPreviewDTO> {
    const parsed = await this.readUploadedJson(file);
    return request.services.configImportService.previewConfiguration(parsed);
  }

  /**
   * Imports a configuration export file (from OIBus or OIAnalytics), transactionally wiping and
   * recreating every in-scope section of the local configuration (scan modes, ip filters, certificates,
   * transformers, south connectors and their configuration workflows, north connectors, history queries
   * and users) from it, preserving each entity's original id. This is a full replace, not a merge, and
   * cannot be undone. The engine settings (name, web server, proxy
   * server, logging) are overwritten too; only the OIAnalytics registration is never touched. When the
   * web server port changes, the response's `newPort` gives the port OIBus listens on once restarted.
   * A configuration from an older OIBus is brought to the current shape by the config upgrade chain
   * before being applied; nothing is written if the file is malformed, comes from a newer OIBus (or one
   * older than 3.9.0), or fails validation after the upgrades.
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
    const parsed = await this.readUploadedJson(file);
    const response = await request.services.configImportService.importConfiguration(parsed, request.user.id);
    request.services.oIBusService.restart();
    return response;
  }

  /**
   * Reads and parses an uploaded JSON file, always removing the temp file multer wrote it to.
   */
  private async readUploadedJson(file: Express.Multer.File): Promise<unknown> {
    if (!file || !file.path) {
      throw new OIBusValidationError('Missing file "file"');
    }
    try {
      const content = await fs.readFile(file.path, 'utf-8');
      try {
        return JSON.parse(content);
      } catch {
        throw new OIBusValidationError('Uploaded file is not valid JSON');
      }
    } finally {
      try {
        await fs.unlink(file.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }
}
