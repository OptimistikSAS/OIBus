import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import {
  CustomTransformerCommandDTO,
  CustomTransformerDTO,
  TransformerDTO,
  TransformerSearchParam
} from '../../../shared/model/transformer.model';
import { toTransformerDTO } from '../../service/transformer.service';
import { Page } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';

@Route('/api/transformers')
@Tags('Transformers')
/**
 * Transformer Management API
 * @description Endpoints for managing data transformers used to convert data between different formats
 */
export class TransformerController extends Controller {
  /**
   * Searches for transformers with optional filtering by type, input type, and output type
   * @summary Search transformers
   * @returns {Promise<Page<TransformerDTO>>} Paginated list of transformers
   */
  @Get('/search')
  async search(
    @Query() type: 'standard' | 'custom' | undefined,
    @Query() inputType: OIBusDataType | undefined,
    @Query() outputType: OIBusDataType | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Promise<Page<TransformerDTO>> {
    const searchParams: TransformerSearchParam = {
      type,
      inputType,
      outputType,
      page: page ? parseInt(page.toString(), 10) : 0
    };

    const transformerService = request.services.transformerService;
    const result = transformerService.search(searchParams);

    return {
      content: result.content.map(transformer => toTransformerDTO(transformer)),
      totalElements: result.totalElements,
      size: result.size,
      number: result.number,
      totalPages: result.totalPages
    };
  }

  /**
   * Retrieves a complete list of all available transformers
   * @summary List all transformers
   * @returns {Promise<Array<TransformerDTO>>} Array of all transformer objects
   */
  @Get('/list')
  async list(@Request() request: CustomExpressRequest): Promise<Array<TransformerDTO>> {
    const transformerService = request.services.transformerService;
    const result = transformerService.findAll();
    return result.map(element => toTransformerDTO(element));
  }

  /**
   * Retrieves a specific transformer by its unique identifier
   * @summary Get transformer by ID
   * @returns {Promise<TransformerDTO>} The transformer object
   */
  @Get('/{transformerId}')
  async findById(@Path() transformerId: string, @Request() request: CustomExpressRequest): Promise<TransformerDTO> {
    const transformerService = request.services.transformerService;
    return toTransformerDTO(transformerService.findById(transformerId));
  }

  /**
   * Creates a new data transformer with the provided configuration
   * @summary Create transformer
   * @param {CustomTransformerCommandDTO} command.body.required - Transformer configuration
   * @returns {Promise<TransformerDTO>} The created transformer
   */
  @Post('/')
  @SuccessResponse(201, 'Transformer created successfully')
  async create(@Body() command: CustomTransformerCommandDTO, @Request() request: CustomExpressRequest): Promise<CustomTransformerDTO> {
    const transformerService = request.services.transformerService;
    return toTransformerDTO(await transformerService.create(command)) as CustomTransformerDTO;
  }

  /**
   * Updates an existing custom transformer with new configuration
   * @summary Update transformer
   * @param {CustomTransformerCommandDTO} command.body.required - Updated transformer configuration
   */
  @Put('/{transformerId}')
  @SuccessResponse(204, 'Transformer updated successfully')
  async update(
    @Path() transformerId: string,
    @Body() command: CustomTransformerCommandDTO,
    @Request() request: CustomExpressRequest
  ): Promise<void> {
    const transformerService = request.services.transformerService;
    await transformerService.update(transformerId, command);
  }

  /**
   * Deletes a transformer by its unique identifier
   * @summary Delete transformer
   */
  @Delete('/{transformerId}')
  @SuccessResponse(204, 'Transformer deleted successfully')
  async delete(@Path() transformerId: string, @Request() request: CustomExpressRequest): Promise<void> {
    const transformerService = request.services.transformerService;
    await transformerService.delete(transformerId);
  }
}
