import { Body, Controller, Get, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';

import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/api/engine.model';
import { ServerTrustStateDTO, TrustServerIdentityCommandDTO } from '../../../shared/model/api/server-identity.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { PresentedServerIdentity } from '../../../shared/model/domain/server-identity.model';

import { OIBusTestingError, OIBusValidationError } from '../../model/types';
import { toOIAnalyticsRegistrationDTO } from '../../service/oia/oianalytics-registration.service';
import { toServerTrustStateDTO } from '../../service/server-trust.utils';
import { CustomExpressRequest } from '../express';

/** Adds the certificate of a server to the certificate store, under this name (see `CertificateService`) */
type TrustServerCertificate = (certificatePem: string, name: string) => { id: string };

/** Adds the certificate OIAnalytics presents to the certificate store, as trusted by the user of the request */
const trustCertificate = (request: CustomExpressRequest) => (certificatePem: string) =>
  request.services.certificateService.trustServerCertificate(certificatePem, 'OIAnalytics server', request.user.id);

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
  getRegistrationSettings(@Request() request: CustomExpressRequest): RegistrationSettingsDTO {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    return toOIAnalyticsRegistrationDTO(oIAnalyticsRegistrationService.getRegistrationSettings(), id =>
      request.services.userService.getUserInfo(id)
    );
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
    // the certificate trusted in the form is removed from the store when the registration fails
    await request.services.certificateService.saveTrustingServerCertificates(
      request.user.id,
      (trustServerCertificate: TrustServerCertificate) =>
        oIAnalyticsRegistrationService.register(requestBody, request.user.id, certificatePem =>
          trustServerCertificate(certificatePem, 'OIAnalytics server')
        )
    );
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
    await request.services.certificateService.saveTrustingServerCertificates(
      request.user.id,
      (trustServerCertificate: TrustServerCertificate) =>
        oIAnalyticsRegistrationService.editRegistrationSettings(requestBody, request.user.id, certificatePem =>
          trustServerCertificate(certificatePem, 'OIAnalytics server')
        )
    );
  }

  /**
   * Test connection to OIAnalytics service with the provided settings. The result carries the identity OIAnalytics presents
   * when its certificate does not validate, and the connection is only tested further when it does
   * @summary Test connection
   * @param {RegistrationSettingsCommandDTO} requestBody.body.required - Connection settings to test
   * @param withServerIdentity Whether to return the identity of OIAnalytics when its certificate does not validate, for the
   * user to review it, instead of failing
   */
  @Post('/registration/test-connection')
  async testConnection(
    @Body() requestBody: RegistrationSettingsCommandDTO,
    @Request() request: CustomExpressRequest,
    @Query() withServerIdentity?: boolean
  ): Promise<OIBusConnectionTestResult> {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    return await oIAnalyticsRegistrationService.testConnection(requestBody, withServerIdentity ?? false);
  }

  /**
   * Retrieves the trust of the registration in the identity of OIAnalytics (the certificate of the store its certificate is
   * validated against), with the identity OIAnalytics presented at the last request refused (pending, until a user trusts it)
   * @summary Get the trust in the identity of OIAnalytics
   */
  @Get('/registration/server-trust')
  getServerTrust(@Request() request: CustomExpressRequest): ServerTrustStateDTO {
    return toServerTrustStateDTO(request.services.oIAnalyticsRegistrationService.getServerTrustState(), id =>
      request.services.userService.getUserInfo(id)
    );
  }

  /**
   * Trusts the identity OIAnalytics presents, when its fingerprint is the one given: its certificate is added to the
   * certificate store, and the registration validates the certificate of OIAnalytics against it
   * @summary Trust the identity of OIAnalytics
   */
  @Post('/registration/server-trust')
  @SuccessResponse(204, 'No Content')
  async trustServerIdentity(@Body() command: TrustServerIdentityCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    try {
      await request.services.oIAnalyticsRegistrationService.trustServerIdentity(
        command.fingerprint,
        request.user.id,
        trustCertificate(request)
      );
    } catch (error: unknown) {
      throw error instanceof OIBusValidationError ? error : new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Retrieves the identity OIAnalytics presents with the saved registration settings, and whether its certificate validates,
   * without sending anything. Null without TLS
   * @summary Retrieve the identity of OIAnalytics
   */
  @Post('/registration/server-identity')
  async retrieveServerIdentity(@Request() request: CustomExpressRequest): Promise<PresentedServerIdentity | null> {
    try {
      return await request.services.oIAnalyticsRegistrationService.retrieveServerIdentity();
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Unregister from OIAnalytics service. OIBus will still be registered on OIAnalytics. It must be removed manually
   * @summary Unregister service
   */

  @Post('/unregister')
  @SuccessResponse(204, 'Unregistration completed successfully')
  unregister(@Request() request: CustomExpressRequest): void {
    const oIAnalyticsRegistrationService = request.services.oIAnalyticsRegistrationService;
    oIAnalyticsRegistrationService.unregister();
  }
}
