import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { WorkflowPreviewResultDTO } from '@oibus/shared/api/configuration-workflow.model';
import { WorkflowRunDetailDTO, WorkflowRunDTO } from '@oibus/shared/api/workflow-run.model';

import { buildWorkflow, buildWorkflowCommand } from '../../test/builders';
import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { toPage } from '../shared/utils/page.utils';
import { ConfigurationWorkflowService } from './configuration-workflow.service';

interface HttpCase {
  name: string;
  call: (service: ConfigurationWorkflowService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

const SOUTH_ID = 'southId1';
const WORKFLOW_ID = 'workflowId1';

const workflow = buildWorkflow(WORKFLOW_ID, 'Reactor discovery', { southId: SOUTH_ID, discoveryScope: { rootNodeId: 'ns=1;s=Root' } });
const command = buildWorkflowCommand(null, 'Reactor discovery', { discoveryScope: { rootNodeId: 'ns=1;s=Root' } });
const southSettings = testData.south.command.settings;

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
  triggeredBy: { id: 'user1', friendlyName: 'User One' }
};
const runDetail: WorkflowRunDetailDTO = { ...run, entries: [], records: [{ nodeId: 'a' }] };
const previewResult: WorkflowPreviewResultDTO = { discoveredCount: 2, eligibleCount: 1, entries: [], records: [] };

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

  test.each<HttpCase>([
    {
      name: 'list the workflows of a south connector',
      call: s => s.list(SOUTH_ID),
      method: 'GET',
      url: `/api/south/${SOUTH_ID}/workflows`,
      body: null,
      response: [workflow]
    },
    {
      name: 'get a workflow by id',
      call: s => s.get(SOUTH_ID, WORKFLOW_ID),
      method: 'GET',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`,
      body: null,
      response: workflow
    },
    {
      name: 'create a workflow',
      call: s => s.create(SOUTH_ID, command),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/workflows`,
      body: command,
      response: workflow
    },
    {
      name: 'update a workflow',
      call: s => s.update(SOUTH_ID, WORKFLOW_ID, command),
      method: 'PUT',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`,
      body: command,
      response: workflow
    },
    {
      name: 'delete a workflow',
      call: s => s.delete(SOUTH_ID, WORKFLOW_ID),
      method: 'DELETE',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`,
      body: null,
      response: null
    },
    {
      name: 'run a workflow now',
      call: s => s.runNow(SOUTH_ID, WORKFLOW_ID),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/run`,
      body: null,
      response: run
    },
    {
      name: 'preview a workflow without running it',
      call: s => s.preview(SOUTH_ID, WORKFLOW_ID),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/preview`,
      body: null,
      response: previewResult
    },
    {
      name: 'preview an unsaved workflow command against the given south settings',
      call: s => s.previewCommand(SOUTH_ID, 'opcua', southSettings, WORKFLOW_ID, command),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/test/workflow-preview?southType=opcua`,
      body: { southSettings, workflowId: WORKFLOW_ID, workflow: command },
      response: previewResult
    },
    {
      name: 'preview a workflow command of a connector being created, with no persisted workflow id',
      call: s => s.previewCommand('create', 'opcua', southSettings, null, command),
      method: 'POST',
      url: '/api/south/create/test/workflow-preview?southType=opcua',
      body: { southSettings, workflowId: null, workflow: command },
      response: previewResult
    },
    {
      name: 'list the run history with the given page',
      call: s => s.listRuns(SOUTH_ID, WORKFLOW_ID, { page: 2, start: undefined, end: undefined, statuses: [], triggerTypes: [] }),
      method: 'GET',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/runs?page=2`,
      body: null,
      response: toPage([run])
    },
    {
      name: 'only send the run search filters that are actually set',
      call: s =>
        s.listRuns(SOUTH_ID, WORKFLOW_ID, {
          page: 0,
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-02T00:00:00.000Z',
          statuses: ['COMPLETED', 'ERRORED'],
          triggerTypes: ['manual']
        }),
      method: 'GET',
      url:
        `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/runs?page=0&start=2024-01-01T00:00:00.000Z` +
        '&end=2024-01-02T00:00:00.000Z&statuses=COMPLETED,ERRORED&triggerTypes=manual',
      body: null,
      response: toPage([run])
    },
    {
      name: "get one run's full detail, including its discovered payload",
      call: s => s.getRun(SOUTH_ID, WORKFLOW_ID, 'runId1'),
      method: 'GET',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/runs/runId1`,
      body: null,
      response: runDetail
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test.each<Omit<HttpCase, 'body' | 'response'>>([
    { name: 'run', call: s => s.runNow(SOUTH_ID, WORKFLOW_ID), method: 'POST', url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/run` },
    {
      name: 'preview',
      call: s => s.preview(SOUTH_ID, WORKFLOW_ID),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}/preview`
    },
    {
      name: 'delete',
      call: s => s.delete(SOUTH_ID, WORKFLOW_ID),
      method: 'DELETE',
      url: `/api/south/${SOUTH_ID}/workflows/${WORKFLOW_ID}`
    },
    {
      name: 'command preview',
      call: s => s.previewCommand(SOUTH_ID, 'opcua', southSettings, null, command),
      method: 'POST',
      url: `/api/south/${SOUTH_ID}/test/workflow-preview?southType=opcua`
    }
  ])(
    'should tell the global error interceptor to skip 400/404 errors on $name, since the caller shows its own notification',
    async ({ call, method, url }) => {
      const result = firstValueFrom(call(service));

      const request: TestRequest = http.expectOne({ method, url });
      const shouldIgnore = request.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
      expect(shouldIgnore(new HttpErrorResponse({ status: 400 }))).toBe(true);
      expect(shouldIgnore(new HttpErrorResponse({ status: 404 }))).toBe(true);
      expect(shouldIgnore(new HttpErrorResponse({ status: 500 }))).toBe(false);
      request.flush({ message: 'boom' }, { status: 400, statusText: 'Bad Request' });

      await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    }
  );
});
