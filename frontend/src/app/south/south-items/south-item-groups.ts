import { Signal } from '@angular/core';

import { Observable, switchMap } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { ModalService } from '../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from './edit-south-item-group-modal/edit-south-item-group-modal.component';

/** A group as persisted (south-detail) or as edited in memory (edit-south). */
export type SouthItemGroup = SouthItemGroupDTO | SouthItemGroupCommandDTO;

/** What the group modal returns: the group to create, or the new values of the edited group. */
export interface SaveGroupCommand {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}

/**
 * The groups of a south connector, owned by the page and given to the modals that list or manage them. The modals read
 * `list` and change the groups through `save` and `delete` only: the page saves them (through the API from south-detail,
 * in memory from edit-south) and updates `list`, so that the page and every open modal show the change.
 */
export interface SouthItemGroups {
  readonly list: Signal<ReadonlyArray<SouthItemGroup>>;
  /** Creates or updates the group, then emits it once `list` contains it */
  save(command: SaveGroupCommand): Observable<SouthItemGroup>;
  /** Asks for a confirmation, deletes the group, then emits once `list` no longer contains it */
  delete(group: SouthItemGroup): Observable<void>;
}

/**
 * Opens the group modal to create a group, or to edit `group`, and saves the result through the groups of the page.
 * Emits the saved group; completes without emitting if the modal is dismissed.
 */
export function openGroupModal(
  modalService: ModalService,
  groups: SouthItemGroups,
  options: { scanModes: Array<ScanModeDTO>; manifest: SouthConnectorManifest; directSave: boolean; group?: SouthItemGroup }
): Observable<SouthItemGroup> {
  const modalRef = modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
  const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
  component.directSave = options.directSave;
  if (options.group) {
    component.prepareForEdition(options.scanModes, groups.list(), options.manifest, options.group);
  } else {
    component.prepareForCreation(options.scanModes, groups.list(), options.manifest);
  }
  return modalRef.result.pipe(switchMap((command: SaveGroupCommand) => groups.save(command)));
}
