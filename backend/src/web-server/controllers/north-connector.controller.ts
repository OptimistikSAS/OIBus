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
import { CacheMetadata } from '../../../shared/model/engine.model';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import OIBusService from '../../service/oibus.service';

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

/**
 * @interface NorthCacheMetadata
 * @description Metadata for north connector cache files
 */
interface NorthCacheMetadata {
  /** Filename of the metadata */
  metadataFilename: string;
  /** Metadata content */
  metadata: CacheMetadata;
}

@Route('/api/north')
@Tags('North Connectors')
/**
 * @class NorthConnectorController
 * @description Endpoints for managing north connectors, subscriptions, and cache operations
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
    return toNorthConnectorDTO(await northService.create(command, duplicate || null));
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
    await northService.update(northId, command);
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
  @SuccessResponse(204, 'No Content')
  async testNorth(
    @Path() northId: string,
    @Query() northType: OIBusNorthType,
    @Body() command: NorthSettings,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.testNorth(northId, northType, command);
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
    await northService.addOrEditTransformer(northId, command);
  }

  /**
   * Remove a transformer from a north connector
   * @summary Remove transformer
   */
  @Delete('/{northId}/transformers/{transformerId}')
  @SuccessResponse(204, 'No Content')
  async removeTransformer(@Path() northId: string, @Path() transformerId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.removeTransformer(northId, transformerId);
  }

  /**
   * Subscribe to a south connector from a north connector
   * @summary Subscribe to a south connector
   */
  @Post('/{northId}/subscriptions/{southId}')
  @SuccessResponse(204, 'No Content')
  async subscribeToSouth(@Path() northId: string, @Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.subscribeToSouth(northId, southId);
  }

  /**
   * Remove a subscription to a south connector from a north connector
   * @summary Unsubscribe from a south connector
   */
  @Delete('/{northId}/subscriptions/{southId}')
  @SuccessResponse(204, 'No Content')
  async unsubscribeFromSouth(@Path() northId: string, @Path() southId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.unsubscribeFromSouth(northId, southId);
  }

  /**
   * Searches for files in the north connector cache
   * @summary Search cache files
   * @returns {Promise<Array<NorthCacheMetadata>>} Array of cache file metadata
   */
  @Get('/{northId}/cache/search')
  async searchCacheContent(
    @Path() northId: string,
    @Query() nameContains: string | undefined,
    @Query() start: string | undefined,
    @Query() end: string | undefined,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<Array<NorthCacheMetadata>> {
    const northService = request.services.northService as NorthService;
    return await northService.searchCacheContent(northId, { start, end, nameContains }, folder);
  }

  /**
   * Download a cache file from a north connector cache
   * @summary Download cache file
   * @responseHeader Content-Disposition attachment; filename="{filename}"
   */
  @Get('/{northId}/cache/content/{filename}')
  async getCacheFileContent(
    @Path() northId: string,
    @Path() filename: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    const fileStream = await northService.getCacheFileContent(northId, folder, filename);
    request.res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fileStream.pipe(request.res!);
  }

  /**
   * Removes specific files from the north connector cache
   * @summary Remove cache files
   */
  @Delete('/{northId}/cache/remove')
  @SuccessResponse(204, 'No Content')
  async removeCacheContent(
    @Path() northId: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Body() filenames: Array<string>,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.removeCacheContent(northId, folder, filenames);
  }

  /**
   * Removes all files from a north connector cache folder
   * @summary Remove all cache files
   */
  @Delete('/{northId}/cache/remove-all')
  @SuccessResponse(204, 'No Content')
  async removeAllCacheContent(
    @Path() northId: string,
    @Query() folder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.removeAllCacheContent(northId, folder);
  }

  /**
   * Moves specific files between folders in the north connector cache
   * @summary Move cache files
   */
  @Post('/{northId}/cache/move')
  @SuccessResponse(204, 'No Content')
  async moveCacheContent(
    @Path() northId: string,
    @Query() originFolder: 'cache' | 'archive' | 'error',
    @Query() destinationFolder: 'cache' | 'archive' | 'error',
    @Body() filenames: Array<string>,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.moveCacheContent(northId, originFolder, destinationFolder, filenames);
  }

  /**
   * Moves all files between folders in the north connector cache
   * @summary Move all cache files
   */
  @Post('/{northId}/cache/move-all')
  @SuccessResponse(204, 'No Content')
  async moveAllCacheContent(
    @Path() northId: string,
    @Query() originFolder: 'cache' | 'archive' | 'error',
    @Query() destinationFolder: 'cache' | 'archive' | 'error',
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const northService = request.services.northService as NorthService;
    await northService.moveAllCacheContent(northId, originFolder, destinationFolder);
  }
}
