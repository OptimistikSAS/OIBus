import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';

import { WorkflowRunHistoryComponent } from './workflow-run-history.component';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject, stubRoute } from '../../../../test/vitest-create-mock';
import { toPage } from '../../../shared/test-utils';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDTO } from '../../../../../../backend/shared/model/workflow-run.model';

const workflow: ConfigurationWorkflowDTO = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: 'southId1',
  targetItemId: null,
  discoveryScope: {},
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanMode: null,
  enabled: true,
  createdAt: '',
  updatedAt: '',
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' }
};

const run: WorkflowRunDTO = {
  id: 'runId1',
  workflowId: 'workflowId1',
  triggerType: 'manual',
  status: 'COMPLETED',
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: '2024-01-01T00:00:01.000Z',
  discoveredCount: 3,
  eligibleCount: 2,
  createdCount: 1,
  updatedCount: 1,
  disabledCount: 0,
  pushedCount: 0,
  error: null,
  triggeredBy: 'user1'
};

describe('WorkflowRunHistoryComponent', () => {
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let router: MockObject<Router>;

  beforeEach(() => {
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    router = createMock(Router);
    configurationWorkflowService.get.mockReturnValue(of(workflow));
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run])));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: stubRoute({ params: { southId: 'southId1', workflowId: 'workflowId1' } }) }
      ]
    });
  });

  test('should load the workflow and its first page of runs', () => {
    const fixture = TestBed.createComponent(WorkflowRunHistoryComponent);
    fixture.detectChanges();

    expect(configurationWorkflowService.get).toHaveBeenCalledWith('southId1', 'workflowId1');
    expect(configurationWorkflowService.listRuns).toHaveBeenCalledWith('southId1', 'workflowId1', 0);
    expect(fixture.componentInstance.runs().content).toEqual([run]);
  });

  test('should render the run history table with the workflow name in the title', async () => {
    const fixture = TestBed.createComponent(WorkflowRunHistoryComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#title')).toHaveTextContent('Run history: Reactor discovery');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Completed');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Manual');
  });

  test('should navigate back to the south connector detail page', () => {
    const fixture = TestBed.createComponent(WorkflowRunHistoryComponent);
    fixture.detectChanges();

    fixture.componentInstance.back();

    expect(router.navigate).toHaveBeenCalledWith(['/south', 'southId1']);
  });
});
