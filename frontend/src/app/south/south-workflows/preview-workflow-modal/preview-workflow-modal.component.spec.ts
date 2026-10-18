import { TestBed } from '@angular/core/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { WorkflowRunDetailDTO } from '@oibus/shared/api/workflow-run.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { DownloadService } from '../../../services/download.service';
import { NotificationService } from '../../../shared/notification.service';
import PreviewWorkflowModalComponent from './preview-workflow-modal.component';

class PreviewWorkflowModalComponentTester {
  readonly fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 4 });
  readonly spinner = this.root.getByCss('oib-loading-spinner');
  readonly runCounts = this.root.getByCss('#run-payload-counts');
  readonly none = this.root.getByCss('#preview-none');
  readonly rows = this.root.getByCss('tbody tr');
  readonly closeButton = this.root.getByRole('button', { name: 'Close' });
}

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
  entries: [],
  records: []
};

describe('PreviewWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let configurationWorkflowService: MockObject<ConfigurationWorkflowService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    configurationWorkflowService = createMock(ConfigurationWorkflowService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ConfigurationWorkflowService, useValue: configurationWorkflowService },
        { provide: NotificationService, useValue: notificationService },
        { provide: DownloadService, useValue: createMock(DownloadService) }
      ]
    });
  });

  function openRunPayload(runDetail: WorkflowRunDetailDTO) {
    configurationWorkflowService.getRun.mockReturnValue(of(runDetail));
    const tester = new PreviewWorkflowModalComponentTester();
    tester.fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');
    return tester;
  }

  test('should show a loading spinner while the run is fetched, then its payload once it resolves', async () => {
    const subject = new Subject<WorkflowRunDetailDTO>();
    configurationWorkflowService.getRun.mockReturnValue(subject.asObservable());
    const tester = new PreviewWorkflowModalComponentTester();
    tester.fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');

    await expect.element(tester.spinner).toBeInTheDocument();
    await expect.element(tester.runCounts).not.toBeInTheDocument();

    subject.next(detail);

    await expect.element(tester.spinner).not.toBeInTheDocument();
    await expect.element(tester.runCounts).toHaveTextContent('1 created, 1 updated, 0 disabled, 0 pushed');
  });

  test('should fetch the run and show its payload with the run-payload wording', async () => {
    const tester = openRunPayload(detail);

    expect(configurationWorkflowService.getRun).toHaveBeenCalledWith('southId1', 'workflowId1', 'runId1');
    await expect.element(tester.title).toHaveTextContent('Run payload: Reactor discovery');
    await expect.element(tester.none).toHaveTextContent('Nothing was created, changed, reactivated, or missing in this run');
  });

  test('should list the entries of the run', async () => {
    const tester = openRunPayload({
      ...detail,
      entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }]
    });

    await expect.element(tester.rows).toHaveLength(1);
  });

  test('should close the modal and notify when the run payload request fails', () => {
    configurationWorkflowService.getRun.mockReturnValue(throwError(() => new Error('boom')));
    const tester = new PreviewWorkflowModalComponentTester();
    tester.fixture.componentInstance.prepareForRunPayload('southId1', 'workflowId1', 'runId1', 'Reactor discovery');

    expect(notificationService.error).toHaveBeenCalledWith('south.workflows.run-payload-error', { error: 'boom' });
    expect(activeModal.close).toHaveBeenCalled();
  });

  test('should close the modal', async () => {
    const tester = openRunPayload(detail);

    await tester.closeButton.click();

    expect(activeModal.close).toHaveBeenCalled();
  });
});
