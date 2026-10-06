import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { inject, Service } from '@angular/core';

import { Observable } from 'rxjs';

import {
  ConfigurationWorkflowCommandDTO,
  ConfigurationWorkflowDTO,
  WorkflowPreviewResultDTO
} from '@oibus/shared/api/configuration-workflow.model';
import { WorkflowRunDetailDTO, WorkflowRunDTO } from '@oibus/shared/api/workflow-run.model';
import { Page } from '@oibus/shared/common/types';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { WorkflowRunSearchParam } from '@oibus/shared/domain/workflow-run.model';

import { ignoreErrorIfStatusIs } from '../shared/error-interceptor.service';

/**
 * Service used to interact with the backend for CRUD and run operations on Configuration Workflows
 */
@Service()
export class ConfigurationWorkflowService {
  private http = inject(HttpClient);

  /**
   * Get all configuration workflows for a south connector
   */
  list(southId: string): Observable<Array<ConfigurationWorkflowDTO>> {
    return this.http.get<Array<ConfigurationWorkflowDTO>>(`/api/south/${southId}/workflows`);
  }

  /**
   * Get a specific configuration workflow by ID
   */
  get(southId: string, workflowId: string): Observable<ConfigurationWorkflowDTO> {
    return this.http.get<ConfigurationWorkflowDTO>(`/api/south/${southId}/workflows/${workflowId}`);
  }

  /**
   * Create a new configuration workflow
   */
  create(southId: string, command: ConfigurationWorkflowCommandDTO): Observable<ConfigurationWorkflowDTO> {
    return this.http.post<ConfigurationWorkflowDTO>(`/api/south/${southId}/workflows`, command);
  }

  /**
   * Update an existing configuration workflow
   */
  update(southId: string, workflowId: string, command: ConfigurationWorkflowCommandDTO): Observable<ConfigurationWorkflowDTO> {
    return this.http.put<ConfigurationWorkflowDTO>(`/api/south/${southId}/workflows/${workflowId}`, command);
  }

  /**
   * Delete a configuration workflow
   */
  delete(southId: string, workflowId: string): Observable<void> {
    // The caller shows its own tailored error notification for this - ignored here so the global error
    // interceptor doesn't ALSO show a generic one for the same failure (which would double the notification).
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.delete<void>(`/api/south/${southId}/workflows/${workflowId}`, { context });
  }

  /**
   * Run a configuration workflow now, on the south connector's live instance
   */
  runNow(southId: string, workflowId: string): Observable<WorkflowRunDTO> {
    // Same reasoning as delete() above - e.g. "Configuration workflow already running" gets the caller's
    // own tailored notification, not a second generic one from the interceptor.
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<WorkflowRunDTO>(`/api/south/${southId}/workflows/${workflowId}/run`, null, { context });
  }

  /**
   * Dry-run a configuration workflow: what the next run would find and how it would classify it,
   * without writing anything
   */
  preview(southId: string, workflowId: string): Observable<WorkflowPreviewResultDTO> {
    // Same reasoning as delete() above.
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<WorkflowPreviewResultDTO>(`/api/south/${southId}/workflows/${workflowId}/preview`, null, { context });
  }

  /**
   * Dry-run a not-yet-saved configuration workflow (as currently edited) against possibly not-yet-saved
   * south settings - mirrors SouthConnectorService.testDiscoveryQuery: `southId` is the connector id, or
   * `create` for a connector that doesn't exist yet. `workflowId` is the persisted workflow's id when it
   * already exists (its entries are then classified against its previous run), null otherwise (every
   * entry is then `new`).
   */
  previewCommand(
    southId: string,
    southType: OIBusSouthType,
    southSettings: SouthSettings,
    workflowId: string | null,
    command: ConfigurationWorkflowCommandDTO
  ): Observable<WorkflowPreviewResultDTO> {
    // Same reasoning as delete() above - the preview modal shows its own tailored notification.
    const context = ignoreErrorIfStatusIs(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    return this.http.post<WorkflowPreviewResultDTO>(
      `/api/south/${southId}/test/workflow-preview`,
      { southSettings, workflowId, workflow: command },
      { params: { southType }, context }
    );
  }

  /**
   * Retrieve a configuration workflow's run history, most recent first, optionally narrowed by any
   * combination of `searchParams`' filters
   */
  listRuns(southId: string, workflowId: string, searchParams: WorkflowRunSearchParam): Observable<Page<WorkflowRunDTO>> {
    const params: Record<string, string | Array<string>> = { page: `${searchParams.page || 0}` };
    if (searchParams.start) {
      params['start'] = searchParams.start;
    }
    if (searchParams.end) {
      params['end'] = searchParams.end;
    }
    if (searchParams.statuses.length > 0) {
      params['statuses'] = searchParams.statuses.join(',');
    }
    if (searchParams.triggerTypes.length > 0) {
      params['triggerTypes'] = searchParams.triggerTypes.join(',');
    }
    return this.http.get<Page<WorkflowRunDTO>>(`/api/south/${southId}/workflows/${workflowId}/runs`, { params });
  }

  /**
   * Get one run's full detail, including its full discovered payload - fetched on demand since it can
   * be sizeable for a workflow with many discovered records.
   */
  getRun(southId: string, workflowId: string, runId: string): Observable<WorkflowRunDetailDTO> {
    return this.http.get<WorkflowRunDetailDTO>(`/api/south/${southId}/workflows/${workflowId}/runs/${runId}`);
  }
}
