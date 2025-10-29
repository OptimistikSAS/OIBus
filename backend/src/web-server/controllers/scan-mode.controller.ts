// src/controllers/scan-mode.controller.ts
import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, SuccessResponse } from 'tsoa';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import ScanModeService, { toScanModeDTO } from '../../service/scan-mode.service';
import { CustomExpressRequest } from '../express';

@Route('/api/scan-modes')
export class ScanModeController extends Controller {
  @Get('/')
  async findAll(@Request() request: CustomExpressRequest): Promise<Array<ScanModeDTO>> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return scanModeService.findAll().map(scanMode => toScanModeDTO(scanMode));
  }

  @Get('/{id}')
  async findById(@Path() id: string, @Request() request: CustomExpressRequest): Promise<ScanModeDTO> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    const scanMode = scanModeService.findById(id);
    if (!scanMode) {
      throw new Error('Not found');
    }
    return toScanModeDTO(scanMode);
  }

  @Post('/')
  @SuccessResponse(201, 'Created')
  async create(@Body() requestBody: ScanModeCommandDTO, @Request() request: CustomExpressRequest): Promise<ScanModeDTO> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    const scanMode = await scanModeService.create(requestBody);
    return toScanModeDTO(scanMode);
  }

  @Put('/{id}')
  @SuccessResponse(204, 'No Content')
  async update(@Path() id: string, @Body() requestBody: ScanModeCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    await scanModeService.update(id, requestBody);
  }

  @Delete('/{id}')
  @SuccessResponse(204, 'No Content')
  async delete(@Path() id: string, @Request() request: CustomExpressRequest): Promise<void> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    await scanModeService.delete(id);
  }

  @Post('/verify')
  async verifyCron(@Body() requestBody: { cron: string }, @Request() request: CustomExpressRequest): Promise<ValidatedCronExpression> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return scanModeService.verifyCron(requestBody);
  }
}
