import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import {
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { ModalService } from '../../../shared/modal.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { NotificationService } from '../../../shared/notification.service';
import { extractErrorMessage } from '../../../shared/extract-error-message';
import EditWorkflowModalComponent from '../edit-workflow-modal/edit-workflow-modal.component';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';

@Component({
  selector: 'oib-manage-workflows-modal',
  templateUrl: './manage-workflows-modal.component.html',
  styleUrl: './manage-workflows-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export default class ManageWorkflowsModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  southId!: string;
  scanModes: Array<ScanModeDTO> = [];
  items: Array<SouthConnectorItemDTO> = [];
  groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  manifest!: SouthConnectorManifest;
  workflows: Array<ConfigurationWorkflowDTO> = [];
  displayedWorkflows: Array<ConfigurationWorkflowDTO> = [];
  loading = true;
  runningWorkflowId: string | null = null;

  private addOrEditGroup!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  private deleteGroup!: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

  searchControl = this.fb.control(null as string | null);

  constructor() {
    this.searchControl.valueChanges.subscribe(() => this.refreshDisplayed());
  }

  prepare(
    southId: string,
    scanModes: Array<ScanModeDTO>,
    items: Array<SouthConnectorItemDTO>,
    manifest: SouthConnectorManifest,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [],
    addOrEditGroup?: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup?: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.southId = southId;
    this.scanModes = scanModes;
    this.items = items;
    this.manifest = manifest;
    this.groups = groups;
    this.addOrEditGroup = addOrEditGroup!;
    this.deleteGroup = deleteGroup!;
    this.reload();
  }

  private reload() {
    this.loading = true;
    this.configurationWorkflowService.list(this.southId).subscribe(workflows => {
      this.workflows = workflows;
      this.loading = false;
      this.refreshDisplayed();
    });
  }

  private refreshDisplayed() {
    const searchText = (this.searchControl.value || '').toLowerCase();
    this.displayedWorkflows = this.workflows.filter(workflow => !searchText || workflow.name.toLowerCase().includes(searchText));
  }

  close() {
    this.modal.close();
  }

  getScanModeName(workflow: ConfigurationWorkflowDTO): string | null {
    return workflow.scanMode?.name ?? null;
  }

  getTargetItemName(workflow: ConfigurationWorkflowDTO): string | null {
    if (!workflow.targetItemId) {
      return null;
    }
    return this.items.find(item => item.id === workflow.targetItemId)?.name ?? workflow.targetItemId;
  }

  onAdd() {
    const modalRef = this.modalService.open(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditWorkflowModalComponent = modalRef.componentInstance;
    component.prepareForCreation(
      this.scanModes,
      this.items,
      this.workflows,
      this.manifest,
      this.groups,
      this.addOrEditGroup,
      this.deleteGroup
    );
    modalRef.result.subscribe(command => {
      this.configurationWorkflowService.create(this.southId, command).subscribe(created => {
        this.workflows.push(created);
        this.refreshDisplayed();
        this.notificationService.success('south.workflows.created');
      });
    });
  }

  onEdit(workflow: ConfigurationWorkflowDTO) {
    const modalRef = this.modalService.open(EditWorkflowModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditWorkflowModalComponent = modalRef.componentInstance;
    component.prepareForEdition(
      this.scanModes,
      this.items,
      this.workflows,
      this.manifest,
      workflow,
      this.groups,
      this.addOrEditGroup,
      this.deleteGroup
    );
    modalRef.result.subscribe(command => {
      this.configurationWorkflowService.update(this.southId, workflow.id, command).subscribe(updated => {
        const index = this.workflows.findIndex(w => w.id === updated.id);
        if (index >= 0) {
          this.workflows[index] = updated;
        }
        this.refreshDisplayed();
        this.notificationService.success('south.workflows.updated');
      });
    });
  }

  onDelete(workflow: ConfigurationWorkflowDTO) {
    this.confirmationService
      .confirm({ messageKey: 'south.workflows.confirm-deletion', interpolateParams: { name: workflow.name } })
      .pipe(switchMap(() => this.configurationWorkflowService.delete(this.southId, workflow.id)))
      .subscribe({
        next: () => {
          const index = this.workflows.findIndex(w => w.id === workflow.id);
          if (index >= 0) {
            this.workflows.splice(index, 1);
          }
          this.refreshDisplayed();
          this.notificationService.success('south.workflows.deleted');
        },
        error: error => {
          this.notificationService.error('south.workflows.delete-error', { error: extractErrorMessage(error) });
        }
      });
  }

  onRunNow(workflow: ConfigurationWorkflowDTO) {
    this.runningWorkflowId = workflow.id;
    this.configurationWorkflowService.runNow(this.southId, workflow.id).subscribe({
      next: () => {
        this.runningWorkflowId = null;
        this.notificationService.success('south.workflows.run-now-success');
      },
      error: error => {
        this.runningWorkflowId = null;
        this.notificationService.error('south.workflows.run-now-error', { error: extractErrorMessage(error) });
      }
    });
  }

  onPreview(workflow: ConfigurationWorkflowDTO) {
    this.configurationWorkflowService.preview(this.southId, workflow.id).subscribe({
      next: result => {
        const modalRef = this.modalService.open(PreviewWorkflowModalComponent, { size: 'lg' });
        const component: PreviewWorkflowModalComponent = modalRef.componentInstance;
        component.prepare(workflow.name, result);
      },
      error: error => {
        this.notificationService.error('south.workflows.preview-error', { error: extractErrorMessage(error) });
      }
    });
  }

  onViewHistory(workflow: ConfigurationWorkflowDTO) {
    this.modal.close();
    this.router.navigate(['/south', this.southId, 'workflows', workflow.id, 'history']);
  }
}
