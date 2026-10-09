import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable, switchMap } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';

@Component({
  selector: 'oib-select-group-modal',
  templateUrl: './select-group-modal.component.html',
  styleUrl: './select-group-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, NgbDropdownModule]
})
export class SelectGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private modalService = inject(ModalService);

  /**
   * The opener's own group list, shared by reference: a group created from this modal is pushed into it, which is how
   * the opener (edit-south, south-detail) gets it back. The template renders the `groups` snapshot instead.
   */
  private sharedGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  readonly groups = signal<Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>>([]);
  readonly selectedGroupId = signal<string | null>(null);
  /** Name of the selected group (only used when a group is selected: the template translates "None" itself). */
  readonly selectedGroupName = computed(
    () => this.groups().find(group => group.id === this.selectedGroupId())?.standardSettings.name ?? ''
  );

  private scanModes: Array<ScanModeDTO> = [];
  private manifest!: SouthConnectorManifest;
  private addOrEditGroupFn!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;

  selectGroup(groupId: string | null) {
    this.selectedGroupId.set(groupId);
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
    this.sharedGroups = groups;
    this.groups.set([...groups]);
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.addOrEditGroupFn = addOrEditGroup;
  }

  onCreateNewGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForCreation(this.scanModes, this.sharedGroups, this.manifest);

    modalRef.result
      .pipe(
        switchMap((result: { mode: 'create' | 'edit'; group: SouthItemGroupCommandDTO }) => {
          return this.addOrEditGroupFn(result);
        })
      )
      .subscribe({
        next: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
          if (!this.sharedGroups.find(g => g.id === group.id)) {
            this.sharedGroups.push(group);
          }
          this.groups.set([...this.sharedGroups]);
          this.selectedGroupId.set(group.id);
        },
        error: () => {}
      });
  }

  cancel() {
    this.modal.dismiss();
  }

  confirm() {
    this.modal.close(this.selectedGroupId());
  }
}
