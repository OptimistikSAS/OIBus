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
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorItemTestingSettings,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthType
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { CustomExpressRequest } from '../express';
import SouthService, { toSouthConnectorDTO, toSouthConnectorItemDTO, toSouthConnectorLightDTO } from '../../service/south.service';
import { itemToFlattenedCSV } from '../../service/utils';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import ScanModeService from '../../service/scan-mode.service';
import { OIBusContent } from '../../../shared/model/engine.model';
import { OIBusValidationError } from '../../model/types';

/**
 * @interface SouthItemTestRequest
 * @description Request body for testing south connector items
 */
interface SouthItemTestRequest {
  /** South connector settings */
  southSettings: SouthSettings;
  /** Item-specific settings */
  itemSettings: SouthItemSettings;
  /** Testing settings including time range */
  testingSettings: SouthConnectorItemTestingSettings;
}

/**
 * @interface SouthCsvImportResponse
 * @description Response for CSV import check operation
 */
interface SouthCsvImportResponse {
  /** Array of valid items that can be imported */
  items: Array<SouthConnectorItemDTO>;
  /** Array of items with errors */
  errors: Array<{ item: Record<string, string>; error: string }>;
}

/**
 * @interface SouthCsvDelimiterRequest
 * @description Request body for CSV delimiter specification
 */
interface SouthCsvDelimiterRequest {
  /** CSV delimiter character */
  delimiter: string;
}

@Route('/api/south')
@Tags('South Connectors')
/**
 * @class SouthConnectorController
 * @description Endpoints for managing south connectors, items, and related operations
 */
export class SouthConnectorController extends Controller {
  /**
   * Retrieves a list of all available south connector types
   * @summary List all south connector types
   * @returns {Promise<Array<SouthType>>} Array of south connector type objects
   */
  @Get('/types')
  async listManifest(@Request() request: CustomExpressRequest): Promise<Array<SouthType>> {
    const southService = request.services.southService as SouthService;
    return southService.listManifest().map(manifest => ({
      id: manifest.id,
      category: manifest.category,
      modes: manifest.modes
    }));
  }

  /**
   * Retrieves a specific south connector manifest by its type
   * @summary Get south connector manifest
   * @returns {Promise<SouthConnectorManifest>} The south connector manifest
   */
  @Get('/manifests/{type}')
  async getManifest(@Path() type: OIBusSouthType, @Request() request: CustomExpressRequest): Promise<SouthConnectorManifest> {
    const southService = request.services.southService as SouthService;
    return southService.getManifest(type);
  }

  /**
   * Retrieves a list of all configured south connectors
   * @summary List all south connectors
   * @returns {Promise<Array<SouthConnectorLightDTO>>} Array of south connector objects
   */
  @Get('/')
  async list(@Request() request: CustomExpressRequest): Promise<Array<SouthConnectorLightDTO>> {
    const southService = request.services.southService as SouthService;
    const southConnectors = southService.list();
    return southConnectors.map(connector => toSouthConnectorLightDTO(connector));
  }

