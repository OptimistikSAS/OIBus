import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  OIBusNorthCategory,
  OIBusNorthType
} from '../../../shared/model/north-connector.model';
import { CustomExpressRequest } from '../express';
import NorthService, { toNorthConnectorDTO, toNorthConnectorLightDTO } from '../../service/north.service';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import {
  CacheContentUpdateCommand,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  OIBusConnectionTestResult
} from '../../../shared/model/engine.model';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import OIBusService from '../../service/oibus.service';
import { OIBusTestingError } from '../../model/types';
import { NorthTransformerWithOptions } from '../../model/transformer.model';

/**
 * @interface NorthConnectorType
 * @description North connector type information
 */
interface NorthConnectorType {
  /** North connector type ID */
  id: OIBusNorthType;
  /** Category of the north connector */
  category: OIBusNorthCategory;
  /** Supported types */
  types: Array<string>;
}

@Route('/api/north')
@Tags('North Connectors')
/**
 * @class NorthConnectorController
 * @description Endpoints for managing north connectors, transformers, and cache operations
 */
export class NorthConnectorController extends Controller {
  /**
   * Retrieves a list of all available north connector types
   * @summary List all north connector types
   * @returns {Array<NorthConnectorType>} Array of north connector type objects
   */
  @Get('/types')
  listManifest(@Request() request: CustomExpressRequest): Array<NorthConnectorType> {
    const northService = request.services.northService as NorthService;
    return northService.listManifest().map(manifest => ({
      id: manifest.id,
      category: manifest.category,
      types: manifest.types
    }));
  }

  /**
   * Retrieves a specific north connector manifest by its type
   * @summary Get north connector manifest
   * @returns {NorthConnectorManifest} The north connector manifest
   */
  @Get('/manifests/{type}')
  getManifest(@Path() type: string, @Request() request: CustomExpressRequest): NorthConnectorManifest {
    const northService = request.services.northService as NorthService;
    return northService.getManifest(type);
  }

  /**
   * Retrieves a list of all configured north connectors
   * @summary List all north connectors
   * @returns {Array<NorthConnectorLightDTO>} Array of north connector objects
   */
  @Get('/')
  list(@Request() request: CustomExpressRequest): Array<NorthConnectorLightDTO> {
    const northService = request.services.northService as NorthService;
    const northConnectors = northService.list();
    return northConnectors.map(connector => toNorthConnectorLightDTO(connector));
  }

  /**
   * Retrieves a specific north connector by its unique identifier
   * @summary Get north connector by ID
   * @returns {NorthConnectorDTO} The north connector object
   */
  @Get('/{northId}')
  findById(@Path() northId: string, @Request() request: CustomExpressRequest): NorthConnectorDTO {
    const northService = request.services.northService as NorthService;
    return toNorthConnectorDTO(northService.findById(northId));
  }

  /**
   * Creates a new north connector with the provided configuration
   * @summary Create north connector
   * @returns {Promise<NorthConnectorDTO>} The created north connector
   */
  @Post('/')
  @SuccessResponse(201, 'Created')
  async create(
    @Body() command: NorthConnectorCommandDTO,
    @Query() duplicate: string | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<NorthConnectorDTO> {
    const northService = request.services.northService as NorthService;
    return toNorthConnectorDTO(await northService.create(command, duplicate || null, request.user.id));
  }

  /**
   * Updates an existing north connector configuration
   * @summary Update north connector
   */
  @Put('/{northId}')
  @SuccessResponse(204, 'No Content')
  async update(
    @Path() northId: string,
    @Body() command: NorthConnectorCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.update(northId, command, request.user.id);
  }

  /**
   * Deletes a north connector by its ID
   * @summary Delete north connector
   */
  @Delete('/{northId}')
  @SuccessResponse(204, 'No Content')
  async delete(@Path() northId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.delete(northId);
  }

  /**
   * Starts a north connector
   * @summary Start north connector
   */
  @Post('/{northId}/start')
  @SuccessResponse(204, 'No Content')
  async start(@Path() northId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.start(northId);
  }

  /**
   * Stops a north connector
   * @summary Stop north connector
   */
  @Post('/{northId}/stop')
  @SuccessResponse(204, 'No Content')
  async stop(@Path() northId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.stop(northId);
  }

  /**
   * Resets all metrics for a north connector
   * @summary Reset north connector metrics
   */
  @Post('/{northId}/metrics/reset')
  @SuccessResponse(204, 'No Content')
  async resetMetrics(@Path() northId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const oIBusService = request.services.oIBusService as OIBusService;
    await oIBusService.resetNorthMetrics(northId);
  }

  /**
   * Tests the connection for a north connector
   * @summary Test north connection
   */
  @Post('/{northId}/test/connection')
  async testNorth(
    @Path() northId: string,
    @Query() northType: OIBusNorthType,
    @Body() command: NorthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<OIBusConnectionTestResult> {
    const northService = request.services.northService as NorthService;
    try {
      return await northService.testNorth(northId, northType, command);
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Adds or updates a transformer configuration for a north connector
   * @summary Add/edit transformer
   */
  @Post('/{northId}/transformers')
  @SuccessResponse(204, 'No Content')
  async addOrEditTransformer(
    @Path() northId: string,
    @Body() command: TransformerDTOWithOptions,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    northService.addOrEditTransformer(northId, command as NorthTransformerWithOptions);
  }

  /**
   * Remove a transformer from a north connector
   * @summary Remove transformer
   */
  @Delete('/{northId}/transformers/{transformerId}')
  @SuccessResponse(204, 'No Content')
  async removeTransformer(@Path() northId: string, @Path() transformerId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    northService.removeTransformer(northId, transformerId);
  }

  /**
   * Searches for files in the north connector cache
   * @summary Search files in cache, error and archive folders
   * @returns {Promise<CacheSearchResult>} The cache search result
   */
  @Get('/{northId}/cache/search')
  async searchCacheContent(
    @Path() northId: string,
    @Query() nameContains: string | undefined,
    @Query() start: string | undefined,
    @Query() end: string | undefined,
    @Query() maxNumberOfFilesReturned: number | undefined,
    @Request() request: CustomExpressRequest
  ): Promise<CacheSearchResult> {
    const engineService = request.services.oIBusService as OIBusService;
    return await engineService.searchCacheContent('north', northId, {
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
  @Get('/{northId}/cache/content/{filename}')
  async getCacheFileContent(
    @Path() northId: string,
    @Path() filename: string,
    @Query() folder: DataFolderType,
    @Request() request: CustomExpressRequest
  ): Promise<FileCacheContent> {
    const engineService = request.services.oIBusService as OIBusService;
    return await engineService.getFileFromCache('north', northId, folder, filename);
  }

  /**
   * Update cache content by moving or removing files from cache, archive and error folders
   * @summary Move or remove files from cache, error and archive folders
   */
  @Post('/{northId}/cache/update')
  @SuccessResponse(204, 'No Content')
  async updateCacheContent(
    @Path() northId: string,
    @Body() updateCommand: CacheContentUpdateCommand,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const engineService = request.services.oIBusService as OIBusService;
    await engineService.updateCacheContent('north', northId, updateCommand);
  }
}
