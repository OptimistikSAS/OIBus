import { Body, Controller, Get, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { EngineSettingsCommandDTO, EngineSettingsDTO, EngineSettingsUpdateResultDTO, OIBusInfo } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import { toEngineSettingsDTO } from '../../service/oibus.service';

@Route('/api')
@Tags('Engine')
/**
 * OIBus Engine Management API
 * @description Endpoints for managing the OIBus engine settings, metrics, and status
 */
export class EngineController extends Controller {
  /**
   * Returns the current configuration settings of the OIBus engine
   * @summary Retrieve engine configuration
   * @returns {EngineSettingsDTO} The engine settings
   */
  @Get('/engine')
  getEngineSettings(@Request() request: CustomExpressRequest): EngineSettingsDTO {
    const oIBusService = request.services.oIBusService;
    return toEngineSettingsDTO(
      oIBusService.getEngineSettings(),
      request.services.userService.getUserInfo.bind(request.services.userService)
    );
  }

  /**
   * Updates the configuration settings of the OIBus engine
   * @summary Update engine configuration
   * @param {EngineSettingsCommandDTO} command.body.required - Engine settings to update
   * @returns {EngineSettingsUpdateResultDTO} Information about whether a redirect is needed
   */
  @Put('/engine')
  @SuccessResponse(200, 'Engine settings updated successfully')
  async updateEngineSettings(
    @Body() command: EngineSettingsCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<EngineSettingsUpdateResultDTO> {
    const oIBusService = request.services.oIBusService;
    return await oIBusService.updateEngineSettings(command, request.user.id);
  }

  /**
   * Resets all metrics collected by the OIBus engine
   * @summary Reset metrics
   */
  @Post('/engine/metrics/reset')
  @SuccessResponse(204, 'Engine metrics reset successfully')
  async resetEngineMetrics(@Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService;
    await oIBusService.resetEngineMetrics();
  }

  /**
   * Restarts the OIBus process
   * @summary Restart OIBus process
   */
  @Post('/engine/restart')
  @SuccessResponse(204, 'Engine restart initiated successfully')
  async restart(@Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService;
    await oIBusService.restart();
  }

  /**
   * Returns version and system information about the OIBus instance
   * @summary Retrieve OIBus information
   * @returns {OIBusInfo} OIBus information including version, build, and system details
   */
  @Get('/engine/info')
  getInfo(@Request() request: CustomExpressRequest): OIBusInfo {
    const oIBusService = request.services.oIBusService;
    return oIBusService.getInfo();
  }

  /**
   * Checks the current status of the OIBus engine. Used by Helm Charts.
   * This endpoint is public and does not require any authentication
   * @summary Check OIBus status
   */
  @Get('/engine/status')
  getOIBusStatus(@Request() _request: CustomExpressRequest): void {
    return;
  }

  /**
   * Legacy alias for `/api/engine/status`, kept unauthenticated for backward compatibility
   * with tools that still poll the pre-3.7 endpoint.
   * @summary Check OIBus status (legacy alias)
   */
  @Get('/status')
  getOIBusStatusLegacyAlias(@Request() request: CustomExpressRequest): void {
    return this.getOIBusStatus(request);
  }
}
