import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';

@Component({
  selector: 'oib-select-group-modal',
  templateUrl: './select-group-modal.component.html',
  styleUrl: './select-group-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES]
})
export class SelectGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private modalService = inject(ModalService);

  groups: Array<SouthItemGroupDTO> = [];
  southId!: string;
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;

  form: FormGroup<{
    groupId: FormControl<string | null>;
  }> = this.fb.group({
    groupId: [null as string | null, Validators.required]
  });

  prepare(groups: Array<SouthItemGroupDTO>, southId: string, scanModes: Array<ScanModeDTO>, manifest: SouthConnectorManifest) {
    this.groups = groups;
    this.southId = southId;
    this.scanModes = scanModes;
    this.manifest = manifest;
  }

  onCreateNewGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southId, this.scanModes, this.manifest, this.groups);

    modalRef.result.subscribe({
      next: (group: SouthItemGroupDTO) => {
        if (group) {
          this.groups.push(group);
          this.form.controls.groupId.setValue(group.id);
        }
      },
      error: () => {
        // Modal was dismissed, do nothing
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }

  confirm() {
    if (!this.form.valid) {
      return;
    }
    this.modal.close(this.form.value.groupId);
  }
}
