import { Component, forwardRef, inject } from '@angular/core';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, firstValueFrom, merge, Observable, of, switchMap, tap } from 'rxjs';
import { ScanModeDTO } from '../../../../../backend/shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { ModalService } from '../../shared/modal.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { formDirectives } from '../../shared/form/form-directives';
import { CertificateDTO } from '../../../../../backend/shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { addAttributeToForm, addEnablingConditions, asFormGroup } from '../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { createPageFromArray, Page } from '../../../../../backend/shared/model/types';
import { emptyPage } from '../../shared/test-utils';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { ImportItemModalComponent } from '../../shared/import-item-modal/import-item-modal.component';
import { OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';

const PAGE_SIZE = 20;

const enum ColumnSortState {
  INDETERMINATE = 0,
  ASCENDING = 1,
  DESCENDING = 2
}

export interface TableData {
  name: string;
  scanMode: ScanModeDTO;
  group: string;
  enabled: boolean;
}

@Component({
  selector: 'oib-edit-south',
  imports: [
    TranslateDirective,
    ...formDirectives,
    SaveButtonComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    OIBusSouthTypeEnumPipe,
    OIBusObjectFormControlComponent,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    PaginationComponent,
    TranslatePipe,
    NgbTooltip,
    NgbDropdownItem
  ],
  templateUrl: './edit-south.component.html',
  styleUrl: './edit-south.component.scss',
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthComponent) => () => component.mode,
      deps: [forwardRef(() => EditSouthComponent)]
    }
  ]
})
export class EditSouthComponent implements CanComponentDeactivate {
  private southConnectorService = inject(SouthConnectorService);
  private fb = inject(NonNullableFormBuilder);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  private scanModeService = inject(ScanModeService);
  private certificateService = inject(CertificateService);
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  southConnector: SouthConnectorDTO | null = null;
  southType: OIBusSouthType | null = null;
  duplicateId = '';

  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  existingSouthConnectors: Array<SouthConnectorLightDTO> = [];
  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

  inMemoryItems: Array<SouthConnectorItemCommandDTO> = [];
  filteredItems: Array<SouthConnectorItemCommandDTO> = [];
  displayedItems: Page<SouthConnectorItemCommandDTO> = emptyPage();
  searchControl = inject(NonNullableFormBuilder).control(null as string | null);
  groupFilterControl = inject(NonNullableFormBuilder).control(null as string | null);
  scanModeFilterControl = inject(NonNullableFormBuilder).control(null as string | null);
  statusFilterControl = inject(NonNullableFormBuilder).control(null as string | null);

  inMemoryGroups: Array<SouthItemGroupCommandDTO> = [];

  // Mass action properties
  selectedItems = new Map<string, SouthConnectorItemCommandDTO>();
  isAllSelected = false;
  isIndeterminate = false;

  columnSortStates: { [key in keyof TableData]: ColumnSortState } = {
    name: ColumnSortState.INDETERMINATE,
    scanMode: ColumnSortState.INDETERMINATE,
    group: ColumnSortState.INDETERMINATE,
    enabled: ColumnSortState.INDETERMINATE
  };
  currentColumnSort: keyof TableData | null = 'name';

