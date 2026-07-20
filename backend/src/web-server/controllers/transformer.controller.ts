import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import {
  CustomTransformerCommandDTO,
  CustomTransformerDTO,
  InputTemplate,
  InputType,
  TransformerDTO,
  TransformerManifest,
  TransformerSearchParam,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../../shared/model/transformer.model';
import { toTransformerDTO } from '../../service/transformer.service';
import { Page } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';
import { SouthConnectorItemTestResult } from '../../../shared/model/south-connector.model';
import { CustomExpressRequest } from '../express';
import TransformerService from '../../service/transformer.service';
import { OIBusTestingError } from '../../model/types';

@Route('/api/transformers')
@Tags('Transformers')
/**
 * Transformer Management API
 * @description Endpoints for managing data transformers used to convert data between different formats
 */
export class TransformerController extends Controller {
  /**
   * Retrieves a list of all available transformer types
   * @summary List all transformer types
   * @returns {Promise<Array<{ id: string; inputType: string; outputType: string }>>} Array of transformer type objects
   */
  @Get('/types')
  listManifest(@Request() request: CustomExpressRequest): Array<{ id: string; inputType: string; outputType: string }> {
    const transformerService = request.services.transformerService as TransformerService;
    return transformerService.listManifest().map(manifest => ({
      id: manifest.id,
      inputType: manifest.inputType,
      outputType: manifest.outputType
    }));
  }

  /**
   * Retrieves a specific transformer manifest by its type
   * @summary Get transformer manifest
   * @returns {Promise<TransformerManifest>} The transformer manifest
   */
  @Get('/manifests/{type}')
  getManifest(@Path() type: string, @Request() request: CustomExpressRequest): TransformerManifest {
    const transformerService = request.services.transformerService as TransformerService;
    return transformerService.getManifest(type);
  }

  /**
   * Searches for transformers with optional filtering by type, input type, and output type
   * @summary Search transformers
   * @returns {Promise<Page<TransformerDTO>>} Paginated list of transformers
   */
  @Get('/search')
  search(
    @Query() type: 'standard' | 'custom' | undefined,
    @Query() inputType: OIBusDataType | undefined,
    @Query() outputType: OIBusDataType | undefined,
    @Query() page = 0,
    @Request() request: CustomExpressRequest
  ): Page<TransformerDTO> {
    const searchParams: TransformerSearchParam = {
      type,
      inputType,
      outputType,
      page: page ? parseInt(page.toString(), 10) : 0
    };

    const transformerService = request.services.transformerService;
    const result = transformerService.search(searchParams);

    return {
      content: result.content.map(transformer => toTransformerDTO(transformer, id => request.services.userService.getUserInfo(id))),
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
  list(@Request() request: CustomExpressRequest): Array<TransformerDTO> {
    const transformerService = request.services.transformerService;
    const result = transformerService.findAll();
    return result.map(element => toTransformerDTO(element, id => request.services.userService.getUserInfo(id)));
  }

  /**
   * Retrieves a specific transformer by its unique identifier
   * @summary Get transformer by ID
   * @returns {Promise<TransformerDTO>} The transformer object
   */
  @Get('/{transformerId}')
  findById(@Path() transformerId: string, @Request() request: CustomExpressRequest): TransformerDTO {
    const transformerService = request.services.transformerService;
    return toTransformerDTO(transformerService.findById(transformerId), id => request.services.userService.getUserInfo(id));
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
    return toTransformerDTO(await transformerService.create(command, request.user.id), id =>
      request.services.userService.getUserInfo(id)
    ) as CustomTransformerDTO;
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
    await transformerService.update(transformerId, command, request.user.id);
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

  /**
   * Runs a custom transformer against the provided input data and returns the transformed output.
   * Use this endpoint to validate transformer logic before saving it.
   * @summary Test a custom transformer
   * @returns {Promise<TransformerTestResponse>} The transformation output and execution metadata
   */
  @Post('/test')
  async test(
    @Body() command: { transformer: CustomTransformerCommandDTO; testRequest: TransformerTestRequest },
    @Request() request: CustomExpressRequest
  ): Promise<TransformerTestResponse> {
    const transformerService = request.services.transformerService;
    try {
      return await transformerService.test(command.transformer, command.testRequest);
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Runs a configured transformer (standard or custom, by id) with the given options against the
   * provided input data, returning both the wrapped input and the transformed output. Used to test a
   * north/history transformer with its configured options.
   * @summary Test a transformer with input data
   * @returns {Promise<SouthConnectorItemTestResult>} The wrapped input and transformed output
   */
  @Post('/{transformerId}/test')
  async testTransformer(
    @Path() transformerId: string,
    @Body() testRequest: TransformerTestRequest,
    @Request() request: CustomExpressRequest
  ): Promise<SouthConnectorItemTestResult> {
    const transformerService = request.services.transformerService;
    try {
      return await transformerService.testTransformer(
        transformerId,
        (testRequest.options as Record<string, unknown>) || {},
        testRequest.inputData
      );
    } catch (error: unknown) {
      throw new OIBusTestingError((error as Error).message);
    }
  }

  /**
   * Returns a sample input payload for the given input type, useful as a starting point when writing or testing a custom transformer.
   * @summary Get input template for a transformer input type
   * @returns {Promise<InputTemplate>} A template object with sample data for the requested input type
   */
  @Get('/template/{inputType}')
  getInputTemplate(@Path() inputType: InputType, @Request() request: CustomExpressRequest): InputTemplate {
    const transformerService = request.services.transformerService;
    return transformerService.generateTemplate(inputType);
  }
}
