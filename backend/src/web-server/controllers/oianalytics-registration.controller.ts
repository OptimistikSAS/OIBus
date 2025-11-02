import { Body, Controller, Get, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import { toOIAnalyticsRegistrationDTO } from '../../service/oia/oianalytics-registration.service';

@Route('/api/oianalytics')
@Tags('OIAnalytics Registration')
/**
 * OIAnalytics Registration Management API
 * @description Endpoints for managing OIAnalytics service registration and connection settings
 */
export class OIAnalyticsRegistrationController extends Controller {
  /**
   * Returns the current OIAnalytics registration settings
   * @summary Retrieve registration settings
   * @returns {Promise<RegistrationSettingsDTO>} The registration settings
   */
  @Get('/registration')
  async getRegistrationSettings(@Request() request: CustomExpressRequest): Promise<RegistrationSettingsDTO> {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    return toOIAnalyticsRegistrationDTO(oIAnalyticsRegistrationService.getRegistrationSettings());
  }

  /**
   * Registers the current instance of OIBus with the OIAnalytics service
   * @summary Register service
   * @param {RegistrationSettingsCommandDTO} requestBody.body.required - Registration settings
   */
  @Post('/register')
  @SuccessResponse(204, 'Registration completed successfully')
  async register(@Body() requestBody: RegistrationSettingsCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    await oIAnalyticsRegistrationService.register(requestBody);
  }

  /**
   * Updates the connection settings for the OIAnalytics service
   * @summary Update connection settings
   * @param {RegistrationSettingsCommandDTO} requestBody.body.required - Updated connection settings
   */
  @Put('/registration')
  @SuccessResponse(204, 'Connection settings updated successfully')
  async editRegistrationSettings(
    @Body() requestBody: RegistrationSettingsCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    await oIAnalyticsRegistrationService.editRegistrationSettings(requestBody);
  }

  /**
   * Unregister from OIAnalytics service. OIBus will still be registered on OIAnalytics. It must be removed manually
   * @summary Unregister service
   */
  @Post('/unregister')
  @SuccessResponse(204, 'Unregistration completed successfully')
  async unregister(@Request() request: CustomExpressRequest): Promise<void> {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    await oIAnalyticsRegistrationService.unregister();
  }
}
