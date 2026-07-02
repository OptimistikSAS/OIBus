import { Body, Controller, Get, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import {
  EngineLoggerCommandDTO,
  EngineNameCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  EngineSettingsUpdateResultDTO,
  EngineWebServerCommandDTO,
  OIBusInfo
} from '../../../shared/model/engine.model';
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
  @Put('')
  @SuccessResponse(200, 'Engine settings updated successfully')
  async updateEngineSettings(
    @Body() command: EngineSettingsCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<EngineSettingsUpdateResultDTO> {
    const oIBusService = request.services.oIBusService;
    return await oIBusService.updateEngineSettings(command, request.user.id);
  }

  /**
   * Updates only the engine name
   * @summary Update engine name
   * @param {EngineNameCommandDTO} command.body.required - Engine name to update
   */
  @Put('/name')
  @SuccessResponse(200, 'Engine name updated successfully')
  async updateEngineName(@Body() command: EngineNameCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    return await request.services.oIBusService.updateEngineName(command, request.user.id);
  }

  /**
   * Updates only the web server port
   * @summary Update web server settings
   * @param {EngineWebServerCommandDTO} command.body.required - Web server settings to update
   * @returns {EngineSettingsUpdateResultDTO} Information about whether a redirect is needed
   */
  @Put('/web-server')
  @SuccessResponse(200, 'Engine web server settings updated successfully')
  async updateEngineWebServer(
    @Body() command: EngineWebServerCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<EngineSettingsUpdateResultDTO> {
    return await request.services.oIBusService.updateEngineWebServer(command, request.user.id);
  }

  /**
   * Updates only the proxy settings
   * @summary Update proxy settings
   * @param {EngineProxyCommandDTO} command.body.required - Proxy settings to update
   */
  @Put('/proxy')
  @SuccessResponse(200, 'Engine proxy settings updated successfully')
  async updateEngineProxy(@Body() command: EngineProxyCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    return await request.services.oIBusService.updateEngineProxy(command, request.user.id);
  }

  /**
   * Updates only the logging parameters
   * @summary Update logger settings
   * @param {EngineLoggerCommandDTO} command.body.required - Logger settings to update
   */
  @Put('/logger')
  @SuccessResponse(200, 'Engine logger settings updated successfully')
  async updateEngineLogger(@Body() command: EngineLoggerCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    return await request.services.oIBusService.updateEngineLogger(command, request.user.id);
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
  getInfo(@Request() request: CustomExpressRequest): OIBusInfo {
    const oIBusService = request.services.oIBusService;
    return oIBusService.getInfo();
  }

  /**
   * Checks the current status of the OIBus engine
   * @summary Check OIBus status
   */
  @Get('/status')
  /* c8 ignore next */
  getOIBusStatus(@Request() _request: CustomExpressRequest): void {
    // intentionally empty — endpoint only checks that the server is reachable
  }
}
