import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { JsonPipe } from '@angular/common';
import { WorkflowPreviewResultDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';

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
  result: WorkflowPreviewResultDTO | null = null;

  prepare(workflowName: string, result: WorkflowPreviewResultDTO) {
    this.workflowName = workflowName;
    this.result = result;
  }

  close() {
    this.modal.close();
  }
}
