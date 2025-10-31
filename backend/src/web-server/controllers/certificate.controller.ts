import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, SuccessResponse } from 'tsoa';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import CertificateService, { toCertificateDTO } from '../../service/certificate.service';
import { CustomExpressRequest } from '../express';

@Route('/api/certificates')
export class CertificateController extends Controller {
  @Get('/')
  async findAll(@Request() request: CustomExpressRequest): Promise<Array<CertificateDTO>> {
    const certificateService: CertificateService = request.services.certificateService;
    return certificateService.findAll().map(certificate => toCertificateDTO(certificate));
  }

  @Get('/{id}')
  async findById(@Path() id: string, @Request() request: CustomExpressRequest): Promise<CertificateDTO> {
    const certificateService: CertificateService = request.services.certificateService;
    const certificate = certificateService.findById(id);
    if (!certificate) {
      throw new Error('Not found');
    }
    return toCertificateDTO(certificate);
  }

  @Post('/')
  @SuccessResponse(201, 'Created')
  async create(@Body() requestBody: CertificateCommandDTO, @Request() request: CustomExpressRequest): Promise<CertificateDTO> {
    const certificateService: CertificateService = request.services.certificateService;
    const certificate = await certificateService.create(requestBody);
    return toCertificateDTO(certificate);
  }

  @Put('/{id}')
  @SuccessResponse(204, 'No Content')
  async update(@Path() id: string, @Body() requestBody: CertificateCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const certificateService: CertificateService = request.services.certificateService;
    await certificateService.update(id, requestBody);
  }

  @Delete('/{id}')
  @SuccessResponse(204, 'No Content')
  async delete(@Path() id: string, @Request() request: CustomExpressRequest): Promise<void> {
    const certificateService: CertificateService = request.services.certificateService;
    await certificateService.delete(id);
  }
}
