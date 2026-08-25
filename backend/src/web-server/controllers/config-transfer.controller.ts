import { Controller, Get, Request, Route, SuccessResponse, Tags } from 'tsoa';
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
}
