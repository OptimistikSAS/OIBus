import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { WorkflowRunDetailDTO } from '@oibus/shared/api/workflow-run.model';

import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { NotificationService } from '../../../shared/notification.service';
import { WorkflowPreviewComponent } from '../workflow-preview/workflow-preview.component';

/**
 * The full discovered payload of a past Configuration Workflow run, fetched on demand (see WorkflowPreviewComponent) -
 * a workflow as edited is previewed in the Review step of its wizard instead.
 */
@Component({
  selector: 'oib-preview-workflow-modal',
  templateUrl: './preview-workflow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, LoadingSpinnerComponent, WorkflowPreviewComponent]
})
export default class PreviewWorkflowModalComponent {
  private modal = inject(NgbActiveModal);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private notificationService = inject(NotificationService);

  readonly workflowName = signal('');
  readonly result = signal<WorkflowRunDetailDTO | null>(null);

  /** Opened up front, before the run is fetched - see the run history, which opens it immediately. */
  prepareForRunPayload(southId: string, workflowId: string, runId: string, workflowName: string): void {
    this.workflowName.set(workflowName);
    this.configurationWorkflowService.getRun(southId, workflowId, runId).subscribe({
      next: detail => this.result.set(detail),
      error: error => {
        this.notificationService.error('south.workflows.run-payload-error', { error: extractErrorMessage(error) });
        this.modal.close();
      }
    });
  }

  close() {
    this.modal.close();
  }
}
