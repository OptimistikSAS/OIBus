import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { JsonPipe } from '@angular/common';
import { WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { WorkflowRunDetailDTO } from '../../../../../../backend/shared/model/workflow-run.model';

/**
 * Doubles as both a live dry-run preview and a historical run's full discovered payload viewer - the
 * two share the same discoveredCount/eligibleCount/entries/records shape, differing only in what
 * happened to the data: a preview's classification is hypothetical ("what the next run would do"), a
 * run's is what actually happened - and only a run additionally reports what it actually did
 * (created/updated/disabled/pushed), since a preview never acts on anything. `context` picks which
 * title/empty-state wording applies, and whether that extra counts breakdown is shown at all.
 */
export type PreviewModalContext = 'preview' | 'run-payload';

@Component({
  selector: 'oib-preview-workflow-modal',
  templateUrl: './preview-workflow-modal.component.html',
  styleUrl: './preview-workflow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, JsonPipe]
})
export default class PreviewWorkflowModalComponent {
  private modal = inject(NgbActiveModal);

  workflowName = '';
  result: WorkflowPreviewResultDTO | WorkflowRunDetailDTO | null = null;
  context: PreviewModalContext = 'preview';

  prepare(workflowName: string, result: WorkflowPreviewResultDTO | WorkflowRunDetailDTO, context: PreviewModalContext = 'preview') {
    this.workflowName = workflowName;
    this.result = result;
    this.context = context;
  }

  /** The full created/updated/disabled/pushed breakdown behind a run's summary - only available (and
   *  only ever shown) for a historical run's payload, never for a live preview. */
  get runCounts(): WorkflowRunDetailDTO | null {
    return this.context === 'run-payload' ? (this.result as WorkflowRunDetailDTO) : null;
  }

  close() {
    this.modal.close();
  }
}
