import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import PreviewWorkflowModalComponent from './preview-workflow-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '../../../../../../backend/shared/model/workflow-run.model';

describe('PreviewWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should show the discovered/eligible counts and a message when there are no entries', async () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 0, entries: [], records: [] };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Preview: Reactor discovery');
    await expect.element(root.getByCss('#preview-counts')).toHaveTextContent('3 discovered, 0 eligible');
    await expect.element(root.getByCss('#preview-none')).toBeInTheDocument();
  });

  test('should render one row per entry with its status badge for a local workflow', async () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 2,
      eligibleCount: 2,
      entries: [
        { key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null },
        { key: 'nodeId=b', status: 'missing', record: null, previousMetadata: { nodeId: 'b' } }
      ],
      records: []
    };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toHaveTextContent('nodeId=a');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('New');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('nodeId=b');
    await expect.element(root.getByCss('tbody')).toHaveTextContent('Missing');
  });

  test('should show the status badge as the leftmost column, with the payload column last', () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 1,
      eligibleCount: 1,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
      records: []
    };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result);
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('tbody td');
    expect(cells[0].querySelector('.badge')).not.toBeNull();
    expect(cells[1].textContent.trim()).toBe('nodeId=a');
    expect(cells[2].querySelector('pre')).not.toBeNull();
  });

  test('should render the raw records for a remote (push-to-OIAnalytics) workflow', async () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 2,
      eligibleCount: 2,
      entries: [],
      records: [
        { nodeId: 'a', value: 1 },
        { nodeId: 'b', value: 2 }
      ]
    };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#preview-records-table')).toHaveTextContent('"nodeId": "a"');
    await expect.element(root.getByCss('#preview-records-table')).toHaveTextContent('"nodeId": "b"');
  });

  test("should use the run-payload title/empty-state wording instead of preview's when shown for a past run", async () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 0, entries: [], records: [] };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result, 'run-payload');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Run payload: Reactor discovery');
    await expect
      .element(root.getByCss('#preview-none'))
      .toHaveTextContent('Nothing was created, changed, reactivated, or missing in this run');
  });

  test("should show the created/updated/disabled/pushed breakdown for a past run's payload", async () => {
    const detail: WorkflowRunDetailDTO = {
      id: 'runId1',
      workflowId: 'workflowId1',
      triggerType: 'manual',
      status: 'COMPLETED',
      startedAt: '',
      completedAt: '',
      error: null,
      triggeredBy: { id: 'user1', friendlyName: 'User One' },
      discoveredCount: 3,
      eligibleCount: 2,
      createdCount: 1,
      updatedCount: 1,
      disabledCount: 0,
      pushedCount: 0,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
      records: []
    };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', detail, 'run-payload');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#run-payload-counts')).toHaveTextContent('1 created, 1 updated, 0 disabled, 0 pushed');
  });

  test('should never show the created/updated/disabled/pushed breakdown for a live preview - it never acts on anything', () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 2, entries: [], records: [] };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result, 'preview');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#run-payload-counts')).toBeNull();
  });

  test('should close the modal', () => {
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', { discoveredCount: 0, eligibleCount: 0, entries: [], records: [] });
    fixture.detectChanges();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });
});
