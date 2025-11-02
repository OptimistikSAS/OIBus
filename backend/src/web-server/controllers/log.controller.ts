import { Controller, Get, Path, Query, Request, Route, Tags } from 'tsoa';
import { Instant, Page } from '../../../shared/model/types';
import { LogDTO, LogLevel, LogSearchParam, Scope, ScopeType } from '../../../shared/model/logs.model';
import { DateTime } from 'luxon';
import { CustomExpressRequest } from '../express';
import { toLogDTO } from '../../service/log.service';

@Route('/api/logs')
@Tags('Logs')
/**
 * Log Management API
 * @description Endpoints for searching and retrieving system logs
 */
export class LogController extends Controller {
  /**
   * Searches system logs with various filter parameters. If no time range is specified, defaults to the last 24 hours.
   * @summary Search logs
   * @returns {Promise<Page<LogDTO>>} Paginated list of log entries
   */
  @Get('/')
  async search(
    @Query() start: Instant | undefined,
    @Query() end: Instant | undefined,
    @Query() levels: string | undefined,
    @Query() scopeIds: string | undefined,
    @Query() scopeTypes: string | undefined,
    @Query() messageContent: string | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<LogDTO>> {
    const now = DateTime.now();
    const dayAgo = now.minus({ days: 1 });

    const normalizedLevels = levels ? (levels.split(',').filter(level => level.trim() !== '') as Array<LogLevel>) : [];
    const normalizedScopeTypes = scopeTypes ? (scopeTypes.split(',').filter(scopeType => scopeType.trim() !== '') as Array<ScopeType>) : [];
    const normalizedScopeIds = scopeIds ? (scopeIds.split(',').filter(scopeId => scopeId.trim() !== '') as Array<string>) : [];

    const searchParams: LogSearchParam = {
      page: page ? parseInt(page.toString(), 10) : 0,
      start: start || dayAgo.toUTC().toISO(),
      end: end || now.toUTC().toISO(),
      levels: normalizedLevels,
      scopeIds: normalizedScopeIds,
      scopeTypes: normalizedScopeTypes,
      messageContent: messageContent
    };

    const logService = request.services.logService;
    const pageResult = await logService.search(searchParams);

    return {
      content: pageResult.content.map(element => toLogDTO(element)),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Returns a list of scope suggestions based on the provided name fragment
   * @summary Get scope suggestions
   * @returns {Promise<Array<Scope>>} Array of matching scope objects
   */
  @Get('/scopes/suggest')
  async suggestScopes(@Query() name = '', @Request() request: CustomExpressRequest): Promise<Array<Scope>> {
    const logService = request.services.logService;
    return logService.suggestScopes(name);
  }

  /**
   * Retrieves details for a specific log scope by its ID
   * @summary Get log scope details
   * @param {string} scopeId.path.required - Scope ID
   * @returns {Promise<Scope|null>} Scope object or null if not found
   */
  @Get('/scopes/{scopeId}')
  async getScopeById(@Path() scopeId: string, @Request() request: CustomExpressRequest): Promise<Scope> {
    const logService = request.services.logService;
    return logService.getScopeById(scopeId);
  }
}
