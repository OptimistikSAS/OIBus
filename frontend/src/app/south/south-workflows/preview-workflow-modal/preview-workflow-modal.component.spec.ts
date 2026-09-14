import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject, throwError } from 'rxjs';

import PreviewWorkflowModalComponent from './preview-workflow-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { NotificationService } from '../../../shared/notification.service';
import { DownloadService } from '../../../services/download.service';
import { WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '../../../../../../backend/shared/model/workflow-run.model';

describe('PreviewWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let notificationService: MockObject<NotificationService>;
  let downloadService: MockObject<DownloadService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    notificationService = createMock(NotificationService);
    downloadService = createMock(DownloadService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: DownloadService, useValue: downloadService }
      ]
    });
  });

  test('should show a loading spinner while the preview request is in flight, then the result once it resolves', async () => {
    const subject = new Subject<WorkflowPreviewResultDTO>();
    configurationWorkflowService.preview.mockReturnValue(subject.asObservable());
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    // A fresh page.elementLocator() is taken at each step rather than reused across the loading/loaded
    // states - its locator strategy snapshots the element's text at creation time, which the "Loading…"
    // -> result swap invalidates.
    await expect.element(page.elementLocator(fixture.nativeElement).getByCss('oib-loading-spinner')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('#preview-counts')).toBeNull();

    subject.next({ discoveredCount: 3, eligibleCount: 0, entries: [], records: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('oib-loading-spinner')).toBeNull();
    await expect
      .element(page.elementLocator(fixture.nativeElement).getByCss('#preview-counts'))
      .toMatchTextContent('3 discovered, 0 eligible');
  });

  test('should show the discovered/eligible counts and a message when there are no entries', async () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 0, entries: [], records: [] };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(configurationWorkflowService.preview).toHaveBeenCalledWith('southId1', 'workflowId1');
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toMatchTextContent('Preview: Reactor discovery');
    await expect.element(root.getByCss('#preview-counts')).toMatchTextContent('3 discovered, 0 eligible');
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
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('tbody')).toMatchTextContent('nodeId=a');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('New');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('nodeId=b');
    await expect.element(root.getByCss('tbody')).toMatchTextContent('Missing');
  });

  test('should paginate a large list of entries, 20 per page', async () => {
    const entries: Array<WorkflowPreviewResultDTO['entries'][number]> = Array.from({ length: 25 }, (_, i) => ({
      key: `nodeId=${i}`,
      status: 'new',
      record: { nodeId: `${i}` },
      previousMetadata: null
    }));
    const result: WorkflowPreviewResultDTO = { discoveredCount: 25, eligibleCount: 25, entries, records: [] };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(20);
    await expect.element(page.elementLocator(fixture.nativeElement).getByCss('ngb-pagination')).toBeInTheDocument();

    fixture.componentInstance.paginatedEntries!.gotoPage(1);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
    expect(rows[0].textContent).toContain('nodeId=20');
  });

  test('should not show pagination controls when everything fits on one page', () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 1,
      eligibleCount: 1,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
      records: []
    };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ngb-pagination')).toBeNull();
  });

  test('should show the status badge as the leftmost column, with the payload column last', () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 1,
      eligibleCount: 1,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
      records: []
    };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
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
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#preview-records-table')).toMatchTextContent('"nodeId": "a"');
    await expect.element(root.getByCss('#preview-records-table')).toMatchTextContent('"nodeId": "b"');
  });

  test('should close the modal and notify when the preview request fails', () => {
    configurationWorkflowService.preview.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.preview-error', { error: expect.any(String) });
    expect(activeModal.close).toHaveBeenCalled();
  });

  test("should use the run-payload title/empty-state wording instead of preview's when shown for a past run", async () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 0, entries: [], records: [] };
    configurationWorkflowService.getRun.mockReturnValue(of(result as WorkflowRunDetailDTO));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(configurationWorkflowService.getRun).toHaveBeenCalledWith('southId1', 'workflowId1', 'runId1');
    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toMatchTextContent('Run payload: Reactor discovery');
    await expect
      .element(root.getByCss('#preview-none'))
      .toMatchTextContent('Nothing was created, changed, reactivated, or missing in this run');
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
    configurationWorkflowService.getRun.mockReturnValue(of(detail));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('#run-payload-counts')).toMatchTextContent('1 created, 1 updated, 0 disabled, 0 pushed');
  });

  test('should never show the created/updated/disabled/pushed breakdown for a live preview - it never acts on anything', () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 2, entries: [], records: [] };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#run-payload-counts')).toBeNull();
  });

  test('should close the modal and notify when the run payload request fails', () => {
    configurationWorkflowService.getRun.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-payload-error', { error: expect.any(String) });
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should disable the export button when there is nothing to export', () => {
    configurationWorkflowService.preview.mockReturnValue(of({ discoveredCount: 0, eligibleCount: 0, entries: [], records: [] }));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('#export-csv-button');
    expect(button.disabled).toBe(true);
  });

  test('should do nothing when exporting before any result has loaded', () => {
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();

    expect(downloadService.downloadFile).not.toHaveBeenCalled();
  });

  test('should export a flattened CSV of the entries for a local/diffed workflow', async () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 1,
      eligibleCount: 1,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a', unit: 'C' }, previousMetadata: null }],
      records: []
    };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('#export-csv-button');
    expect(button.disabled).toBe(false);

    fixture.componentInstance.exportCsv();

    expect(downloadService.downloadFile).toHaveBeenCalledTimes(1);
    const file = downloadService.downloadFile.mock.calls[0][0] as { blob: Blob; name: string };
    expect(file.name).toMatch(/^preview_Reactor_discovery_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_\d{3}\.csv$/);
    const content = await file.blob.text();
    expect(content).toContain('key');
    expect(content).toContain('status');
    expect(content).toContain('unit');
    expect(content).toContain('nodeId=a');
    expect(content).toContain('new');
    expect(content).toContain('C');
  });

  test('should still export the full entries list to CSV even after paginating past the first page', async () => {
    const entries: Array<WorkflowPreviewResultDTO['entries'][number]> = Array.from({ length: 22 }, (_, i) => ({
      key: `nodeId=${i}`,
      status: 'new',
      record: { nodeId: `${i}` },
      previousMetadata: null
    }));
    const result: WorkflowPreviewResultDTO = { discoveredCount: 22, eligibleCount: 22, entries, records: [] };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();
    fixture.componentInstance.paginatedEntries!.gotoPage(1);
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();

    const file = downloadService.downloadFile.mock.calls[0][0] as { blob: Blob; name: string };
    const content = await file.blob.text();
    expect(content).toContain('nodeId=0');
    expect(content).toContain('nodeId=21');
  });

  test('should export the raw records for a remote (push-to-OIAnalytics) workflow', async () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 2,
      eligibleCount: 2,
      entries: [],
      records: [
        { nodeId: 'a', value: 1 },
        { nodeId: 'b', value: 2 }
      ]
    };
    configurationWorkflowService.preview.mockReturnValue(of(result));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    fixture.componentInstance.exportCsv();

    const file = downloadService.downloadFile.mock.calls[0][0] as { blob: Blob; name: string };
    const content = await file.blob.text();
    expect(content).toContain('nodeId');
    expect(content).toContain('value');
    expect(content).toContain('a');
    expect(content).toContain('b');
  });

  test('should close the modal', () => {
    configurationWorkflowService.preview.mockReturnValue(of({ discoveredCount: 0, eligibleCount: 0, entries: [], records: [] }));
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepareForPreview('southId1', 'workflowId1', 'Reactor discovery');
    fixture.detectChanges();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });
});
