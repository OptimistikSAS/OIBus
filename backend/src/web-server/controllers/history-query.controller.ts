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
import { CacheMetadata, OIBusContent } from '../../../shared/model/engine.model';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { OIBusValidationError } from '../../model/types';

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

/**
 * @interface HistoryCacheMetadata
 * @description Metadata for cache files
 */
interface HistoryCacheMetadata {
  /** Filename of the metadata */
  metadataFilename: string;
  /** Metadata content */
  metadata: CacheMetadata;
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
    return historyQueries.map(historyQuery => toHistoryQueryLightDTO(historyQuery));
  }

  /**
   * Retrieves a specific history query by its unique identifier
   * @summary Get history query by ID
   * @returns {Promise<HistoryQueryDTO>} The history query object
   */
  @Get('/{historyId}')
  async findById(@Path() historyId: string, @Request() request: CustomExpressRequest): Promise<HistoryQueryDTO> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    return toHistoryQueryDTO(historyQueryService.findById(historyId));
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
    return toHistoryQueryDTO(await historyQueryService.create(command, fromSouth, fromNorth, duplicate));
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
    await historyQueryService.update(historyId, command, resetCache === 'true');
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
  @SuccessResponse(204, 'No Content')
  async testNorth(
    @Path() historyId: string,
    @Query() northType: OIBusNorthType,
    @Query() fromNorth: string | undefined,
    @Body() command: NorthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.testNorth(historyId, northType, fromNorth, command);
  }

  /**
   * Test south connection for a history query
   * @summary Test south connection
   */
  @Post('/{historyId}/test/south')
  @SuccessResponse(204, 'No Content')
  async testSouth(
    @Path() historyId: string,
    @Query() southType: OIBusSouthType,
    @Query() fromSouth: string | undefined,
    @Body() command: SouthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.testSouth(historyId, southType, fromSouth, command);
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
    return await new Promise<OIBusContent>(resolve => {
      historyQueryService.testItem(
        historyId,
        southType,
        itemName,
        fromSouth,
        command.southSettings,
        command.itemSettings,
        command.testingSettings,
        (data: OIBusContent) => {
          resolve(data);
        }
      );
    });
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
    return items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType));
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
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<HistoryQueryItemDTO>> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const historyQuery = historyQueryService.findById(historyId);
    const searchParams: HistoryQueryItemSearchParam = {
      page: page ? parseInt(page.toString(), 10) : 0,
      name: name
    };
    const pageResult = await historyQueryService.searchItems(historyId, searchParams);
    return {
      content: pageResult.content.map(item => toHistoryQueryItemDTO(item, historyQuery.southType)),
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
    return toHistoryQueryItemDTO(historyQueryItem, historyQuery.southType);
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
    const item = await historyQueryService.createItem(historyId, command);
    return toHistoryQueryItemDTO(item, historyQuery.southType);
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
    await historyQueryService.updateItem(historyId, itemId, command);
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
    const items: Array<HistoryQueryItemDTO> = JSON.parse(itemsFile.buffer.toString('utf8'));
    const csv = itemToFlattenedCSV(items, delimiter);
    request.res!.attachment('items.csv');
    request.res!.contentType('text/csv; charset=utf-8');
    request.res!.status(200).send(csv);
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
      historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType)),
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
    if (!itemsToImportFile || !currentItemsFile) {
      throw new OIBusValidationError('Missing "itemsToImport" or "currentItems"');
    }
    return historyQueryService.checkImportItems(
      southType,
      itemsToImportFile.buffer.toString('utf8'),
      delimiter,
      JSON.parse(currentItemsFile.buffer.toString('utf8')) as Array<HistoryQueryItemDTO>
    );
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
    if (!itemsFile) {
      throw new OIBusValidationError('Missing file "items"');
    }
    const items: Array<HistoryQueryItemCommandDTO> = JSON.parse(itemsFile.buffer.toString('utf8'));
    await historyQueryService.importItems(historyId, items);
  }

  /**
   * Adds or updates a transformer configuration for a history query
   * @summary Add/edit transformer
   */
  @Post('/{historyId}/transformers')
  @SuccessResponse(204, 'No Content')
  async addOrEditTransformer(
    @Path() historyId: string,
    @Body() command: TransformerDTOWithOptions,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.addOrEditTransformer(historyId, command);
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
   * @summary Search cache content
   * @returns {Promise<Array<HistoryCacheMetadata>>} Array of cache file metadata
   */
  @Get('/{historyId}/cache/search')
  async searchCacheContent(
    @Path() historyId: string,
    @Query() nameContains: string | undefined,
    @Query() start: string | undefined,
    @Query() end: string | undefined,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<Array<HistoryCacheMetadata>> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    return await historyQueryService.searchCacheContent(historyId, { start, end, nameContains }, folder);
  }

  /**
   * Downloads a specific file from the history query cache
   * @summary Download cache file
   * @responseHeader Content-Disposition attachment; filename="{filename}"
   */
  @Get('/{historyId}/cache/content/{filename}')
  async getCacheFileContent(
    @Path() historyId: string,
    @Path() filename: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    const fileStream = await historyQueryService.getCacheFileContent(historyId, folder, filename);
    request.res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fileStream.pipe(request.res!);
  }

  /**
   * Removes specific files from the history query cache
   * @summary Remove cache files
   */
  @Post('/{historyId}/cache/remove')
  @SuccessResponse(204, 'No Content')
  async removeCacheContent(
    @Path() historyId: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Body() filenames: Array<string>,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.removeCacheContent(historyId, folder, filenames);
  }

  /**
   * Removes all files from the history query cache
   * @summary Remove all cache files
   */
  @Post('/{historyId}/cache/remove-all')
  @SuccessResponse(204, 'No Content')
  async removeAllCacheContent(
    @Path() historyId: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.removeAllCacheContent(historyId, folder);
  }

  /**
   * Moves specific files between folders in the history query cache
   * @summary Move cache files
   */
  @Post('/{historyId}/cache/move')
  @SuccessResponse(204, 'No Content')
  async moveCacheContent(
    @Path() historyId: string,
    @Query() originFolder: 'cache' | 'archive' | 'error',
    @Query() destinationFolder: 'cache' | 'archive' | 'error',
    @Body() filenames: Array<string>,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.moveCacheContent(historyId, originFolder, destinationFolder, filenames);
  }

  /**
   * Moves all files between folders in the history query cache
   * @summary Move all cache files
   */
  @Post('/{historyId}/cache/move-all')
  @SuccessResponse(204, 'No Content')
  async moveAllCacheContent(
    @Path() historyId: string,
    @Query() originFolder: 'cache' | 'archive' | 'error',
    @Query() destinationFolder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const historyQueryService = request.services.historyQueryService as HistoryQueryService;
    await historyQueryService.moveAllCacheContent(historyId, originFolder, destinationFolder);
  }
}
