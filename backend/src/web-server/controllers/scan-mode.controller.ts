import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import ScanModeService, { toScanModeDTO } from '../../service/scan-mode.service';
import { CustomExpressRequest } from '../express';

@Route('/api/scan-modes')
@Tags('Scan Modes')
/**
 * Scan Mode Management API
 * @description Endpoints for managing scan modes used to schedule data collection and processing
 */
export class ScanModeController extends Controller {
  /**
   * Retrieves a list of all scan modes
   * @summary List all scan modes
   * @returns {Promise<Array<ScanModeDTO>>} Array of scan mode objects
   */
  @Get('/')
  async list(@Request() request: CustomExpressRequest): Promise<Array<ScanModeDTO>> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return scanModeService.list().map(scanMode => toScanModeDTO(scanMode));
  }

  /**
   * Retrieves a specific scan mode by its unique identifier
   * @summary Get scan mode
   * @returns {Promise<ScanModeDTO>} The scan mode object
   */
  @Get('/{scanModeId}')
  async findById(@Path() scanModeId: string, @Request() request: CustomExpressRequest): Promise<ScanModeDTO> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return toScanModeDTO(scanModeService.findById(scanModeId));
  }

  /**
   * Creates a new scan mode with the provided configuration
   * @summary Create scan mode
   * @returns {Promise<ScanModeDTO>} The created scan mode
   */
  @Post('/')
  @SuccessResponse(201, 'Scan mode created successfully')
  async create(@Body() command: ScanModeCommandDTO, @Request() request: CustomExpressRequest): Promise<ScanModeDTO> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return toScanModeDTO(await scanModeService.create(command));
  }

  /**
   * Updates an existing scan mode with new configuration
   * @summary Update scan mode
   */
  @Put('/{scanModeId}')
  @SuccessResponse(204, 'Scan mode updated successfully')
  async update(@Path() scanModeId: string, @Body() command: ScanModeCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    await scanModeService.update(scanModeId, command);
  }

  /**
   * Deletes a scan mode by its unique identifier
   * @summary Delete scan mode
   */
  @Delete('/{scanModeId}')
  @SuccessResponse(204, 'Scan mode deleted successfully')
  async delete(@Path() scanModeId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    await scanModeService.delete(scanModeId);
  }

  /**
   * Validates a cron expression to ensure it's properly formatted
   * @summary Validate cron expression
   * @returns {Promise<ValidatedCronExpression>} The cron validation with next execution times
   */
  @Post('/verify')
  async verifyCron(@Body() command: { cron: string }, @Request() request: CustomExpressRequest): Promise<ValidatedCronExpression> {
    const scanModeService: ScanModeService = request.services.scanModeService;
    return scanModeService.verifyCron(command);
  }
}
