import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import CertificateService, { toCertificateDTO } from '../../service/certificate.service';
import { CustomExpressRequest } from '../express';

@Route('/api/certificates')
@Tags('Certificates')
/**
 * Certificate Management API
 * @description Endpoints for managing SSL/TLS certificates used for secure communication
 */
export class CertificateController extends Controller {
  /**
   * Retrieves a list of all available certificates
   * @summary List all certificates
   * @returns {Array<CertificateDTO>} Array of certificate objects
   */
  @Get('/')
  async list(@Request() request: CustomExpressRequest): Promise<Array<CertificateDTO>> {
    const certificateService: CertificateService = request.services.certificateService;
    return certificateService.list().map(certificate => toCertificateDTO(certificate));
  }

  /**
   * Retrieves a specific certificate by its unique identifier
   * @summary Get certificate by ID
   * @returns {CertificateDTO} The certificate object
   */
  @Get('/{certificateId}')
  async findById(@Path() certificateId: string, @Request() request: CustomExpressRequest): Promise<CertificateDTO> {
    const certificateService: CertificateService = request.services.certificateService;
    return toCertificateDTO(certificateService.findById(certificateId));
  }

  /**
   * Creates a new certificate with the provided details
   * @summary Create certificate
   * @returns {CertificateDTO} The created certificate
   */
  @Post('/')
  @SuccessResponse(201, 'Certificate created successfully')
  async create(@Body() command: CertificateCommandDTO, @Request() request: CustomExpressRequest): Promise<CertificateDTO> {
    const certificateService: CertificateService = request.services.certificateService;
    return toCertificateDTO(await certificateService.create(command));
  }

  /**
   * Updates an existing certificate with new details
   * @summary Update certificate
   * @param {CertificateCommandDTO} command.body.required - Updated certificate data
   */
  @Put('/{certificateId}')
  @SuccessResponse(204, 'Certificate updated successfully')
  async update(
    @Path() certificateId: string,
    @Body() command: CertificateCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const certificateService: CertificateService = request.services.certificateService;
    await certificateService.update(certificateId, command);
  }

  /**
   * Deletes a certificate by its unique identifier
   * @summary Delete certificate
   * @param {string} certificateId.path.required - Certificate ID
   */
  @Delete('/{certificateId}')
  @SuccessResponse(204, 'Certificate deleted successfully')
  async delete(@Path() certificateId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const certificateService: CertificateService = request.services.certificateService;
    await certificateService.delete(certificateId);
  }
}
