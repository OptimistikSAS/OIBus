import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { ModalService } from '../../../shared/modal.service';
import { openGroupModal, SouthItemGroups } from '../south-item-groups';

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

  /** The groups of the page: a group created from this modal is saved through them */
  private readonly groupStore = signal<SouthItemGroups | null>(null);
  readonly groups = computed(() => this.groupStore()?.list() ?? []);
  readonly selectedGroupId = signal<string | null>(null);
  /** Name of the selected group (only used when a group is selected: the template translates "None" itself). */
  readonly selectedGroupName = computed(
    () => this.groups().find(group => group.id === this.selectedGroupId())?.standardSettings.name ?? ''
  );

  private scanModes: Array<ScanModeDTO> = [];
  private manifest!: SouthConnectorManifest;

  selectGroup(groupId: string | null) {
    this.selectedGroupId.set(groupId);
  }

  prepare(groups: SouthItemGroups, scanModes: Array<ScanModeDTO>, manifest: SouthConnectorManifest) {
    this.groupStore.set(groups);
    this.scanModes = scanModes;
    this.manifest = manifest;
  }

  onCreateNewGroup() {
    openGroupModal(this.modalService, this.groupStore()!, {
      scanModes: this.scanModes,
      manifest: this.manifest,
      directSave: true
    }).subscribe({
      next: group => this.selectedGroupId.set(group.id),
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
