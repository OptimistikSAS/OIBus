import {
  Body,
  Controller,
  Delete,
  FormField,
  Get,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  SuccessResponse,
  Tags,
  UploadedFile
} from 'tsoa';
import {
  CertificateCommandDTO,
  CertificateDTO,
  CertificateExportFormat,
  CertificatePrivateKeyExportCommandDTO
} from '../../../shared/model/certificate.model';
import CertificateService, { toCertificateDTO } from '../../service/certificate.service';
import { CustomExpressRequest } from '../express';
import fs from 'node:fs/promises';
import { OIBusValidationError } from '../../model/types';

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
  list(@Request() request: CustomExpressRequest): Array<CertificateDTO> {
    const certificateService: CertificateService = request.services.certificateService;
    return certificateService.list().map(certificate => toCertificateDTO(certificate, id => request.services.userService.getUserInfo(id)));
  }

  /**
   * Retrieves a specific certificate by its unique identifier
   * @summary Get certificate by ID
   * @returns {CertificateDTO} The certificate object
   */
  @Get('/{certificateId}')
  findById(@Path() certificateId: string, @Request() request: CustomExpressRequest): CertificateDTO {
    const certificateService: CertificateService = request.services.certificateService;
    return toCertificateDTO(certificateService.findById(certificateId), id => request.services.userService.getUserInfo(id));
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
    return toCertificateDTO(await certificateService.create(command, request.user.id), id => request.services.userService.getUserInfo(id));
  }

  /**
   * Imports an externally-issued certificate together with its private key, and optionally its CA chain
   * @summary Import certificate
   * @param name Certificate name
   * @param description Certificate description
   * @param certificateFile The certificate file, PEM or DER encoded
   * @param privateKeyFile The private key file, PEM (PKCS#1, PKCS#8, optionally encrypted) or DER encoded
   * @param privateKeyPassphrase The passphrase used to decrypt the private key, if it is encrypted
   * @param caChainFile The optional CA chain bundle (intermediate/root certificates), PEM encoded
   * @returns {CertificateDTO} The imported certificate
   */
  @Post('/import')
  @SuccessResponse(201, 'Certificate imported successfully')
  async import(
    @FormField() name: string,
    @FormField() description: string,
    @UploadedFile('certificate') certificateFile: Express.Multer.File,
    @UploadedFile('privateKey') privateKeyFile: Express.Multer.File,
    @Request() request: CustomExpressRequest,
    @FormField() privateKeyPassphrase?: string,
    @UploadedFile('caChain') caChainFile?: Express.Multer.File
  ): Promise<CertificateDTO> {
    if (!certificateFile || !certificateFile.path) {
      throw new OIBusValidationError('Missing "certificate" file');
    }
    if (!privateKeyFile || !privateKeyFile.path) {
      throw new OIBusValidationError('Missing "privateKey" file');
    }
    const certificateService: CertificateService = request.services.certificateService;
    try {
      const certificateContent = await fs.readFile(certificateFile.path);
      const privateKeyContent = await fs.readFile(privateKeyFile.path);
      const caChainContent = caChainFile && caChainFile.path ? await fs.readFile(caChainFile.path) : null;
      const certificate = await certificateService.import(
        {
          name,
          description,
          certificateContent,
          privateKeyContent,
          privateKeyPassphrase: privateKeyPassphrase || null,
          caChainContent
        },
        request.user.id
      );
      return toCertificateDTO(certificate, id => request.services.userService.getUserInfo(id));
    } finally {
      try {
        await fs.unlink(certificateFile.path);
      } catch {
        // catch the error but don't fail the request
      }
      try {
        await fs.unlink(privateKeyFile.path);
      } catch {
        // catch the error but don't fail the request
      }
      if (caChainFile && caChainFile.path) {
        try {
          await fs.unlink(caChainFile.path);
        } catch {
          // catch the error but don't fail the request
        }
      }
    }
  }

  /**
   * Exports a certificate, optionally including its CA chain
   * @summary Export certificate
   * @param certificateId Certificate ID
   * @param format Export format (PEM or DER)
   * @param includeChain Whether to include the CA chain (PEM only)
   * @responseHeader Content-Type application/x-pem-file
   * @responseHeader Content-Disposition attachment; filename=certificate.pem
   */
  @Get('/{certificateId}/export')
  exportCertificate(
    @Path() certificateId: string,
    @Request() request: CustomExpressRequest,
    @Query() format: CertificateExportFormat = 'PEM',
    @Query() includeChain = false
  ): void {
    const certificateService: CertificateService = request.services.certificateService;
    const { fileName, contentType, body } = certificateService.exportCertificate(certificateId, format, includeChain);
    request.res!.attachment(fileName);
    request.res!.contentType(contentType);
    request.res!.status(200).send(body);
  }

  /**
   * Exports the private key of a certificate, re-encrypted with the given passphrase
   * @summary Export certificate private key
   * @param certificateId Certificate ID
   * @param command.body.required Passphrase used to encrypt the exported private key
   * @responseHeader Content-Type application/x-pem-file
   * @responseHeader Content-Disposition attachment; filename=private-key.pem
   */
  @Post('/{certificateId}/export/private-key')
  @SuccessResponse(200, 'Private key exported successfully')
  async exportPrivateKey(
    @Path() certificateId: string,
    @Body() command: CertificatePrivateKeyExportCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const certificateService: CertificateService = request.services.certificateService;
    const { fileName, contentType, body } = await certificateService.exportPrivateKey(certificateId, command.passphrase, request.user.id);
    request.res!.attachment(fileName);
    request.res!.contentType(contentType);
    request.res!.status(200).send(body);
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
    await certificateService.update(certificateId, command, request.user.id);
  }

  /**
   * Deletes a certificate by its unique identifier
   * @summary Delete certificate
   * @param {string} certificateId.path.required - Certificate ID
   */
  @Delete('/{certificateId}')
  @SuccessResponse(204, 'Certificate deleted successfully')
  delete(@Path() certificateId: string, @Request() request: CustomExpressRequest): void {
    const certificateService: CertificateService = request.services.certificateService;
    certificateService.delete(certificateId);
  }
}
