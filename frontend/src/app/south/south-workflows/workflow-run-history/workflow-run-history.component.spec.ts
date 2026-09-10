import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ActivatedRoute, Router } from '@angular/router';

import { WorkflowRunHistoryComponent } from './workflow-run-history.component';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ModalService } from '../../../shared/modal.service';
import { NotificationService } from '../../../shared/notification.service';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject, stubRoute } from '../../../../test/vitest-create-mock';
import { toPage } from '../../../shared/test-utils';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO, WorkflowRunDTO } from '../../../../../../backend/shared/model/workflow-run.model';

const workflow: ConfigurationWorkflowDTO = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: 'southId1',
  pushToOIAnalytics: false,
  discoveryScope: {},
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
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
  triggeredBy: { id: 'user1', friendlyName: 'User One' }
};

const noFilters = { start: undefined, end: undefined, statuses: [], triggerTypes: [] };

describe('WorkflowRunHistoryComponent', () => {
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let router: MockObject<Router>;
  let modalService: MockObject<ModalService>;
  let notificationService: MockObject<NotificationService>;

  function createComponent(queryParams: Record<string, unknown> = {}) {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: stubRoute({ params: { southId: 'southId1', workflowId: 'workflowId1' }, queryParams })
    });
    const fixture = TestBed.createComponent(WorkflowRunHistoryComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    router = createMock(Router);
    modalService = createMock(ModalService);
    notificationService = createMock(NotificationService);
    configurationWorkflowService.get.mockReturnValue(of(workflow));
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run])));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: Router, useValue: router },
        { provide: ModalService, useValue: modalService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ActivatedRoute, useValue: stubRoute({ params: { southId: 'southId1', workflowId: 'workflowId1' } }) }
      ]
    });
  });

  test('should load the workflow and its first page of runs with no filters', () => {
    const fixture = createComponent();

    expect(configurationWorkflowService.get).toHaveBeenCalledWith('southId1', 'workflowId1');
    expect(configurationWorkflowService.listRuns).toHaveBeenCalledWith('southId1', 'workflowId1', { ...noFilters, page: 0 });
    expect(fixture.componentInstance.runs().content).toEqual([run]);
  });

  test('should read the current filters from the URL, both into the form and into the search request', () => {
    createComponent({
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
      statuses: ['COMPLETED', 'ERRORED'],
      triggerTypes: ['manual'],
      page: '1'
    });

    expect(configurationWorkflowService.listRuns).toHaveBeenCalledWith('southId1', 'workflowId1', {
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z',
      statuses: ['COMPLETED', 'ERRORED'],
      triggerTypes: ['manual'],
      page: 1
    });
  });

  test('should render the run history table with the workflow name in the title', async () => {
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#title')).toHaveTextContent('Run history: Reactor discovery');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Completed');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Manual');
  });

  test("should show the triggering user's friendly name, not their raw id", async () => {
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toHaveTextContent('User One');
  });

  test('should show a dash when a scheduled run has no triggering user', async () => {
    const scheduledRun: WorkflowRunDTO = { ...run, triggerType: 'scheduled', triggeredBy: null };
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([scheduledRun])));
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toHaveTextContent('-');
  });

  test('should show only the discovered count in the table - the rest lives in the payload modal', async () => {
    const fixture = createComponent();

    const root = page.elementLocator(fixture.nativeElement);
    const discoveredHeader = fixture.nativeElement.querySelectorAll('thead th')[5];
    expect(discoveredHeader.textContent.trim()).toBe('Discovered');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('3');
    expect(fixture.nativeElement.querySelector('tbody').textContent).not.toContain('3 / 2');
  });

  test('should show a plain "Status" label on the table header, not the raw status enum', () => {
    const fixture = createComponent();

    const statusHeader = fixture.nativeElement.querySelectorAll('thead th')[0];
    expect(statusHeader.textContent.trim()).toBe('Status');
  });

  test('should give each status filter chip a distinct icon (not just a color), for colorblind users', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance.getStatusIconClass('RUNNING')).toContain('fa-spinner');
    expect(fixture.componentInstance.getStatusIconClass('COMPLETED')).toContain('fa-check-circle');
    expect(fixture.componentInstance.getStatusIconClass('ERRORED')).toContain('fa-times-circle');
    // Every icon class is distinct - no two statuses share the same shape.
    const iconClasses = ['RUNNING', 'COMPLETED', 'ERRORED'].map(status => fixture.componentInstance.getStatusIconClass(status as never));
    expect(new Set(iconClasses).size).toBe(3);
    expect(fixture.nativeElement.querySelector('.status-dot')).toBeNull();
  });

  test('should show a "view payload" action for a completed/errored run, but not a still-running one', () => {
    const runningRun: WorkflowRunDTO = { ...run, id: 'runId2', status: 'RUNNING', completedAt: null };
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run, runningRun])));
    const fixture = createComponent();

    expect(fixture.nativeElement.querySelectorAll('.view-payload').length).toBe(1);
  });

  test("should fetch and show one run's full payload in a large modal, labeled for a past run", () => {
    const detail: WorkflowRunDetailDTO = { ...run, entries: [], records: [{ nodeId: 'a' }] };
    configurationWorkflowService.getRun.mockReturnValue(of(detail));
    const previewModalInstance = { prepare: vi.fn() };
    modalService.open.mockReturnValue({ componentInstance: previewModalInstance } as never);
    const fixture = createComponent();

    fixture.componentInstance.onViewPayload(run);

    expect(modalService.open).toHaveBeenCalledWith(expect.anything(), { size: 'xl' });
    expect(configurationWorkflowService.getRun).toHaveBeenCalledWith('southId1', 'workflowId1', 'runId1');
    expect(previewModalInstance.prepare).toHaveBeenCalledWith('Reactor discovery', detail, 'run-payload');
  });

  test("should show an error notification when fetching a run's payload fails", () => {
    configurationWorkflowService.getRun.mockReturnValue(throwError(() => ({ error: { message: 'not found' } })));
    const fixture = createComponent();

    fixture.componentInstance.onViewPayload(run);

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-payload-error', { error: 'not found' });
  });

  test('should toggle a status filter and immediately apply the search', () => {
    const fixture = createComponent();

    fixture.componentInstance.toggleStatus('ERRORED');

    expect(fixture.componentInstance.searchForm.controls.statuses.value).toEqual(['ERRORED']);
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { start: null, end: null, statuses: ['ERRORED'], triggerTypes: [], page: 0 }
    });

    // Clicking the same status again clears it
    fixture.componentInstance.toggleStatus('ERRORED');
    expect(fixture.componentInstance.searchForm.controls.statuses.value).toEqual([]);
  });

  test('should clear all active status filters and immediately apply the search', () => {
    const fixture = createComponent({ statuses: ['COMPLETED', 'ERRORED'] });

    fixture.componentInstance.clearStatuses();

    expect(fixture.componentInstance.searchForm.controls.statuses.value).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: [], page: 0 }
    });
  });

  test('should toggle a trigger-type filter and immediately apply the search', () => {
    const fixture = createComponent();

    fixture.componentInstance.toggleTriggerType('scheduled');

    expect(fixture.componentInstance.searchForm.controls.triggerTypes.value).toEqual(['scheduled']);
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { start: null, end: null, statuses: [], triggerTypes: ['scheduled'], page: 0 }
    });
  });

  test('should clear all active trigger-type filters and immediately apply the search', () => {
    const fixture = createComponent({ triggerTypes: ['manual'] });

    fixture.componentInstance.clearTriggerTypes();

    expect(fixture.componentInstance.searchForm.controls.triggerTypes.value).toEqual([]);
  });

  test('should not apply the search when the date range is invalid (end before start)', () => {
    const fixture = createComponent();
    router.navigate.mockClear();
    fixture.componentInstance.searchForm.setValue({
      start: '2024-01-02T00:00:00.000Z',
      end: '2024-01-01T00:00:00.000Z',
      statuses: [],
      triggerTypes: []
    });

    fixture.componentInstance.triggerSearch();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  test('should show "no runs yet" when there are no runs and no filters are active', () => {
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([])));
    const fixture = createComponent();

    expect(fixture.nativeElement.textContent).toContain('No runs yet');
  });

  test('should show "no runs match the current filters" when a filter is active and nothing matches', () => {
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([])));
    const fixture = createComponent({ statuses: ['ERRORED'] });

    expect(fixture.nativeElement.textContent).toContain('No runs match the current filters');
  });

  test('should show the search form directly, with no collapsible toggle', () => {
    const fixture = createComponent();

    expect(fixture.nativeElement.querySelector('#run-search-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[ngbAccordionButton]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.log-toggle-btn')).toBeNull();
  });

  test('should show "Ø" for a run with no error, and the actual message (in red) for one that errored', () => {
    const erroredRun: WorkflowRunDTO = { ...run, id: 'runId2', status: 'ERRORED', error: 'connection lost' };
    configurationWorkflowService.listRuns.mockReturnValue(of(toPage([run, erroredRun])));
    const fixture = createComponent();

    const cells = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as Array<HTMLElement>;
    const okErrorCell = cells[0].querySelectorAll('td')[6];
    const erroredErrorCell = cells[1].querySelectorAll('td')[6];
    expect(okErrorCell.textContent!.trim()).toBe('Ø');
    expect(okErrorCell.classList.contains('text-danger')).toBe(false);
    expect(erroredErrorCell.textContent!.trim()).toBe('connection lost');
    expect(erroredErrorCell.classList.contains('text-danger')).toBe(true);
  });
});
