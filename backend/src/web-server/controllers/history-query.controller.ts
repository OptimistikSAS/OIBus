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
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam,
  HistoryQueryLightDTO
} from '../../../shared/model/history-query.model';
import { CustomExpressRequest } from '../express';
import { OIBusSouthType } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import HistoryQueryService, { toHistoryQueryDTO, toHistoryQueryItemDTO, toHistoryQueryLightDTO } from '../../service/history-query.service';
import { itemToFlattenedCSV } from '../../service/utils';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import {
  CacheContentUpdateCommand,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  OIBusConnectionTestResult,
  OIBusContent
} from '../../../shared/model/engine.model';
import { HistoryTransformerDTOWithOptions, TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { OIBusTestingError, OIBusValidationError } from '../../model/types';
import { HistoryTransformerWithOptions } from '../../model/transformer.model';
import fs from 'node:fs/promises';
import OIBusService from '../../service/oibus.service';

/**
 * @interface HistorySouthItemTestRequest
 * @description Request body for testing history query items
 */
interface HistorySouthItemTestRequest {
  /** South connector settings */
  southSettings: SouthSettings;
  /** Item-specific settings */
  itemSettings: SouthItemSettings;
  /** Testing settings including time range */
  testingSettings: {
    history: {
      /** Start time for the test */
      startTime: string;
      /** End time for the test */
      endTime: string;
    };
  };
}

/**
 * @interface HistoryCsvImportResponse
 * @description Response for CSV import check operation
 */
interface HistoryCsvImportResponse {
  /** Array of valid items that can be imported */
  items: Array<HistoryQueryItemCommandDTO>;
  /** Array of items with errors */
  errors: Array<{ item: Record<string, string>; error: string }>;
}

/**
 * @interface HistoryCsvDelimiterRequest
 * @description Request body for CSV delimiter specification
 */
interface HistoryCsvDelimiterRequest {
  /** CSV delimiter character */
  delimiter: string;
}

@Route('/api/history')
@Tags('History Queries')
/**
 * @class HistoryQueryController
 * @description Endpoints for managing history queries, items, and cache operations
 * @tags HistoryQueries
 */
export class HistoryQueryController extends Controller {
  /**
   * Retrieves a list of all configured history queries
   * @summary List all history queries
   * @returns {Promise<Array<HistoryQueryLightDTO>>} Array of history query objects
   */
  @Get('/')
  async list(@Request() request: CustomExpressRequest): Promise<Array<HistoryQueryLightDTO>> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQueries = historyQueryService.list();
    return historyQueries.map(historyQuery => toHistoryQueryLightDTO(historyQuery, id => request.services.userService.getUserInfo(id)));
  }

  /**
   * Retrieves a specific history query by its unique identifier
   * @summary Get history query by ID
   * @returns {Promise<HistoryQueryDTO>} The history query object
   */
  @Get('/{historyId}')
  async findById(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<HistoryQueryDTO> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    return toHistoryQueryDTO(historyQueryService.findById(historyId), id =>
      request.services.userService.getUserInfo(id)
    ) as HistoryQueryDTO;
  }

  /**
   * Creates a new history query with the provided configuration
   * @summary Create history query
   * @returns {Promise<HistoryQueryDTO>} The created history query
   */
  @Post('/')
  @SuccessResponse(201, 'Created')
  async create(
    @Body() command: HistoryQueryCommandDTO,
    @Query() fromSouth: string | undefined,
    @Query() fromNorth: string | undefined,
    @Query() duplicate: string | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<HistoryQueryDTO> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    return toHistoryQueryDTO(await historyQueryService.create(command, fromSouth, fromNorth, duplicate, request.user.id), id =>
      request.services.userService.getUserInfo(id)
    ) as HistoryQueryDTO;
  }

  /**
   * Updates an existing history query configuration
   * @summary Update history query
   */
  @Put('/{historyId}')
  @SuccessResponse(204, 'No Content')
  async update(
    @Path() historyId: string,
    @Body() command: HistoryQueryCommandDTO,
    @Query() resetCache: string | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.update(historyId, command, resetCache === 'true', request.user.id);
  }

  /**
   * Deletes a history query by its ID
   * @summary Delete history query
   */
  @Delete('/{historyId}')
  @SuccessResponse(204, 'No Content')
  async delete(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.delete(historyId);
  }

  /**
   * Starts a history query
   * @summary Start history query
   */
  @Post('/{historyId}/start')
  @SuccessResponse(204, 'No Content')
  async start(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.start(historyId);
  }

  /**
   * Pause a history query
   * @summary Pause history query
   */
  @Post('/{historyId}/pause')
  @SuccessResponse(204, 'No Content')
  async pause(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.pause(historyId);
  }

  /**
   * Test north connection for a history query
   * @summary Test north connection
   */
  @Post('/{historyId}/test/north')
  async testNorth(
    @Path() historyId: string,
    @Query() northType: OIBusNorthType,
    @Query() fromNorth: string | undefined,
    @Body() command: NorthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<OIBusConnectionTestResult> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    try {
      return await historyQueryService.testNorth(historyId, northType, fromNorth, command);
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Test south connection for a history query
   * @summary Test south connection
   */
  @Post('/{historyId}/test/south')
  async testSouth(
    @Path() historyId: string,
    @Query() southType: OIBusSouthType,
    @Query() fromSouth: string | undefined,
    @Body() command: SouthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<OIBusConnectionTestResult> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    try {
      return await historyQueryService.testSouth(historyId, southType, fromSouth, command);
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Test a history query item
   * @summary Test history query item
   */
  @Post('/{historyId}/test/items')
  async testItem(
    @Path() historyId: string,
    @Query() southType: OIBusSouthType,
    @Query() itemName: string,
    @Query() fromSouth: string | undefined,
    @Body() command: HistorySouthItemTestRequest,
    @Request() request: CustomExpressRequest
  ): Promise<OIBusContent> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    try {
      return await historyQueryService.testItem(
        historyId,
        southType,
        itemName,
        fromSouth,
        command.southSettings,
        command.itemSettings,
        command.testingSettings
      );
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * List all items for a history query
   * @summary List history query items
   * @returns {Promise<Array<HistoryQueryItemDTO>>} List of items
   */
  @Get('/{historyId}/items/list')
  async listItems(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<Array<HistoryQueryItemDTO>> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const items = historyQueryService.listItems(historyId);
    return items.map(
      item => toHistoryQueryItemDTO(item, historyQuery.southType, id => request.services.userService.getUserInfo(id)) as HistoryQueryItemDTO
    );
  }

  /**
   * Searches for items in a history query with optional filtering
   * @summary Search history query items
   * @returns {Promise<Page<HistoryQueryItemDTO>>} Paginated list of items
   */
  @Get('/{historyId}/items/search')
  async searchItems(
    @Path() historyId: string,
    @Query() name: string | undefined,
    @Query() enabled: boolean | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<HistoryQueryItemDTO>> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const searchParams: HistoryQueryItemSearchParam = {
      name,
      enabled,
      page: page ? parseInt(page.toString(), 10) : 0
    };
    const pageResult = await historyQueryService.searchItems(historyId, searchParams);
    return {
      content: pageResult.content.map(
        item =>
          toHistoryQueryItemDTO(item, historyQuery.southType, id => request.services.userService.getUserInfo(id)) as HistoryQueryItemDTO
      ),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Retrieves a specific item from a history query
   * @summary Get history query item
   * @returns {Promise<HistoryQueryItemDTO>} The history query item
   */
  @Get('/{historyId}/items/{itemId}')
  async findItemById(
    @Path() historyId: string,
    @Path() itemId: string,
    @Request() request: CustomExpressRequest
  ): Promise<HistoryQueryItemDTO> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const historyQueryItem = historyQueryService.findItemById(historyId, itemId);
    return toHistoryQueryItemDTO(historyQueryItem, historyQuery.southType, id =>
      request.services.userService.getUserInfo(id)
    ) as HistoryQueryItemDTO;
  }

  /**
   * Creates a new item in a history query
   * @summary Create history query item
   * @returns {Promise<HistoryQueryItemDTO>} The created item
   */
  @Post('/{historyId}/items')
  @SuccessResponse(201, 'Created')
  async createItem(
    @Path() historyId: string,
    @Body() command: HistoryQueryItemCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<HistoryQueryItemDTO> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const item = await historyQueryService.createItem(historyId, command, request.user.id);
    return toHistoryQueryItemDTO(item, historyQuery.southType, id => request.services.userService.getUserInfo(id)) as HistoryQueryItemDTO;
  }

  /**
   * Updates an existing item in a history query
   * @summary Update history query item
   */
  @Put('/{historyId}/items/{itemId}')
  @SuccessResponse(204, 'No Content')
  async updateItem(
    @Path() historyId: string,
    @Path() itemId: string,
    @Body() command: HistoryQueryItemCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.updateItem(historyId, itemId, command, request.user.id);
  }

  /**
   * Enable a history query item
   * @summary Enable history query item
   */
  @Post('/{historyId}/items/{itemId}/enable')
  @SuccessResponse(204, 'No Content')
  async enableItem(@Path() historyId: string, @Path() itemId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.enableItem(historyId, itemId);
  }

  /**
   * Disable a history query item
   * @summary Disable history query item
   */
  @Post('/{historyId}/items/{itemId}/disable')
  @SuccessResponse(204, 'No Content')
  async disableItem(@Path() historyId: string, @Path() itemId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.disableItem(historyId, itemId);
  }

  /**
   * Enable a list of history query items
   * @summary Enable history query items
   */
  @Post('/{historyId}/items/enable')
  @SuccessResponse(204, 'No Content')
  async enableItems(
    @Path() historyId: string,
    @Body() command: { itemIds: Array<string> },
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.enableItems(historyId, command.itemIds);
  }

  /**
   * Disable a list of history query items
   * @summary Disable history query items
   */
  @Post('/{historyId}/items/disable')
  @SuccessResponse(204, 'No Content')
  async disableItems(
    @Path() historyId: string,
    @Body() command: { itemIds: Array<string> },
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.disableItems(historyId, command.itemIds);
  }

  /**
   * Delete a history query item
   * @summary Delete history query item
   */
  @Delete('/{historyId}/items/{itemId}')
  @SuccessResponse(204, 'No Content')
  async deleteItem(@Path() historyId: string, @Path() itemId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.deleteItem(historyId, itemId);
  }

  /**
   * Delete a list of history query items
   * @summary Delete history query items
   */
  @Post('/{historyId}/items/delete')
  @SuccessResponse(204, 'No Content')
  async deleteItems(
    @Path() historyId: string,
    @Body() command: { itemIds: Array<string> },
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.deleteItems(historyId, command.itemIds);
  }

  /**
   * Delete all items from a history query
   * @summary Delete all items
   */
  @Delete('/{historyId}/items')
  @SuccessResponse(204, 'No Content')
  async deleteAllItems(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.deleteAllItems(historyId);
  }

  /**
   * Converts frontend in memory items to CSV format
   * @summary Convert items to CSV
   * @responseHeader Content-Type text/csv; charset=utf-8
   * @responseHeader Content-Disposition attachment; filename=items.csv
   */
  @Post('/{southType}/items/to-csv')
  async itemsToCsv(
    @Path() southType: string,
    @FormField() delimiter: string,
    @UploadedFile('items') itemsFile: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    if (!itemsFile || !itemsFile.path) {
      throw new OIBusValidationError('Missing "items" file');
    }
    try {
      const fileContent = await fs.readFile(itemsFile.path, 'utf8');
      const items: Array<HistoryQueryItemDTO> = JSON.parse(fileContent);

      const csv = itemToFlattenedCSV(items, delimiter);
      request.res!.attachment('items.csv');
      request.res!.contentType('text/csv; charset=utf-8');
      request.res!.status(200).send(csv);
    } finally {
      try {
        await fs.unlink(itemsFile.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }

  /**
   * Exports all items from a history query as a CSV file
   * @summary Export items to CSV
   * @responseHeader Content-Type text/csv; charset=utf-8
   * @responseHeader Content-Disposition attachment; filename=items.csv
   */
  @Post('/{historyId}/items/export')
  async exportItems(
    @Path() historyId: string,
    @Body() command: HistoryCsvDelimiterRequest,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const csv = itemToFlattenedCSV(
      historyQuery.items.map(
        item =>
          toHistoryQueryItemDTO(item, historyQuery.southType, id => request.services.userService.getUserInfo(id)) as HistoryQueryItemDTO
      ),
      command.delimiter
    );
    request.res!.attachment('items.csv');
    request.res!.contentType('text/csv; charset=utf-8');
    request.res!.status(200).send(csv);
  }

  /**
   * Validates a CSV file before import and checks for conflicts with existing items
   * @summary Check CSV import
   * @returns {Promise<HistoryCsvImportResponse>} Import validation results
   */
  @Post('/{southType}/items/import/check')
  async checkImportItems(
    @Path() southType: string,
    @FormField() delimiter: string,
    @UploadedFile('itemsToImport') itemsToImportFile: Express.Multer.File,
    @UploadedFile('currentItems') currentItemsFile: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<HistoryCsvImportResponse> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;

    if (!itemsToImportFile || !currentItemsFile || !itemsToImportFile.path || !currentItemsFile.path) {
      throw new OIBusValidationError('Missing "itemsToImport" or "currentItems"');
    }

    try {
      const itemsToImportContent = await fs.readFile(itemsToImportFile.path, 'utf8');
      const currentItemsContent = await fs.readFile(currentItemsFile.path, 'utf8');
      return await historyQueryService.checkImportItems(
        southType,
        itemsToImportContent,
        delimiter,
        JSON.parse(currentItemsContent) as Array<HistoryQueryItemDTO>
      );
    } finally {
      try {
        await fs.unlink(itemsToImportFile.path);
      } catch {
        // catch the error but don't fail the request
      }

      try {
        await fs.unlink(currentItemsFile.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }

  /**
   * Imports items from a CSV file into a history query
   * @summary Import items from CSV
   */
  @Post('/{historyId}/items/import')
  @SuccessResponse(204, 'No Content')
  async importItems(
    @Path() historyId: string,
    @UploadedFile('items') itemsFile: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    if (!itemsFile || !itemsFile.path) {
      throw new OIBusValidationError('Missing file "items"');
    }
    try {
      const fileContent = await fs.readFile(itemsFile.path, 'utf8');
      const items: Array<HistoryQueryItemCommandDTO> = JSON.parse(fileContent);
      await historyQueryService.importItems(historyId, items, request.user.id);
    } finally {
      try {
        await fs.unlink(itemsFile.path);
      } catch {
        // catch the error but don't fail the request
      }
    }
  }

  /**
   * Adds or updates a transformer configuration for a history query
   * @summary Add/edit transformer
   */
  @Post('/{historyId}/transformers')
  @SuccessResponse(204, 'No Content')
  async addOrEditTransformer(
    @Path() historyId: string,
    @Body() command: HistoryTransformerDTOWithOptions,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.addOrEditTransformer(historyId, command as unknown as HistoryTransformerWithOptions);
  }

  /**
   * Remove a transformer from a history query
   * @summary Remove transformer
   */
  @Delete('/{historyId}/transformers/{transformerId}')
  @SuccessResponse(204, 'No Content')
  async removeTransformer(
    @Path() historyId: string,
    @Path() transformerId: string,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.removeTransformer(historyId, transformerId);
  }

  /**
   * Searches for files in the history query cache
   * @summary Search files in cache, error and archive folders
   * @returns {Promise<CacheSearchResult>} The cache search result
   */
  @Get('/{historyId}/cache/search')
  async searchCacheContent(
    @Path() historyId: string,
    @Query() nameContains: string | undefined,
    @Query() start: string | undefined,
    @Query() end: string | undefined,
    @Query() maxNumberOfFilesReturned: number | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<CacheSearchResult> {
    const engineService = request.services.oIBusService as OIBusService;
    return await engineService.searchCacheContent('history', historyId, {
      start,
      end,
      nameContains,
      maxNumberOfFilesReturned: maxNumberOfFilesReturned || 0
    });
  }

  /**
   * Retrieve a file from a north connector cache
   * @summary Retrieve cache file content
   * @returns {Promise<FileCacheContent>} The content of the file - may be truncated
   */
  @Get('/{historyId}/cache/content/{filename}')
  async getCacheFileContent(
    @Path() historyId: string,
    @Path() filename: string,
    @Query() folder: DataFolderType,
    @Request() request: CustomExpressRequest
  ): Promise<FileCacheContent> {
    const engineService = request.services.oIBusService as OIBusService;
    return await engineService.getFileFromCache('history', historyId, folder, filename);
  }

  /**
   * Update cache content by moving or removing files from cache, archive and error folders
   * @summary Move or remove files from cache, error and archive folders
   */
  @Delete('/{historyId}/cache/update')
  @SuccessResponse(204, 'No Content')
  async updateCacheContent(
    @Path() historyId: string,
    @Body() updateCommand: CacheContentUpdateCommand,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const engineService = request.services.oIBusService as OIBusService;
    await engineService.updateCacheContent('history', historyId, updateCommand);
  }
}
