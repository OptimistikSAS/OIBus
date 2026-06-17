import { Controller, Get, Path, Query, Request, Route, Tags } from 'tsoa';
import { Instant, Page } from '../../../shared/model/types';
import { Item, LogDTO, LogLevel, LogSearchParam, Scope, ScopeType } from '../../../shared/model/logs.model';
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
   * @param start ISO 8601 start of the time range (e.g. `2024-01-01T00:00:00.000Z`). Defaults to 24 hours ago.
   * @param end ISO 8601 end of the time range (e.g. `2024-01-02T00:00:00.000Z`). Defaults to now.
   * @param levels Comma-separated list of log levels to include (e.g. `error,warn`). Valid values: `silent`, `error`, `warn`, `info`, `debug`, `trace`.
   * @param scopeIds Comma-separated list of scope IDs to filter by (e.g. `connector123,connector456`).
   * @param scopeTypes Comma-separated list of scope types to filter by (e.g. `south,north`). Valid values: `south`, `north`, `history-query`, `internal`.
   * @param itemIds Comma-separated list of item IDs to filter by (e.g. `item123,item456`).
   * @param messageContent Substring to search for within log messages.
   * @returns {Promise<Page<LogDTO>>} Paginated list of log entries
   */
  @Get('/')
  async search(
    @Query() start: Instant | undefined,
    @Query() end: Instant | undefined,
    @Query() levels: string | undefined,
    @Query() scopeIds: string | undefined,
    @Query() scopeTypes: string | undefined,
    @Query() itemIds: string | undefined,
    @Query() messageContent: string | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<LogDTO>> {
    const now = DateTime.now();
    const dayAgo = now.minus({ days: 1 });

    const normalizedLevels = levels ? (levels.split(',').filter(level => level.trim() !== '') as Array<LogLevel>) : [];
    const normalizedScopeTypes = scopeTypes ? (scopeTypes.split(',').filter(scopeType => scopeType.trim() !== '') as Array<ScopeType>) : [];
    const normalizedScopeIds = scopeIds ? (scopeIds.split(',').filter(scopeId => scopeId.trim() !== '') as Array<string>) : [];
    const normalizedItemIds = itemIds ? itemIds.split(',').filter(itemId => itemId.trim() !== '') : [];

    const searchParams: LogSearchParam = {
      page: page ? parseInt(page.toString(), 10) : 0,
      start: start || dayAgo.toUTC().toISO(),
      end: end || now.toUTC().toISO(),
      levels: normalizedLevels,
      scopeIds: normalizedScopeIds,
      scopeTypes: normalizedScopeTypes,
      itemIds: normalizedItemIds,
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
  suggestScopes(@Query() name = '', @Request() request: CustomExpressRequest): Array<Scope> {
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
  getScopeById(@Path() scopeId: string, @Request() request: CustomExpressRequest): Scope {
    const logService = request.services.logService;
    return logService.getScopeById(scopeId);
  }

  /**
   * Returns a list of item suggestions based on the provided name fragment
   * @summary Get item suggestions
   * @returns {Promise<Array<Item>>} Array of matching item objects
   */
  @Get('/items/suggest')
  suggestItems(@Query() name = '', @Request() request: CustomExpressRequest): Array<Item> {
    const logService = request.services.logService;
    return logService.suggestItems(name);
  }

  /**
   * Retrieves details for a specific log item by its ID
   * @summary Get log item details
   * @param {string} itemId.path.required - Item ID
   * @returns {Promise<Item>} Item object or 404 if not found
   */
  @Get('/items/{itemId}')
  getItemById(@Path() itemId: string, @Request() request: CustomExpressRequest): Item {
    const logService = request.services.logService;
    return logService.getItemById(itemId);
  }
}
