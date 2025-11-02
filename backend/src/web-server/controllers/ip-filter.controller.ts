import { Body, Controller, Delete, Get, Path, Post, Put, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../shared/model/ip-filter.model';
import { CustomExpressRequest } from '../express';
import { toIPFilterDTO } from '../../service/ip-filter.service';

@Route('/api/ip-filters')
@Tags('IP Filters')
/**
 * IP Filter Management API
 * @description Endpoints for managing IP filters used to control access to the system
 */
export class IPFilterController extends Controller {
  /**
   * Retrieves a list of all IP filters
   * @summary List all IP filters
   * @returns {Array<IPFilterDTO>} Array of IP filter objects
   */
  @Get('/')
  async list(@Request() request: CustomExpressRequest): Promise<Array<IPFilterDTO>> {
    const ipFilterService = request.services.ipFilterService;
    const ipFilters = ipFilterService.list();
    return ipFilters.map(ipFilter => toIPFilterDTO(ipFilter));
  }

  /**
   * Retrieves a specific IP filter by its unique identifier
   * @summary Get an IP filter
   * @returns {IPFilterDTO} The IP filter object
   */
  @Get('/{ipFilterId}')
  async findById(@Path() ipFilterId: string, @Request() request: CustomExpressRequest): Promise<IPFilterDTO> {
    const ipFilterService = request.services.ipFilterService;
    return toIPFilterDTO(ipFilterService.findById(ipFilterId));
  }

  /**
   * Creates a new IP filter with the provided configuration
   * @summary Create IP filter
   * @returns {IPFilterDTO} The created IP filter
   */
  @Post('/')
  @SuccessResponse(201, 'IP filter created successfully')
  async create(@Body() command: IPFilterCommandDTO, @Request() request: CustomExpressRequest): Promise<IPFilterDTO> {
    const ipFilterService = request.services.ipFilterService;
    const ipFilter = await ipFilterService.create(command);
    return toIPFilterDTO(ipFilter);
  }

  /**
   * Updates an existing IP filter with new configuration
   * @summary Update IP filter
   */
  @Put('/{ipFilterId}')
  @SuccessResponse(204, 'IP filter updated successfully')
  async update(@Path() ipFilterId: string, @Body() command: IPFilterCommandDTO, @Request() request: CustomExpressRequest): Promise<void> {
    const ipFilterService = request.services.ipFilterService;
    await ipFilterService.update(ipFilterId, command);
  }

  /**
   * Deletes an IP filter by its unique identifier
   * @summary Delete IP filter
   */
  @Delete('/{ipFilterId}')
  @SuccessResponse(204, 'IP filter deleted successfully')
  async delete(@Path() ipFilterId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const ipFilterService = request.services.ipFilterService;
    await ipFilterService.delete(ipFilterId);
  }
}