  /**
   * Retrieves a specific south connector by its unique identifier
   * @summary Get south connector by ID
   * @returns {Promise<SouthConnectorDTO>} The south connector object
   */
  @Get('/{southId}')
  async findById(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<SouthConnectorDTO> {
    const southService = request.services.southService as SouthService;
    return toSouthConnectorDTO(southService.findById(southId));
  }

  /**
   * Creates a new south connector with the provided configuration
   * @summary Create south connector
   * @returns {Promise<SouthConnectorDTO>} The created south connector
   */
  @Post('/')
  @SuccessResponse(201, 'Created')
  async create(
    @Body() command: SouthConnectorCommandDTO,
    @Query() duplicate: string | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<SouthConnectorDTO> {
    const southService = request.services.southService as SouthService;
    return toSouthConnectorDTO(await southService.create(command, duplicate || null));
  }

  /**
   * Updates an existing south connector configuration
   * @summary Update south connector
   */
  @Put('/{southId}')
  @SuccessResponse(204, 'No Content')
  async update(
    @Path() southId: string,
    @Body() command: SouthConnectorCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.update(southId, command);
  }

  /**
   * Deletes a south connector by its ID
   * @summary Delete south connector
   */
  @Delete('/{southId}')
  @SuccessResponse(204, 'No Content')
  async delete(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.delete(southId);
  }

  /**
   * Start a south connector
   * @summary Start south connector
   */
  @Post('/{southId}/start')
  @SuccessResponse(204, 'No Content')
  async start(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.start(southId);
  }

  /**
   * Stop a south connector
   * @summary Stop south connector
   */
  @Post('/{southId}/stop')
  @SuccessResponse(204, 'No Content')
  async stop(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.stop(southId);
  }

  /**
   * Resets all metrics for a north connector
   * @summary Reset south connector metrics
   */
  @Post('/{southId}/metrics/reset')
  @SuccessResponse(204, 'No Content')
  async resetSouthMetrics(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService;
    await oIBusService.resetSouthMetrics(southId);
  }

  /**
   * Tests the connection for a south connector
   * @summary Test south connection
   */
  @Post('/{southId}/test/connection')
  @SuccessResponse(204, 'No Content')
  async testConnection(
    @Path() southId: string,
    @Query() southType: OIBusSouthType,
    @Body() command: SouthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.testSouth(southId, southType, command);
  }

  /**
   * Test a south connector item
   * @summary Test south connector item
   * @returns {Promise<OIBusContent>} Test results
   */
  @Post('/{southId}/items/test')
  async testItem(
    @Path() southId: string,
    @Query() southType: OIBusSouthType,
    @Query() itemName: string,
    @Body() command: SouthItemTestRequest,
    @Request() request: CustomExpressRequest
  ): Promise<OIBusContent> {
    const southService = request.services.southService as SouthService;
    return await new Promise<OIBusContent>(resolve => {
      southService.testItem(
        southId,
        southType,
        itemName,
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
   * List all items for a south connector
   * @summary List south connector items
   * @returns {Promise<Array<SouthConnectorItemDTO>>} Array of south connector item objects
   */
  @Get('/{southId}/items/list')
  async listItems(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<Array<SouthConnectorItemDTO>> {
    const southService = request.services.southService as SouthService;
    const southConnector = southService.findById(southId);
    const southItems = southService.listItems(southId);
    return southItems.map(item => toSouthConnectorItemDTO(item, southConnector.type));
  }

  /**
   * Searches for items in a south connector with optional filtering
   * @summary Search south connector items
   * @returns {Promise<Page<SouthConnectorItemDTO>>} Paginated list of items
   */
  @Get('/{southId}/items/search')
  async searchItems(
    @Path() southId: string,
    @Query() page: number | undefined,
    @Query() name: string | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<Page<SouthConnectorItemDTO>> {
    const southService = request.services.southService as SouthService;
    const southConnector = southService.findById(southId);
    const searchParams: SouthConnectorItemSearchParam = {
      page: page ? parseInt(page.toString(), 10) : 0,
      name: name
    };
    const pageResult = await southService.searchItems(southId, searchParams);
    return {
      content: pageResult.content.map(item => toSouthConnectorItemDTO(item, southConnector.type)),
      totalElements: pageResult.totalElements,
      size: pageResult.size,
      number: pageResult.number,
      totalPages: pageResult.totalPages
    };
  }

  /**
   * Retrieves a specific item from a south connector
   * @summary Get south connector item
   * @returns {Promise<SouthConnectorItemDTO>} The south connector item
   */
  @Get('/{southId}/items/{itemId}')
  async findItemById(
    @Path() southId: string,
    @Path() itemId: string,
    @Request() request: CustomExpressRequest
  ): Promise<SouthConnectorItemDTO> {
    const southService = request.services.southService as SouthService;
    const southConnector = southService.findById(southId);
    const item = southService.findItemById(southId, itemId);
    return toSouthConnectorItemDTO(item, southConnector.type);
  }

  /**
   * Creates a new item in a south connector
   * @summary Create south connector item
   * @returns {Promise<SouthConnectorItemDTO>} The created item
   */
  @Post('/{southId}/items')
  @SuccessResponse(201, 'Created')
  async createItem(
    @Path() southId: string,
    @Body() command: SouthConnectorItemCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<SouthConnectorItemDTO> {
    const southService = request.services.southService as SouthService;
    const southConnector = southService.findById(southId);
    const item = await southService.createItem(southId, command);
    return toSouthConnectorItemDTO(item, southConnector.type);
  }

  /**
   * Updates an existing item in a south connector
   * @summary Update south connector item
   */
  @Put('/{southId}/items/{itemId}')
  @SuccessResponse(204, 'No Content')
  async updateItem(
    @Path() southId: string,
    @Path() itemId: string,
    @Body() requestBody: SouthConnectorItemCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.updateItem(southId, itemId, requestBody);
  }

  /**
   * Enable a south connector item
   * @summary Enable south connector item
   */
  @Post('/{southId}/items/{itemId}/enable')
  @SuccessResponse(204, 'No Content')
  async enableItem(@Path() southId: string, @Path() itemId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.enableItem(southId, itemId);
  }

  /**
   * Disable a south connector item
   * @summary Disable south connector item
   */
  @Post('/{southId}/items/{itemId}/disable')
  @SuccessResponse(204, 'No Content')
  async disableItem(@Path() southId: string, @Path() itemId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.disableItem(southId, itemId);
  }

  /**
   * Deletes all items from a south connector
   * @summary Delete all south connector items
   */
  @Delete('/{southId}/items')
  @SuccessResponse(204, 'No Content')
  async deleteAllItems(@Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const southService = request.services.southService as SouthService;
    await southService.deleteAllItems(southId);
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
    const items: Array<SouthConnectorItemDTO> = JSON.parse(itemsFile.buffer.toString('utf8')).map((item: Record<string, string>) => {
      item.scanMode = item.scanModeName;
      delete item.scanModeName;
      return item;
    });
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
  @Post('/{southId}/items/export')
  async exportItems(
    @Path() southId: string,
    @Body() command: SouthCsvDelimiterRequest,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const southService = request.services.southService as SouthService;
    const scanModeService = request.services.scanModeService as ScanModeService;
    const southConnector = southService.findById(southId);
    const csv = itemToFlattenedCSV(
      southConnector.items.map(item => toSouthConnectorItemDTO(item, southConnector.type)),
      command.delimiter,
      scanModeService.list()
    );
    request.res!.attachment('items.csv');
    request.res!.contentType('text/csv; charset=utf-8');
    request.res!.status(200).send(csv);
  }

  /**
   * Validates a CSV file before import and checks for conflicts with existing items
   * @summary Check CSV import
   * @returns {Promise<SouthCsvImportResponse>} Import validation results
   */
  @Post('/{southType}/items/import/check')
  async checkImportItems(
    @Path() southType: string,
    @FormField() delimiter: string,
    @UploadedFile('itemsToImport') itemsToImportFile: Express.Multer.File,
    @UploadedFile('currentItems') currentItemsFile: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<SouthCsvImportResponse> {
    const southService = request.services.southService as SouthService;
    if (!itemsToImportFile || !currentItemsFile) {
      throw new OIBusValidationError('Missing "itemsToImport" or "currentItems"');
    }
    return southService.checkImportItems(
      southType,
      itemsToImportFile.buffer.toString('utf8'),
      delimiter,
      JSON.parse(currentItemsFile.buffer.toString('utf8')) as Array<SouthConnectorItemDTO>
    );
  }

  /**
   * Imports items from a CSV file into a history query
   * @summary Import items from CSV
   */
  @Post('/{southId}/items/import')
  @SuccessResponse(204, 'No Content')
  async importItems(
    @Path() southId: string,
    @UploadedFile('items') itemsFile: Express.Multer.File,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const southService = request.services.southService as SouthService;
    if (!itemsFile) {
      throw new OIBusValidationError('Missing file "items"');
    }
    const items: Array<SouthConnectorItemCommandDTO> = JSON.parse(itemsFile.buffer.toString('utf8'));
    await southService.importItems(southId, items);
  }
}
