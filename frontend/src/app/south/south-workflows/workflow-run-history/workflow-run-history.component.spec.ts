import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { WorkflowRunDTO } from '@oibus/shared/api/workflow-run.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { buildWorkflow } from '../../../../test/builders';
import { createMock, MockObject, stubRoute } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { provideCurrentUser } from '../../../shared/current-user-testing';
import { provideNgbConfigTesting } from '../../../shared/form/oi-ngb-testing';
import { MockModalService, provideModalTesting } from '../../../shared/mock-modal.service.testing';
import { toPage } from '../../../shared/utils/page.utils';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';
import { WorkflowRunHistoryComponent } from './workflow-run-history.component';

const workflow = buildWorkflow('workflowId1', 'Reactor discovery');

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
  triggeredBy: { id: 'user1', friendlyName: 'User One' }
};

const noFilters = { start: undefined, end: undefined, statuses: [], triggerTypes: [] };

class WorkflowRunHistoryComponentTester {
  readonly fixture = TestBed.createComponent(WorkflowRunHistoryComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 1 });
  readonly headers = this.root.getByCss('thead th');
  readonly rows = this.root.getByCss('tbody tr');
  readonly end = this.root.getByCss('#run-search-end');
  readonly searchButton = this.root.getByRole('button', { name: 'Search' });
  readonly clearStatusesButton = this.root.getByCss('#clear-statuses-button');
  readonly clearTriggerTypesButton = this.root.getByCss('#clear-trigger-types-button');
  readonly empty = this.root.getByCss('.empty');

  chip(label: string) {
    return this.root.getByRole('button', { name: label, exact: true });
  }

  cell(row: number, column: number) {
    return this.rows.nth(row).getByRole('cell').nth(column);
  }
}

