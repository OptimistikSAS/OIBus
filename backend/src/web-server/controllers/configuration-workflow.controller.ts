import { Body, Controller, Delete, Get, Path, Post, Put, Query, Request, Route, SuccessResponse, Tags } from 'tsoa';
import {
  ConfigurationWorkflowCommandDTO,
  ConfigurationWorkflowDTO,
  WorkflowPreviewResultDTO
} from '../../../shared/model/configuration-workflow.model';
import {
  WorkflowRunDetailDTO,
  WorkflowRunDTO,
  WorkflowRunSearchParam,
  WorkflowRunStatus,
  WorkflowRunTriggerType
} from '../../../shared/model/workflow-run.model';
import { GetUserInfo, Instant, Page } from '../../../shared/model/types';
import { CustomExpressRequest } from '../express';
import { ConfigurationWorkflowEntity } from '../../model/configuration-workflow.model';
import { WorkflowRunEntity } from '../../model/workflow-run.model';
import { toScanModeDTO } from '../../service/scan-mode.service';

export function toConfigurationWorkflowDTO(entity: ConfigurationWorkflowEntity, getUserInfo: GetUserInfo): ConfigurationWorkflowDTO {
  return {
    id: entity.id,
    name: entity.name,
    southId: entity.southId,
    discoveryScope: entity.discoveryScope,
    identityKeyFields: entity.identityKeyFields,
    eligibilityFilter: entity.eligibilityFilter,
    itemFieldMapping: entity.itemFieldMapping,
    pushToOIAnalytics: entity.pushToOIAnalytics,
    scanMode: entity.scanMode ? toScanModeDTO(entity.scanMode, getUserInfo) : null,
    enabled: entity.enabled,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
}

export function toWorkflowRunDTO(entity: WorkflowRunEntity, getUserInfo: GetUserInfo): WorkflowRunDTO {
  return {
    id: entity.id,
    workflowId: entity.workflowId,
    triggerType: entity.triggerType,
    status: entity.status,
    startedAt: entity.startedAt,
    completedAt: entity.completedAt,
    discoveredCount: entity.discoveredCount,
    eligibleCount: entity.eligibleCount,
    createdCount: entity.createdCount,
    updatedCount: entity.updatedCount,
    disabledCount: entity.disabledCount,
    pushedCount: entity.pushedCount,
    error: entity.error,
    triggeredBy: entity.triggeredBy ? getUserInfo(entity.triggeredBy) : null
  };
}

export function toWorkflowRunDetailDTO(entity: WorkflowRunEntity, getUserInfo: GetUserInfo): WorkflowRunDetailDTO {
  return {
    ...toWorkflowRunDTO(entity, getUserInfo),
    entries: entity.entries,
    records: entity.records
  };
}

@Route('/api/south')
@Tags('Configuration Workflows')
/**
 * @class ConfigurationWorkflowController
 * @description Endpoints for managing Configuration Workflows - discovering a south connector's data
 * source and turning what's found into south items and/or remote point metadata, manually or on a
 * schedule. Surfaced in the UI as "Manage sync configuration", next to "Manage groups".
 */
export class ConfigurationWorkflowController extends Controller {
  /**
   * Lists all configuration workflows for a south connector
   * @summary List configuration workflows
   * @returns {Array<ConfigurationWorkflowDTO>} Array of configuration workflow objects
   */
  @Get('/{southId}/workflows')
  list(@Path() southId: string, @Request() request: CustomExpressRequest): Array<ConfigurationWorkflowDTO> {
    return request.services.configurationWorkflowService
      .findBySouthId(southId)
      .map(workflow => toConfigurationWorkflowDTO(workflow, id => request.services.userService.getUserInfo(id)));
  }

  /**
   * Gets a specific configuration workflow by id
   * @summary Get configuration workflow
   * @returns {ConfigurationWorkflowDTO} The configuration workflow object
   */
  @Get('/{southId}/workflows/{workflowId}')
  get(@Path() southId: string, @Path() workflowId: string, @Request() request: CustomExpressRequest): ConfigurationWorkflowDTO {
    return toConfigurationWorkflowDTO(request.services.configurationWorkflowService.findById(southId, workflowId), id =>
      request.services.userService.getUserInfo(id)
    );
  }

  /**
   * Creates a new configuration workflow for a south connector
   * @summary Create configuration workflow
   * @returns {ConfigurationWorkflowDTO} The created configuration workflow
   */
  @Post('/{southId}/workflows')
  @SuccessResponse(201, 'Created')
  create(
    @Path() southId: string,
    @Body() command: ConfigurationWorkflowCommandDTO,
    @Request() request: CustomExpressRequest
  ): ConfigurationWorkflowDTO {
    return toConfigurationWorkflowDTO(request.services.configurationWorkflowService.create(southId, command, request.user.id), id =>
      request.services.userService.getUserInfo(id)
    );
  }

  /**
   * Updates an existing configuration workflow
   * @summary Update configuration workflow
   * @returns {ConfigurationWorkflowDTO} The updated configuration workflow
   */
  @Put('/{southId}/workflows/{workflowId}')
  update(
    @Path() southId: string,
    @Path() workflowId: string,
    @Body() command: ConfigurationWorkflowCommandDTO,
    @Request() request: CustomExpressRequest
  ): ConfigurationWorkflowDTO {
    return toConfigurationWorkflowDTO(
      request.services.configurationWorkflowService.update(southId, workflowId, command, request.user.id),
      id => request.services.userService.getUserInfo(id)
    );
  }

  /**
   * Deletes a configuration workflow
   * @summary Delete configuration workflow
   */
  @Delete('/{southId}/workflows/{workflowId}')
  @SuccessResponse(204, 'No Content')
  delete(@Path() southId: string, @Path() workflowId: string, @Request() request: CustomExpressRequest): void {
    request.services.configurationWorkflowService.delete(southId, workflowId, request.user.id);
  }

  /**
   * Runs a configuration workflow now: discovers the south connector's data source, decides which
   * discovered entries warrant a change, and acts on them (creating/updating/orphaning items and/or
   * writing remote point metadata) - on the south connector's live, already-running instance.
   * @summary Run a configuration workflow now
   * @returns {WorkflowRunDTO} The completed (or errored) run
   */
  @Post('/{southId}/workflows/{workflowId}/run')
  async run(@Path() southId: string, @Path() workflowId: string, @Request() request: CustomExpressRequest): Promise<WorkflowRunDTO> {
    const run = await request.services.configurationWorkflowRunService.runNow(southId, workflowId, request.user.id);
    return toWorkflowRunDTO(run, id => request.services.userService.getUserInfo(id));
  }

  /**
   * Dry-runs a configuration workflow: identical discovery and classification as a real run, but
   * nothing is written - no items, no point metadata, no run history entry. Discovery itself is a real
   * round-trip to the data source, so this costs what a real run costs, minus the writes.
   * @summary Preview a configuration workflow's next run
   * @returns {WorkflowPreviewResultDTO} What the next run would find and how it would classify it
   */
  @Post('/{southId}/workflows/{workflowId}/preview')
  preview(
    @Path() southId: string,
    @Path() workflowId: string,
    @Request() request: CustomExpressRequest
  ): Promise<WorkflowPreviewResultDTO> {
    return request.services.configurationWorkflowRunService.preview(southId, workflowId);
  }

  /**
   * Lists a configuration workflow's run history, most recent first, optionally narrowed by any
   * combination of the filters below.
   * @summary List a configuration workflow's run history
   * @param page The zero-based page number to fetch.
   * @param start ISO 8601 lower bound on `startedAt` - omit to not filter by a lower bound.
   * @param end ISO 8601 upper bound on `startedAt` - omit to not filter by an upper bound.
   * @param statuses Comma-separated list of statuses to include (e.g. `COMPLETED,ERRORED`). Valid values: `RUNNING`, `COMPLETED`, `ERRORED`.
   * @param triggerTypes Comma-separated list of trigger types to include (e.g. `manual,scheduled`). Valid values: `manual`, `scheduled`.
   * @returns {Page<WorkflowRunDTO>} Paginated list of runs
   */
  @Get('/{southId}/workflows/{workflowId}/runs')
  listRuns(
    @Path() southId: string,
    @Path() workflowId: string,
    @Request() request: CustomExpressRequest,
    @Query() page = 0,
    @Query() start?: Instant,
    @Query() end?: Instant,
    @Query() statuses?: string,
    @Query() triggerTypes?: string
  ): Page<WorkflowRunDTO> {
    const searchParams: WorkflowRunSearchParam = {
      page,
      start,
      end,
      statuses: statuses ? (statuses.split(',').filter(status => status.trim() !== '') as Array<WorkflowRunStatus>) : [],
      triggerTypes: triggerTypes
        ? (triggerTypes.split(',').filter(triggerType => triggerType.trim() !== '') as Array<WorkflowRunTriggerType>)
        : []
    };
    const result = request.services.configurationWorkflowRunService.findRuns(southId, workflowId, searchParams);
    return {
      content: result.content.map(run => toWorkflowRunDTO(run, id => request.services.userService.getUserInfo(id))),
      totalElements: result.totalElements,
      size: result.size,
      number: result.number,
      totalPages: result.totalPages
    };
  }

  /**
   * Gets one run's full detail, including the full discovered payload behind its summary counts -
   * fetched on demand (not part of the paginated run list, which stays lean) since a heavily-discovered
   * run's payload can be sizeable.
   * @summary Get a configuration workflow run's full detail
   * @returns {WorkflowRunDetailDTO} The run, with its full discovered payload
   */
  @Get('/{southId}/workflows/{workflowId}/runs/{runId}')
  getRun(
    @Path() southId: string,
    @Path() workflowId: string,
    @Path() runId: string,
    @Request() request: CustomExpressRequest
  ): WorkflowRunDetailDTO {
    return toWorkflowRunDetailDTO(request.services.configurationWorkflowRunService.findRunById(southId, workflowId, runId), id =>
      request.services.userService.getUserInfo(id)
    );
  }
}
