import { Body, Controller, Get, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import { toEngineSettingsDTO } from '../../service/oibus.service';

@Route('/api/engine')
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
  @Get('')
  async getEngineSettings(@Request() request: CustomExpressRequest): Promise<EngineSettingsDTO> {
    const oIBusService = request.services.oIBusService;
    return toEngineSettingsDTO(oIBusService.getEngineSettings());
  }

  /**
   * Updates the configuration settings of the OIBus engine
   * @summary Update engine configuration
   * @param {EngineSettingsCommandDTO} command.body.required - Engine settings to update
   */
  @Put('')
  @SuccessResponse(204, 'Engine settings updated successfully')
  async updateEngineSettings(@Body() command: EngineSettingsCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService;
    await oIBusService.updateEngineSettings(command);
  }

  /**
   * Resets all metrics collected by the OIBus engine
   * @summary Reset metrics
   */
  @Post('/metrics/reset')
  @SuccessResponse(204, 'Engine metrics reset successfully')
  async resetEngineMetrics(@Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService;
    await oIBusService.resetEngineMetrics();
  }

  /**
   * Restarts the OIBus process
   * @summary Restart OIBus process
   */
  @Post('/restart')
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
  @Get('/info')
  async getInfo(@Request() request: CustomExpressRequest): Promise<OIBusInfo> {
    const oIBusService = request.services.oIBusService;
    return oIBusService.getInfo();
  }

  /**
   * Checks the current status of the OIBus engine
   * @summary Check OIBus status
   */
  @Get('/status')
  async getOIBusStatus(@Request() _request: CustomExpressRequest): Promise<void> {
    return;
  }
}
