import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';

@Component({
  selector: 'oib-select-group-modal',
  templateUrl: './select-group-modal.component.html',
  styleUrl: './select-group-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, NgbDropdownModule]
})
export class SelectGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private modalService = inject(ModalService);

  groups: Array<SouthItemGroupDTO> = [];
  southId!: string;
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;
  inMemoryMode = false;

  form: FormGroup<{
    groupId: FormControl<string | null>;
  }> = this.fb.group({
    groupId: [null as string | null]
  });

  get selectedGroupId(): string | null {
    return this.form.controls.groupId.value;
  }

  getSelectedGroupName(): string {
    const groupId = this.form.controls.groupId.value;
    if (!groupId) {
      return 'south.items.group-none'; // Will be translated in template
    }
    return this.groups.find(g => g.id === groupId)?.name || '';
  }

  selectGroup(groupId: string | null) {
    this.form.controls.groupId.setValue(groupId);
  }

  prepare(
    groups: Array<SouthItemGroupDTO>,
    southId: string,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    inMemoryMode = false
  ) {
    this.groups = groups;
    this.southId = southId;
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.inMemoryMode = inMemoryMode;
  }

  onCreateNewGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.southId, this.scanModes, this.manifest, this.groups, this.inMemoryMode);

    modalRef.result.subscribe({
      next: (group: SouthItemGroupDTO) => {
        if (group) {
          // Check if group already exists to avoid duplicates
          if (!this.groups.find(g => g.id === group.id)) {
            this.groups.push(group);
          }
          this.form.controls.groupId.setValue(group.id);
        }
      },
      error: () => {}
    });
  }

  cancel() {
    this.modal.dismiss();
  }

  confirm() {
    this.modal.close(this.form.value.groupId);
  }
}
