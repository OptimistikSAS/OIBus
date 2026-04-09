import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { Observable, switchMap } from 'rxjs';

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

  groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;
  private addOrEditGroupFn!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;

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
    return this.groups.find(g => g.id === groupId)?.standardSettings.name || '';
  }

  selectGroup(groupId: string | null) {
    this.form.controls.groupId.setValue(groupId);
  }

  prepare(
    groups: Array<SouthItemGroupDTO> | Array<SouthItemGroupCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    addOrEditGroup: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>
  ) {
    this.groups = groups;
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.addOrEditGroupFn = addOrEditGroup;
  }

  onCreateNewGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.scanModes, this.groups, this.manifest);

    modalRef.result
      .pipe(
        switchMap((result: { mode: 'create' | 'edit'; group: SouthItemGroupCommandDTO }) => {
          return this.addOrEditGroupFn(result);
        })
      )
      .subscribe({
        next: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
          if (!this.groups.find(g => g.id === group.id)) {
            this.groups.push(group);
          }
          this.form.controls.groupId.setValue(group.id);
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
