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
   * Searches OIAnalytics commands with optional filtering by type, status, and time range.
   * @summary Search OIAnalytics commands
   * @param types Comma-separated list of command types to filter by (e.g. `update-version,restart-engine`).
   * @param status Comma-separated list of statuses to filter by (e.g. `COMPLETED,ERRORED`). Valid values: `RETRIEVED`, `RUNNING`, `ERRORED`, `CANCELLED`, `COMPLETED`.
   * @param start ISO 8601 start of the time range.
   * @param end ISO 8601 end of the time range.
   * @param ack Filter by acknowledgement status. `true` returns only acknowledged commands.
   * @returns {Promise<Page<OIBusCommandDTO>>} Paginated list of commands
   */
  @Get('/search')
  search(
    @Query() types: string | undefined,
    @Query() status: string | undefined,
    @Query() start: Instant | undefined,
    @Query() end: Instant | undefined,
    @Query() ack: boolean | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Page<OIBusCommandDTO> {
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
  delete(@Path() commandId: string, @Request() request: CustomExpressRequest): void {
    const oIAnalyticsCommandService = request.services.oIAnalyticsCommandService;
    return oIAnalyticsCommandService.delete(commandId);
  }
}