describe('WorkflowRunHistoryComponent', () => {
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let router: MockObject<Router>;

  function createTester(queryParams: Params = {}) {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: stubRoute({ params: { southId: 'southId1', workflowId: 'workflowId1' }, queryParams })
    });
    return new WorkflowRunHistoryComponentTester();
  }

  beforeEach(() => {
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    router = createMock(Router);
    configurationWorkflowService.get.mockReturnValue(of(workflow));
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run])));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideCurrentUser(),
        provideNgbConfigTesting(),
        provideModalTesting(),
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: stubRoute() }
      ]
    });
  });

  test('should load the workflow and display its first page of runs', async () => {
    const tester = createTester();

    await expect.element(tester.title).toHaveTextContent('Run history: Reactor discovery');
    await expect.element(tester.rows).toHaveLength(1);
    await expect.element(tester.headers.nth(0)).toHaveTextContent('Status');
    await expect.element(tester.headers.nth(5)).toHaveTextContent('Discovered');
    await expect.element(tester.cell(0, 0)).toHaveTextContent('Completed');
    await expect.element(tester.cell(0, 1)).toHaveTextContent('Manual');
    await expect.element(tester.cell(0, 4)).toHaveTextContent('User One');
    await expect.element(tester.cell(0, 5)).toHaveTextContent('3');
    expect(configurationWorkflowService.get).toHaveBeenCalledWith('southId1', 'workflowId1');
    expect(configurationWorkflowService.listRuns).toHaveBeenCalledWith('southId1', 'workflowId1', { ...noFilters, page: 0 });
  });

  test('should read the current filters from the URL, both into the form and into the search request', async () => {
    const tester = createTester({
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
      statuses: ['COMPLETED', 'ERRORED'],
      triggerTypes: ['manual'],
      page: '1'
    });

    await expect.element(tester.chip('Completed')).toHaveClass('active');
    await expect.element(tester.chip('Errored')).toHaveClass('active');
    await expect.element(tester.chip('Running')).toHaveClass('inactive');
    await expect.element(tester.chip('Manual')).toHaveClass('active');
    await expect.element(tester.chip('Scheduled')).toHaveClass('inactive');
    expect(configurationWorkflowService.listRuns).toHaveBeenCalledWith('southId1', 'workflowId1', {
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
      statuses: ['COMPLETED', 'ERRORED'],
      triggerTypes: ['manual'],
      page: 1
    });
  });

  test('should show a dash when a scheduled run has no triggering user', async () => {
    configurationWorkflowService.listRuns.mockReturnValue(
      of(toPage<WorkflowRunDTO>([{ ...run, triggerType: 'scheduled', triggeredBy: null }]))
    );
    const tester = createTester();

    await expect.element(tester.cell(0, 1)).toHaveTextContent('Scheduled');
    await expect.element(tester.cell(0, 4)).toHaveTextContent('-');
  });

  test('should show "Ø" for a run with no error, and the actual message (in red) for one that errored', async () => {
    const erroredRun: WorkflowRunDTO = { ...run, id: 'runId2', status: 'ERRORED', error: 'connection lost' };
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run, erroredRun])));
    const tester = createTester();

    await expect.element(tester.cell(0, 6)).toHaveTextContent('Ø');
    await expect.element(tester.cell(0, 6)).not.toHaveClass('text-danger');
    await expect.element(tester.cell(1, 0)).toHaveTextContent('Errored');
    await expect.element(tester.cell(1, 6)).toHaveTextContent('connection lost');
    await expect.element(tester.cell(1, 6)).toHaveClass('text-danger');
  });

  test('should give each status filter chip a distinct icon (not just a color), for colorblind users', async () => {
    const tester = createTester();

    await expect.element(tester.chip('Running').getByCss('i')).toHaveClass('fa-spinner');
    await expect.element(tester.chip('Completed').getByCss('i')).toHaveClass('fa-check-circle');
    await expect.element(tester.chip('Errored').getByCss('i')).toHaveClass('fa-times-circle');
  });

  test('should show a "view payload" action for a completed run, but not a still-running one', async () => {
    const runningRun: WorkflowRunDTO = { ...run, id: 'runId2', status: 'RUNNING', completedAt: null };
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run, runningRun])));
    const tester = createTester();

    await expect.element(tester.rows).toHaveLength(2);
    await expect.element(tester.rows.nth(0).getByRole('button', { name: 'View payload' })).toBeVisible();
    await expect.element(tester.rows.nth(1).getByRole('button', { name: 'View payload' })).not.toBeInTheDocument();
  });

  test('should open the payload modal, letting it fetch the run payload itself', async () => {
    const tester = createTester();
    const modalService: MockModalService<PreviewWorkflowModalComponent> = TestBed.inject(MockModalService);
    const previewModal = createMock(PreviewWorkflowModalComponent);
    modalService.mockClosedModal(previewModal);
    const open = vi.spyOn(modalService, 'open');
    await expect.element(tester.title).toHaveTextContent('Run history: Reactor discovery');

    await tester.rows.nth(0).getByRole('button', { name: 'View payload' }).click();

    expect(open).toHaveBeenCalledWith(PreviewWorkflowModalComponent, { size: 'xl' });
    expect(previewModal.prepareForRunPayload).toHaveBeenCalledWith('southId1', 'workflowId1', 'runId1', 'Reactor discovery');
    expect(configurationWorkflowService.getRun).not.toHaveBeenCalled();
  });

  test('should toggle a status filter and immediately apply the search', async () => {
    const tester = createTester();

    await tester.chip('Errored').click();

    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { start: null, end: null, statuses: ['ERRORED'], triggerTypes: [], page: 0 }
    });
    await expect.element(tester.chip('Errored')).toHaveClass('active');
    await expect.element(tester.chip('Completed')).toHaveClass('inactive');

    // Clicking the same status again clears it
    await tester.chip('Errored').click();
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: [], page: 0 }
    });
    await expect.element(tester.chip('Completed')).not.toHaveClass('inactive');
  });

  test('should clear all active status filters and immediately apply the search', async () => {
    const tester = createTester({ statuses: ['COMPLETED', 'ERRORED'] });

    await tester.clearStatusesButton.click();

    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: [], page: 0 }
    });
    await expect.element(tester.clearStatusesButton).not.toBeInTheDocument();
  });

  test('should toggle a trigger-type filter and immediately apply the search', async () => {
    const tester = createTester();

    await tester.chip('Scheduled').click();

    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: ['scheduled'], page: 0 }
    });
    await expect.element(tester.chip('Manual')).toHaveClass('inactive');
  });

  test('should clear all active trigger-type filters and immediately apply the search', async () => {
    const tester = createTester({ triggerTypes: ['manual'] });

    await tester.clearTriggerTypesButton.click();

    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: [], page: 0 }
    });
    await expect.element(tester.clearTriggerTypesButton).not.toBeInTheDocument();
  });

  test('should apply the search with the dates of the form', async () => {
    const tester = createTester({ start: '2024-01-01T00:00:00.000Z' });

    await tester.searchButton.click();

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { start: '2024-01-01T00:00:00.000Z', end: null, statuses: [], triggerTypes: [], page: 0 }
    });
  });

  test('should not apply the search when the date range is invalid (end before start)', async () => {
    const tester = createTester({ start: '2024-01-10T00:00:00.000Z' });

    await tester.end.fillWithDate('05/01/2024', '10', '00');
    await tester.searchButton.click();

    await tester.fixture.whenStable();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  test('should show "no runs yet" when there are no runs and no filters are active', async () => {
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([])));
    const tester = createTester();

    await expect.element(tester.empty).toHaveTextContent('No runs yet');
    await expect.element(tester.rows).toHaveLength(0);
  });

  test('should show "no runs match the current filters" when a filter is active and nothing matches', async () => {
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([])));
    const tester = createTester({ statuses: ['ERRORED'] });

    await expect.element(tester.empty).toHaveTextContent('No runs match the current filters');
  });
});
