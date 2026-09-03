import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ConfigurationWorkflowService } from './configuration-workflow.service';
import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDTO } from '../../../../backend/shared/model/workflow-run.model';
import { toPage } from '../shared/test-utils';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';

const SOUTH_ID = 'southId1';
const WORKFLOW_ID = 'workflowId1';

const workflow: ConfigurationWorkflowDTO = {
  id: WORKFLOW_ID,
  name: 'Reactor discovery',
  southId: SOUTH_ID,
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanMode: null,
  enabled: true,
  createdBy: { id: 'user1', friendlyName: 'User 1' },
  updatedBy: { id: 'user1', friendlyName: 'User 1' },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const command: ConfigurationWorkflowCommandDTO = {
  name: 'Reactor discovery',
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanModeId: null,
  enabled: true
};

const run: WorkflowRunDTO = {
  id: 'runId1',
  workflowId: WORKFLOW_ID,
  triggerType: 'manual',
  status: 'COMPLETED',
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: '2024-01-01T00:00:01.000Z',
  discoveredCount: 1,
  eligibleCount: 1,
  createdCount: 1,
  updatedCount: 0,
  disabledCount: 0,
  pushedCount: 0,
  error: null,
  triggeredBy: 'user1'
};

describe('ConfigurationWorkflowService', () => {
  let http: HttpTestingController;
  let service: ConfigurationWorkflowService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConfigurationWorkflowService);
  });

  afterEach(() => http.verify());

  test('should list workflows for a south connector', () => {
    let result: Array<ConfigurationWorkflowDTO> = [];
    service.list(SOUTH_ID).subscribe(workflows => (result = workflows));

    http.expectOne(`/api/south/${SOUTH_ID}/workflows`).flush([workflow]);

    expect(result).toEqual([workflow]);
  });

  test('should get a workflow by id', () => {
    let result: ConfigurationWorkflowDTO | undefined;
    service.get(SOUTH_ID, WORKFLOW_ID).subscribe(w => (result = w));

    http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`).flush(workflow);

    expect(result).toEqual(workflow);
  });

  test('should create a workflow', () => {
    let result: ConfigurationWorkflowDTO | undefined;
    service.create(SOUTH_ID, command).subscribe(w => (result = w));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(command);
    req.flush(workflow);

    expect(result).toEqual(workflow);
  });

  test('should update a workflow', () => {
    let result: ConfigurationWorkflowDTO | undefined;
    service.update(SOUTH_ID, WORKFLOW_ID, command).subscribe(w => (result = w));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(command);
    req.flush(workflow);

    expect(result).toEqual(workflow);
  });

  test('should delete a workflow', () => {
    let completed = false;
    service.delete(SOUTH_ID, WORKFLOW_ID).subscribe(() => (completed = true));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  test('should run a workflow now', () => {
    let result: WorkflowRunDTO | undefined;
    service.runNow(SOUTH_ID, WORKFLOW_ID).subscribe(r => (result = r));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/run`);
    expect(req.request.method).toBe('POST');
    req.flush(run);

    expect(result).toEqual(run);
  });

  test('should preview a workflow without running it', () => {
    const previewResult = { discoveredCount: 2, eligibleCount: 1, entries: [] };
    let result: unknown;
    service.preview(SOUTH_ID, WORKFLOW_ID).subscribe(r => (result = r));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/preview`);
    expect(req.request.method).toBe('POST');
    req.flush(previewResult);

    expect(result).toEqual(previewResult);
  });

  test('should tell the global error interceptor to skip 400/404 errors on run/preview/delete, since the caller shows its own notification', () => {
    service.runNow(SOUTH_ID, WORKFLOW_ID).subscribe({ error: () => {} });
    service.preview(SOUTH_ID, WORKFLOW_ID).subscribe({ error: () => {} });
    service.delete(SOUTH_ID, WORKFLOW_ID).subscribe({ error: () => {} });

    const requests = [
      http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/run`),
      http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/preview`),
      http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`)
    ];
    for (const req of requests) {
      const shouldIgnore = req.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
      expect(shouldIgnore({ status: 400 } as HttpErrorResponse)).toBe(true);
      expect(shouldIgnore({ status: 404 } as HttpErrorResponse)).toBe(true);
      expect(shouldIgnore({ status: 500 } as HttpErrorResponse)).toBe(false);
      req.flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });
    }
  });

  test('should list run history with the given page', () => {
    const page = toPage([run]);
    let result: unknown;
    service.listRuns(SOUTH_ID, WORKFLOW_ID, 2).subscribe(r => (result = r));

    const req = http.expectOne(`/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/runs?page=2`);
    expect(req.request.method).toBe('GET');
    req.flush(page);

    expect(result).toEqual(page);
  });
});
