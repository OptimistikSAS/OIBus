import { TestBed } from '@angular/core/testing';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import PreviewWorkflowModalComponent from './preview-workflow-modal.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';

describe('PreviewWorkflowModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
  });

  test('should show the discovered/eligible counts and a message when there are no entries', async () => {
    const result: WorkflowPreviewResultDTO = { discoveredCount: 3, eligibleCount: 0, entries: [] };
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', result);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    await expect.element(root.getByCss('.modal-title')).toHaveTextContent('Preview: Reactor discovery');
    await expect.element(root.getByCss('#preview-counts')).toHaveTextContent('3 discovered, 0 eligible');
    await expect.element(root.getByCss('#preview-none')).toBeInTheDocument();
  });

  test('should render one row per entry with its status badge', async () => {
    const result: WorkflowPreviewResultDTO = {
      discoveredCount: 2,
      eligibleCount: 2,
      entries: [
        { key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null },
        { key: 'nodeId=b', status: 'missing', record: null, previousMetadata: { nodeId: 'b' } }
      ]
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

  test('should close the modal', () => {
    const fixture = TestBed.createComponent(PreviewWorkflowModalComponent);
    fixture.componentInstance.prepare('Reactor discovery', { discoveredCount: 0, eligibleCount: 0, entries: [] });
    fixture.detectChanges();

    fixture.componentInstance.close();

    expect(activeModal.close).toHaveBeenCalled();
  });
});
