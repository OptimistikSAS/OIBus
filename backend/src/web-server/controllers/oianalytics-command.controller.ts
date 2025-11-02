import { Controller, Delete, Get, Path, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import { Instant, Page } from '../../../shared/model/types';
import { CommandSearchParam, OIBusCommandDTO, OIBusCommandStatus, OIBusCommandType } from '../../../shared/model/command.model';
import { CustomExpressRequest } from '../express';
import { toOIBusCommandDTO } from '../../service/oia/oianalytics-command.service';

@Route('/api/oianalytics/commands')
@Tags('OIAnalytics Commands')
/**
 * OIAnalytics Command Management API
 * @description Endpoints for managing OIAnalytics commands and their execution status
 */
export class OIAnalyticsCommandController extends Controller {
  /**
   * Searches OIAnalytics commands with optional filtering by type and status.
   * @summary Search OIAnalytics commands
   * @returns {Promise<Page<OIBusCommandDTO>>} Paginated list of commands
   */
  @Get('/search')
  async search(
    @Query() types: string | undefined,
    @Query() status: string | undefined,
    @Query() start: Instant | undefined,
    @Query() end: Instant | undefined,
    @Query() ack: boolean | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<OIBusCommandDTO>> {
    const normalizedTypes = types ? (types.split(',').filter(type => type.trim() !== '') as Array<OIBusCommandType>) : [];
    const normalizedStatus = status ? (status.split(',').filter(s => s.trim() !== '') as Array<OIBusCommandStatus>) : [];

    const searchParams: CommandSearchParam = {
      types: normalizedTypes,
      status: normalizedStatus,
      page: page ? parseInt(page.toString(), 10) : 0,
      start,
      end,
      ack
    };

    const oIAnalyticsCommandService = request.services.oIAnalyticsCommandService;
    const pageResult = oIAnalyticsCommandService.search(searchParams);

    return {
      content: pageResult.content.map(command => toOIBusCommandDTO(command)),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Deletes an OIAnalytics command by its unique identifier
   * @summary Delete OIAnalytics command
   */
  @Delete('/{commandId}')
  @SuccessResponse(204, 'Command deleted successfully')
  async delete(@Path() commandId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const oIAnalyticsCommandService = request.services.oIAnalyticsCommandService;
    return oIAnalyticsCommandService.delete(commandId);
  }
}