  constructor() {
    // get the generator ID
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.southConnectorService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([scanModes, certificates, southConnectors, params, queryParams]) => {
          this.scanModes = scanModes;
          this.certificates = certificates;
          this.existingSouthConnectors = southConnectors;

          const paramSouthId = params.get('southId');
          const duplicateSouthId = queryParams.get('duplicate');
          this.southType = (queryParams.get('type') as OIBusSouthType) || null;

          if (paramSouthId) {
            this.mode = 'edit';
            return this.southConnectorService.findById(paramSouthId).pipe(this.state.pendingUntilFinalization());
          } else {
            this.mode = 'create';
            if (duplicateSouthId) {
              this.duplicateId = duplicateSouthId;
              return this.southConnectorService.findById(duplicateSouthId).pipe(this.state.pendingUntilFinalization());
            } else {
              // otherwise, we are creating one
              return of(null);
            }
          }
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;
            this.inMemoryItems = southConnector.items.map(
              item =>
                ({
                  id: item.id,
                  name: item.name,
                  enabled: item.enabled,
                  settings: item.settings,
                  scanModeId: item.scanMode.id,
                  scanModeName: item.scanMode.name,
                  groupId: item.group?.id || null,
                  groupName: item.group?.name || null,
                  syncWithGroup: item.syncWithGroup,
                  maxReadInterval: item.maxReadInterval,
                  readDelay: item.readDelay,
                  overlap: item.overlap
                }) as SouthConnectorItemCommandDTO
            );
            this.inMemoryGroups = southConnector.groups.map(group => ({
              id: group.id,
              name: group.name,
              scanModeId: group.scanMode.id,
              overlap: group.overlap,
              maxReadInterval: group.maxReadInterval,
              readDelay: group.readDelay
            }));
          }
          return this.southConnectorService.getSouthManifest(this.southType!);
        })
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.manifest = manifest;
        this.resetPage();
        this.buildForm();
      });

    // Subscribe to filter control changes
    merge(
      this.searchControl.valueChanges,
      this.groupFilterControl.valueChanges,
      this.scanModeFilterControl.valueChanges,
      this.statusFilterControl.valueChanges
    ).subscribe(() => {
      this.resetPage();
    });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => {
          this.notificationService.success('south.updated', { name: command.name });
          this.form?.markAsPristine();
        }),
        switchMap(() => this.southConnectorService.findById(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('south.created', { name: command.name });
          this.form?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      this.router.navigate(['/south', southConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (value === 'save') {
      if (!this.form!.valid) {
        return;
      }
      this.createOrUpdateSouthConnector(this.formSouthConnectorCommand);
      return;
    }

    // Test: only validate the settings section
    this.form!.controls.settings.markAllAsTouched();
    if (!this.form!.controls.settings.valid) {
      return;
    }
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector?.id || null, this.formSouthConnectorCommand.settings, this.southType as OIBusSouthType);
  }

  addItem() {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCreation(
      this.inMemoryItems,
      this.scanModes,
      this.certificates,
      this.inMemoryGroups,
      this.manifest!,
      this.southConnector?.id || 'create',
      this.formSouthConnectorCommand,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) => {
      this.inMemoryItems.push(command);
      this.filteredItems = this.filter();
      this.changePage(this.displayedItems.number);
    });
  }

  duplicateItem(item: SouthConnectorItemCommandDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.inMemoryItems,
      this.scanModes,
      this.certificates,
      this.inMemoryGroups,
      this.manifest!,
      item,
      this.southConnector?.id || 'create',
      this.formSouthConnectorCommand,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) => {
      this.inMemoryItems.push(command);
      this.filteredItems = this.filter();
      this.changePage(this.displayedItems.number);
    });
  }

  editItem(southItem: SouthConnectorItemCommandDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;

    const tableIndex = this.inMemoryItems.findIndex(i => i.id === southItem.id || i.name === southItem.name);
    component.prepareForEdition(
      this.inMemoryItems,
      this.scanModes,
      this.certificates,
      this.inMemoryGroups,
      this.manifest!,
      southItem,
      this.southConnector?.id || 'create',
      this.formSouthConnectorCommand,
      tableIndex,
      this.addOrEditGroup.bind(this),
      this.deleteGroup.bind(this)
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) => {
      this.inMemoryItems[tableIndex] = command;
      this.filteredItems = this.filter();
      this.changePage(this.displayedItems.number);
    });
  }

  deleteItem(item: SouthConnectorItemCommandDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .subscribe(() => {
        this.inMemoryItems = this.inMemoryItems.filter(element => element.name !== item.name);
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
      });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .subscribe(() => {
        this.inMemoryItems = [];
        this.resetPage();
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = `${this.southConnector?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        if (!this.southConnector?.id) {
          // create mode
          this.southConnectorService.itemsToCsv(this.manifest!.id, this.inMemoryItems, response.filename, response.delimiter).subscribe();
        } else {
          // edit mode
          this.southConnectorService.exportItems(this.southConnector.id, response.filename, response.delimiter).subscribe();
        }
      }
    });
  }

  importItems() {
    const modal = this.modalService.open(ImportItemModalComponent, { backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled', 'scanMode'];
    const optionalHeaders: Array<string> = ['group'];
    const settingsAttribute = this.manifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    if (this.manifest!.id === 'mqtt') {
      modal.componentInstance.prepare(
        expectedHeaders,
        optionalHeaders,
        this.inMemoryItems.map(item => (item.settings as any)?.topic).filter(topic => topic && typeof topic === 'string' && topic.trim()),
        true
      );
    } else {
      modal.componentInstance.prepare(expectedHeaders, optionalHeaders, [], false);
    }

    modal.result.subscribe(response => {
      if (!response) return;
      this.checkImportItems(response.file, response.delimiter);
    });
  }

  checkImportItems(file: File, delimiter: string) {
    this.southConnectorService.checkImportItems(this.manifest!.id, this.inMemoryItems, file, delimiter).subscribe(result => {
      const modalRef = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl', backdrop: 'static' });
      const component: ImportSouthItemsModalComponent = modalRef.componentInstance;
      const commandItems: Array<SouthConnectorItemCommandDTO> = result.items.map(
        item =>
          ({
            id: item.id,
            name: item.name,
            enabled: item.enabled,
            settings: item.settings,
            scanModeId: item.scanMode.id,
            scanModeName: item.scanMode.name,
            groupId: item.group?.id || null,
            groupName: item.group?.name ?? null,
            syncWithGroup: item.syncWithGroup,
            maxReadInterval: item.maxReadInterval,
            readDelay: item.readDelay,
            overlap: item.overlap
          }) as SouthConnectorItemCommandDTO
      );
      component.prepare(this.manifest!, this.inMemoryItems, commandItems, result.errors, this.scanModes);
      modalRef.result.subscribe((newItems: Array<SouthConnectorItemCommandDTO>) => {
        for (const item of newItems) {
          this.inMemoryItems.push(item);
        }
        this.resetPage();
      });
    });
  }

  addOrEditGroup(command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }): Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO> {
    if (command.mode === 'create') {
      const createdGroup = command.group;
      createdGroup.id = `temp_${Date.now()}`;
      return of(createdGroup);
    } else {
      const foundGroup = this.inMemoryGroups.find(element => element.id === command.group.id)!;
      foundGroup.name = command.group.name;
      foundGroup.scanModeId = command.group.scanModeId;
      foundGroup.maxReadInterval = command.group.maxReadInterval;
      foundGroup.readDelay = command.group.readDelay;
      foundGroup.overlap = command.group.overlap;
      return of(foundGroup);
    }
  }

  deleteGroup(_group: SouthItemGroupDTO | SouthItemGroupCommandDTO): Observable<void> {
    return of();
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const isDuplicate = this.existingSouthConnectors.some(south => {
        if (this.southConnector && south.id === this.southConnector.id) {
          return false;
        }
        return south.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  buildForm() {
    this.form = this.fb.group({
      name: this.fb.control('', {
        validators: [Validators.required, this.checkUniqueness()]
      }),
      description: '',
      enabled: true as boolean,
      settings: this.fb.group({})
    });
    for (const attribute of this.manifest!.settings.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    addEnablingConditions(this.form.controls.settings, this.manifest!.settings.enablingConditions);
    // if we have a south connector, we initialize the values
    if (this.southConnector) {
      this.form.patchValue(this.southConnector);
    } else {
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      this.form.setValue(this.form.getRawValue());
    }

    this.form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  get formSouthConnectorCommand(): SouthConnectorCommandDTO {
    const formValue = this.form!.value;
    return {
      name: formValue.name!,
      type: this.southType!,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
      items: this.inMemoryItems,
      groups: this.inMemoryGroups
    } as SouthConnectorCommandDTO;
  }

  resetPage() {
    this.filteredItems = this.filter();
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    this.sortTable();
    this.displayedItems = createPageFromArray(this.filteredItems, PAGE_SIZE, pageNumber);
  }

  filter(): Array<SouthConnectorItemCommandDTO> {
    const searchText = this.searchControl.value || '';
    const groupFilter = this.groupFilterControl.value;
    const scanModeFilter = this.scanModeFilterControl.value;
    const statusFilter = this.statusFilterControl.value;

    return this.inMemoryItems.filter(item => {
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (groupFilter === 'none' && item.groupId) return false;
      if (groupFilter && groupFilter !== 'none' && item.groupId !== groupFilter) return false;
      if (scanModeFilter && item.scanModeId !== scanModeFilter) return false;
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;
      return true;
    });
  }

  getFieldValue(element: any, field: string): string {
    const settingsAttribute = this.manifest!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    const foundFormControl = settingsAttribute.attributes.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field];
  }

  toggleColumnSort(columnName: keyof TableData) {
    this.currentColumnSort = columnName;
    // Toggle state
    this.columnSortStates[this.currentColumnSort] = (this.columnSortStates[this.currentColumnSort] + 1) % 3;

    // Reset state for every other column
    Object.keys(this.columnSortStates).forEach(key => {
      if (this.currentColumnSort !== key) {
        this.columnSortStates[key as keyof typeof this.columnSortStates] = 0;
      }
    });

    this.changePage(0);
  }

  private sortTable() {
    if (this.currentColumnSort && this.columnSortStates[this.currentColumnSort] !== ColumnSortState.INDETERMINATE) {
      const ascending = this.columnSortStates[this.currentColumnSort] === ColumnSortState.ASCENDING;

      switch (this.currentColumnSort) {
        case 'name':
          this.filteredItems.sort((a, b) => (ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
          break;
        case 'scanMode':
          this.filteredItems.sort((a, b) =>
            ascending
              ? (a.scanModeName || '').localeCompare(b.scanModeName || '')
              : (b.scanModeName || '').localeCompare(a.scanModeName || '')
          );
          break;
        case 'group':
          this.filteredItems.sort((a, b) => {
            const aGroup = a.groupName || '';
            const bGroup = b.groupName || '';
            return ascending ? aGroup.localeCompare(bGroup) : bGroup.localeCompare(aGroup);
          });
          break;
        case 'enabled':
          this.filteredItems.sort((a, b) => {
            const aVal = a.enabled ? 1 : 0;
            const bVal = b.enabled ? 1 : 0;
            return ascending ? aVal - bVal : bVal - aVal;
          });
          break;
      }
    }
  }

  // Mass action methods
  toggleItemSelection(item: SouthConnectorItemCommandDTO) {
    if (this.selectedItems.has(item.name)) {
      this.selectedItems.delete(item.name);
    } else {
      this.selectedItems.set(item.name, item);
    }
    this.updateSelectionState();
  }

  selectAll() {
    this.filteredItems.forEach(item => {
      this.selectedItems.set(item.name, item);
    });
    this.updateSelectionState();
  }

  unselectAll() {
    this.selectedItems.clear();
    this.updateSelectionState();
  }

  updateSelectionState() {
    const totalItems = this.filteredItems.length;
    const selectedCount = this.selectedItems.size;

    this.isAllSelected = selectedCount === totalItems && totalItems > 0;
    this.isIndeterminate = selectedCount > 0 && selectedCount < totalItems;
  }

  getSelectedItemsCount(): number {
    return this.selectedItems.size;
  }

  enableSelectedItems() {
    this.inMemoryItems = this.inMemoryItems.map(item => {
      if (this.selectedItems.has(item.name)) {
        return { ...item, enabled: true };
      }
      return item;
    });
    this.selectedItems.clear();
    this.updateSelectionState();
    this.filteredItems = this.filter();
    this.changePage(this.displayedItems.number);
  }

  disableSelectedItems() {
    this.inMemoryItems = this.inMemoryItems.map(item => {
      if (this.selectedItems.has(item.name)) {
        return { ...item, enabled: false };
      }
      return item;
    });
    this.selectedItems.clear();
    this.updateSelectionState();
    this.filteredItems = this.filter();
    this.changePage(this.displayedItems.number);
  }

  deleteSelectedItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems.size.toString() }
      })
      .subscribe(() => {
        this.inMemoryItems = this.inMemoryItems.filter(item => !this.selectedItems.has(item.name));
        this.selectedItems.clear();
        this.updateSelectionState();
        this.filteredItems = this.filter();
        this.changePage(this.displayedItems.number);
      });
  }

  moveSelectedItemsToGroup() {
    const itemIds = Array.from(this.selectedItems.values(), item => item.id!);
    if (itemIds.length === 0) return;

    const modalRef = this.modalService.open(SelectGroupModalComponent, { backdrop: 'static' });
    const component: SelectGroupModalComponent = modalRef.componentInstance;
    component.prepare(this.inMemoryGroups, this.scanModes, this.manifest!, command => this.addOrEditGroup(command));

    modalRef.result.subscribe((groupId: string) => {
      // Update groups list from the modal in case a new one was created
      const group = this.inMemoryGroups.find(element => element.id === groupId);
      this.inMemoryItems = this.inMemoryItems.map(item => {
        if (this.selectedItems.has(item.name)) {
          return { ...item, groupId: group?.id || null, groupName: group?.name || null };
        }
        return item;
      });
      this.selectedItems.clear();
      this.updateSelectionState();
      this.filteredItems = this.filter();
      this.changePage(this.displayedItems.number);
    });
  }

  getGroupName(item: SouthConnectorItemCommandDTO): string {
    return item.groupName || this.translateService.instant('south.items.group-none');
  }

  protected readonly asFormGroup = asFormGroup;
}
