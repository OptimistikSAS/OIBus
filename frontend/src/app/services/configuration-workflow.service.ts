import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { inject, Service } from '@angular/core';
import {
  ConfigurationWorkflowCommandDTO,
  ConfigurationWorkflowDTO,
  WorkflowPreviewResultDTO
} from '../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDTO } from '../../../../backend/shared/model/workflow-run.model';
import { Page } from '../../../../backend/shared/model/types';

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
    return this.http.delete<void>(`/api/south/${southId}/workflows/${workflowId}`);
  }

  /**
   * Run a configuration workflow now, on the south connector's live instance
   */
  runNow(southId: string, workflowId: string): Observable<WorkflowRunDTO> {
    return this.http.post<WorkflowRunDTO>(`/api/south/${southId}/workflows/${workflowId}/run`, null);
  }

  /**
   * Dry-run a configuration workflow: what the next run would find and how it would classify it,
   * without writing anything
   */
  preview(southId: string, workflowId: string): Observable<WorkflowPreviewResultDTO> {
    return this.http.post<WorkflowPreviewResultDTO>(`/api/south/${southId}/workflows/${workflowId}/preview`, null);
  }

  /**
   * Retrieve a configuration workflow's run history, most recent first
   */
  listRuns(southId: string, workflowId: string, page: number): Observable<Page<WorkflowRunDTO>> {
    return this.http.get<Page<WorkflowRunDTO>>(`/api/south/${southId}/workflows/${workflowId}/runs`, { params: { page } });
  }
}
