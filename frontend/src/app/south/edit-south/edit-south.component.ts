import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbDropdownItem, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorLightDTO,
  SouthItemGroupCommandDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { OIBusSouthType, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthConnectorExploreEntry } from '@oibus/shared/domain/south-connector.model';

import { CertificateService } from '../../services/certificate.service';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { findItemIndex } from '../../shared/find-item-index';
import { addAttributeToForm, addEnablingConditions, asFormGroup, extractFormValue } from '../../shared/form/dynamic-form.builder';
import { formDirectives } from '../../shared/form/form-directives';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { builtInSortValue, ItemSelection } from '../../shared/item-table/item-table';
import { ItemTableComponent } from '../../shared/item-table/item-table.component';
import { ITEM_TABLE_TEMPLATES } from '../../shared/item-table/item-table-templates';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { SouthExploreModalComponent } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { SaveGroupCommand, SouthItemGroup, SouthItemGroups } from '../south-items/south-item-groups';
import ManageWorkflowsModalComponent from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { toConfigurationWorkflowCommand, WorkflowCreationService } from '../south-workflows/workflow-creation.service';

/** The group column is added by the page: the other columns are sorted by the item table. */
function sortValue(item: SouthConnectorItemCommandDTO, column: string): string | number {
  return column === 'group' ? item.groupName || '' : builtInSortValue(item, column);
}

type SouthConnectorForm = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  enabled: FormControl<boolean>;
  settings: FormGroup;
}>;

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
    TranslatePipe,
    NgbTooltip,
    NgbDropdownItem,
    ItemTableComponent,
    ...ITEM_TABLE_TEMPLATES
  ],
  templateUrl: './edit-south.component.html',
  styleUrl: './edit-south.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthComponent) => () => component.mode(),
      deps: [forwardRef(() => EditSouthComponent)]
    }
  ]
})
export class EditSouthComponent implements CanComponentDeactivate {
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly configurationWorkflowService = inject(ConfigurationWorkflowService);
  private readonly workflowCreationService = inject(WorkflowCreationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly modalService = inject(ModalService);
  private readonly translateService = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly docsUrlService = inject(DocsUrlService);

  readonly generalSettingsHelpUrl = this.docsUrlService.resolve('guide/south-connectors/common-settings');
  readonly itemSectionHelpUrl = this.docsUrlService.resolve('guide/south-connectors/common-settings#item-section');

  readonly mode = signal<'create' | 'edit'>('create');
  readonly southConnector = signal<SouthConnectorDTO | null>(null);
  readonly southType = signal<OIBusSouthType | null>(null);
  readonly southTypeHelpUrl = computed(() => this.docsUrlService.resolve('guide/south-connectors/' + this.southType()));
  private duplicateId = '';

  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private existingSouthConnectors: Array<SouthConnectorLightDTO> = [];
  readonly form = signal<SouthConnectorForm | null>(null);

  /** The items of the connector, edited in memory and saved along with the connector. */
  readonly inMemoryItems = signal<Array<SouthConnectorItemCommandDTO>>([]);

  /** The groups and Configuration Workflows of the connector, edited in memory and saved along with the connector. */
  readonly inMemoryGroups = signal<Array<SouthItemGroupCommandDTO>>([]);
  /** Given to the workflow modal, which updates it */
  readonly inMemoryWorkflows = signal<Array<ConfigurationWorkflowCommandDTO>>([]);
  /** The groups, as given to the modals that list or change them */
  private readonly itemGroups: SouthItemGroups = {
    list: this.inMemoryGroups,
    save: command => this.addOrEditGroup(command),
    delete: group => this.deleteGroup(group)
  };

  // --- Items table: the group and scan mode filters are added to the name and status filters of the table ---
  readonly groupFilterControl = this.fb.control(null as string | null);
  readonly scanModeFilterControl = this.fb.control(null as string | null);
  private readonly groupFilter = toSignal(this.groupFilterControl.valueChanges, { initialValue: null });
  private readonly scanModeFilter = toSignal(this.scanModeFilterControl.valueChanges, { initialValue: null });
  readonly itemFilter = computed(() => {
    const groupFilter = this.groupFilter();
    const scanModeFilter = this.scanModeFilter();
    const groups = this.inMemoryGroups();
    return (item: SouthConnectorItemCommandDTO) => {
      if (groupFilter === 'none' && item.groupId) return false;
      if (groupFilter && groupFilter !== 'none' && item.groupId !== groupFilter) return false;
      const group = item.groupId ? groups.find(g => g.id === item.groupId) : null;
      const effectiveScanModeId = group ? group.standardSettings.scanModeId : item.scanModeId;
      return !scanModeFilter || effectiveScanModeId === scanModeFilter;
    };
  });
  protected readonly itemSortValue = sortValue;
  private readonly itemTable = viewChild(ItemTableComponent);

  /** The item currently hovered in the list — drives the schedule details tooltip. */
  readonly tooltipItem = signal<SouthConnectorItemCommandDTO | null>(null);

  // Mass action properties
  readonly selectedItems = signal<ItemSelection<SouthConnectorItemCommandDTO>>(new Map());

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
          this.scanModes.set(scanModes);
          this.certificates.set(certificates);
          this.existingSouthConnectors = southConnectors;

          const paramSouthId = params.get('southId');
          const duplicateSouthId = queryParams.get('duplicate');
          this.southType.set((queryParams.get('type') as OIBusSouthType) || null);

          if (paramSouthId) {
            this.mode.set('edit');
            return this.southConnectorService.findById(paramSouthId).pipe(this.state.pendingUntilFinalization());
          } else {
            this.mode.set('create');
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
          this.southConnector.set(southConnector);
          let workflows$: Observable<Array<ConfigurationWorkflowCommandDTO>> = of([]);
          if (southConnector) {
            this.southType.set(southConnector.type);
            // When duplicating, groups must be recreated rather than pointing at the source
            // connector's groups, so give each one a fresh temp id (same convention used when
            // a group is created from the UI) and remap items to the new ids.
            const isDuplicate = this.mode() === 'create' && !!this.duplicateId;
            const groupIdMap = new Map<string, string>();
            if (isDuplicate) {
              southConnector.groups.forEach((group, index) => {
                groupIdMap.set(group.id, `temp_${Date.now()}_${index}`);
              });
            }
            this.inMemoryItems.set(
              southConnector.items.map(
                item =>
                  ({
                    id: item.id,
                    name: item.name,
                    enabled: item.enabled,
                    settings: item.settings,
                    scanModeId: item.scanMode?.id || null,
                    scanModeName: item.scanMode?.name || null,
                    groupId: item.group ? (groupIdMap.get(item.group.id) ?? item.group.id) : null,
                    groupName: item.group?.standardSettings.name || null,
                    syncWithGroup: item.syncWithGroup,
                    maxReadInterval: item.maxReadInterval,
                    readDelay: item.readDelay,
                    startTimeOffset: item.startTimeOffset,
                    endTimeOffset: item.endTimeOffset,
                    recoveryStrategy: item.recoveryStrategy,
                    cachingStrategy: item.cachingStrategy,
                    thresholdType: item.thresholdType,
                    threshold: item.threshold,
                    rangeLow: item.rangeLow,
                    rangeHigh: item.rangeHigh,
                    maxCachingInterval: item.maxCachingInterval
                  }) as SouthConnectorItemCommandDTO
              )
            );
            this.inMemoryGroups.set(
              southConnector.groups.map(group => ({
                id: groupIdMap.get(group.id) ?? group.id,
                standardSettings: {
                  name: group.standardSettings.name,
                  scanModeId: group.standardSettings.scanMode.id
                },
                historySettings: {
                  startTimeOffset: group.historySettings.startTimeOffset,
                  endTimeOffset: group.historySettings.endTimeOffset,
                  maxReadInterval: group.historySettings.maxReadInterval,
                  readDelay: group.historySettings.readDelay,
                  recoveryStrategy: group.historySettings.recoveryStrategy,
                  cachingStrategy: group.historySettings.cachingStrategy
                }
              }))
            );
            // Workflows aren't part of SouthConnectorDTO - loaded separately (from the duplicated
            // connector when duplicating, then recreated like its groups).
            workflows$ = this.configurationWorkflowService
              .list(southConnector.id)
              .pipe(
                map(workflows =>
                  workflows.map((workflow, index) => this.toInMemoryWorkflow(workflow, isDuplicate ? index : null, groupIdMap))
                )
              );
          }
          return combineLatest([this.southConnectorService.getSouthManifest(this.southType()!), workflows$]);
        }),
        takeUntilDestroyed()
      )
      .subscribe(([manifest, workflows]) => {
        if (!manifest) {
          return;
        }
        this.inMemoryWorkflows.set(workflows);
        this.manifest.set(manifest);
        this.buildForm();
      });
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form()?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    if (this.mode() === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector()!.id, command).pipe(
        tap(() => {
          this.notificationService.success('south.updated', { name: command.name });
          this.form()?.markAsPristine();
        }),
        switchMap(() => this.southConnectorService.findById(this.southConnector()!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('south.created', { name: command.name });
          this.form()?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      this.router.navigate(['/south', southConnector.id]);
    });
  }

  submit(value: 'save' | 'test') {
    if (value === 'save') {
      if (!this.form()!.valid) {
        return;
      }
      this.createOrUpdateSouthConnector(this.formSouthConnectorCommand);
      return;
    }

    // Test: only validate the settings section
    this.form()!.controls.settings.markAllAsTouched();
    if (!this.form()!.controls.settings.valid) {
      return;
    }
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest(
      'south',
      this.southConnector()?.id || null,
      this.formSouthConnectorCommand.settings,
      this.southType() as OIBusSouthType
    );
  }

  explore() {
    // Explore: only validate the settings section, like the test connection button
    this.form()!.controls.settings.markAllAsTouched();
    if (!this.form()!.controls.settings.valid) {
      return;
    }
    const southId = this.southConnector()?.id || null;
    const settings = this.formSouthConnectorCommand.settings;
    const manifest = this.manifest()!;
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'xl' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    // With tree-based discovery, a workflow can be created from an explored node - kept in memory, like
    // the ones added through the Manage workflows modal, and saved along with the connector.
    const nodeActionKey = manifest.discovery?.kind === 'tree' ? 'south.explore.create-workflow' : null;
    component.prepare(southId, settings, this.southType() as OIBusSouthType, undefined, nodeActionKey);
    modalRef.result
      .pipe(
        switchMap((entry: SouthConnectorExploreEntry) =>
          this.workflowCreationService.createFromExploredNode(
            {
              directSave: false,
              southId: southId || 'create',
              southSettings: settings,
              scanModes: this.scanModes(),
              manifest,
              groups: this.itemGroups,
              existingWorkflows: this.inMemoryWorkflows()
            },
            entry
          )
        )
      )
      .subscribe(workflow => this.inMemoryWorkflows.update(workflows => [...workflows, workflow]));
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
    component.directSave = false;
    component.prepareForCreation(
      this.inMemoryItems(),
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      this.southConnector()?.id || 'create',
      this.formSouthConnectorCommand
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) => this.inMemoryItems.update(items => [...items, command]));
  }

  duplicateItem(item: SouthConnectorItemCommandDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.directSave = false;
    component.prepareForCopy(
      this.inMemoryItems(),
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      item,
      this.southConnector()?.id || 'create',
      this.formSouthConnectorCommand
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) => this.inMemoryItems.update(items => [...items, command]));
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
    component.directSave = false;

    const tableIndex = findItemIndex(this.inMemoryItems(), southItem);
    component.prepareForEdition(
      this.inMemoryItems(),
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      southItem,
      this.southConnector()?.id || 'create',
      this.formSouthConnectorCommand,
      tableIndex
    );
    modalRef.result.subscribe((command: SouthConnectorItemCommandDTO) =>
      this.inMemoryItems.update(items => items.map((item, index) => (index === tableIndex ? command : item)))
    );
  }

  deleteItem(item: SouthConnectorItemCommandDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .subscribe(() => {
        this.inMemoryItems.update(items => items.filter(element => element.name !== item.name));
      });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .subscribe(() => {
        this.inMemoryItems.set([]);
        this.itemTable()?.goToFirstPage();
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const southConnector = this.southConnector();
    const filename = `${southConnector?.name || 'items'}`;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        if (!southConnector?.id) {
          // create mode
          this.southConnectorService
            .itemsToCsv(this.manifest()!.id, this.inMemoryItems(), response.filename, response.delimiter)
            .subscribe();
        } else {
          // edit mode
          this.southConnectorService.exportItems(southConnector.id, response.filename, response.delimiter).subscribe();
        }
      }
    });
  }

  importItems() {
    const modal = this.modalService.open(ImportSouthItemsModalComponent, { size: 'xl', backdrop: 'static' });
    const expectedHeaders = ['name', 'enabled', 'scanMode'];
    const optionalHeaders: Array<string> = [
      'group',
      'maxReadInterval',
      'readDelay',
      'startTimeOffset',
      'endTimeOffset',
      'recoveryStrategy',
      'syncWithGroup'
    ];
    const settingsAttribute = this.manifest()!.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    settingsAttribute.attributes.forEach(setting => {
      if (settingsAttribute.enablingConditions.find(element => element.targetPathFromRoot === setting.key)) {
        optionalHeaders.push(`settings_${setting.key}`);
      } else {
        expectedHeaders.push(`settings_${setting.key}`);
      }
    });

    const checkFn = (file: File, delimiter: string, deleteItemsNotPresent: boolean) =>
      this.southConnectorService.checkImportItems(this.manifest()!.id, this.inMemoryItems(), file, delimiter, deleteItemsNotPresent).pipe(
        map(result => ({
          items: result.items.map(
            item =>
              ({
                id: item.id,
                name: item.name,
                enabled: item.enabled,
                settings: item.settings,
                scanModeId: item.scanMode?.id || null,
                scanModeName: item.scanMode?.name || null,
                groupId: item.group?.id || null,
                groupName: item.group?.standardSettings.name ?? null,
                syncWithGroup: item.syncWithGroup,
                maxReadInterval: item.maxReadInterval,
                readDelay: item.readDelay,
                startTimeOffset: item.startTimeOffset,
                endTimeOffset: item.endTimeOffset,
                recoveryStrategy: item.recoveryStrategy,
                cachingStrategy: item.cachingStrategy,
                thresholdType: item.thresholdType,
                threshold: item.threshold,
                rangeLow: item.rangeLow,
                rangeHigh: item.rangeHigh,
                maxCachingInterval: item.maxCachingInterval
              }) as SouthConnectorItemCommandDTO
          ),
          errors: result.errors
        }))
      );

    if (this.manifest()!.id === 'mqtt') {
      modal.componentInstance.prepare(
        this.manifest()!,
        expectedHeaders,
        optionalHeaders,
        this.inMemoryItems()
          .map(item => ('topic' in item.settings ? item.settings.topic : undefined))
          .filter((topic): topic is string => typeof topic === 'string' && topic.trim() !== ''),
        true,
        true,
        checkFn
      );
    } else {
      modal.componentInstance.prepare(this.manifest()!, expectedHeaders, optionalHeaders, [], false, true, checkFn);
    }

    modal.result.subscribe((response: { items: Array<SouthConnectorItemCommandDTO>; eraseExisting: boolean } | undefined) => {
      if (!response) return;
      this.inMemoryItems.update(items => [...(response.eraseExisting ? [] : items), ...response.items]);
      this.itemTable()?.goToFirstPage();
    });
  }

  /** Saves the group in memory: a created group gets a temporary id, replaced by a real one when the connector is saved */
  addOrEditGroup(command: SaveGroupCommand): Observable<SouthItemGroupCommandDTO> {
    if (command.mode === 'create') {
      const createdGroup: SouthItemGroupCommandDTO = { ...command.group, id: `temp_${Date.now()}` };
      this.inMemoryGroups.update(groups => [...groups, createdGroup]);
      return of(createdGroup);
    }
    const updatedGroup = command.group;
    this.inMemoryGroups.update(groups => groups.map(group => (group.id === updatedGroup.id ? updatedGroup : group)));
    return of(updatedGroup);
  }

  deleteGroup(group: SouthItemGroup): Observable<void> {
    return this.confirmationService
      .confirm({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: group.standardSettings.name }
      })
      .pipe(
        tap(() => {
          const groupScanModeId =
            'scanModeId' in group.standardSettings ? group.standardSettings.scanModeId : group.standardSettings.scanMode?.id;
          const applyHistorySettings = this.manifest()?.modes.history ?? false;

          this.inMemoryItems.update(items =>
            items.map(item => {
              if (item.groupId !== group.id) {
                return item;
              }
              return {
                ...item,
                groupId: null,
                groupName: null,
                syncWithGroup: false,
                scanModeId: item.scanModeId ?? groupScanModeId ?? null,
                // the name is displayed in the item list
                scanModeName: item.scanModeId
                  ? item.scanModeName
                  : (this.scanModes().find(scanMode => scanMode.id === groupScanModeId)?.name ?? null),
                startTimeOffset: applyHistorySettings
                  ? (item.startTimeOffset ?? group.historySettings.startTimeOffset)
                  : item.startTimeOffset,
                endTimeOffset: applyHistorySettings ? (item.endTimeOffset ?? group.historySettings.endTimeOffset) : item.endTimeOffset,
                maxReadInterval: applyHistorySettings
                  ? (item.maxReadInterval ?? group.historySettings.maxReadInterval)
                  : item.maxReadInterval,
                readDelay: applyHistorySettings ? (item.readDelay ?? group.historySettings.readDelay) : item.readDelay,
                recoveryStrategy: applyHistorySettings
                  ? (item.recoveryStrategy ?? group.historySettings.recoveryStrategy)
                  : item.recoveryStrategy
              };
            })
          );
          this.inMemoryGroups.update(groups => groups.filter(element => element.id !== group.id));
          // A workflow mapping its items into the deleted group now maps them into no group at all. An open
          // ManageWorkflowsModalComponent (whose edit modal may have triggered this deletion) shows this signal.
          this.inMemoryWorkflows.update(workflows =>
            workflows.map(workflow => {
              if (workflow.itemFieldMapping?.['groupId'] !== group.id) {
                return workflow;
              }
              const { groupId: _groupId, syncWithGroup: _syncWithGroup, ...itemFieldMapping } = workflow.itemFieldMapping;
              return { ...workflow, itemFieldMapping };
            })
          );
          this.itemTable()?.goToFirstPage();
        }),
        map(() => undefined)
      );
  }

  manageGroups() {
    const modalRef = this.modalService.open(ManageGroupsModalComponent, { size: 'lg', backdrop: 'static' });
    const component: ManageGroupsModalComponent = modalRef.componentInstance;
    component.prepare(
      this.itemGroups,
      this.scanModes(),
      this.manifest()!,
      false,
      groupId => this.inMemoryItems().filter(item => item.groupId === groupId).length
    );
    modalRef.result.subscribe(() => this.itemTable()?.goToFirstPage());
  }

  /**
   * A persisted workflow as edited in memory. When duplicating (`duplicateIndex` set), it gets a fresh
   * temp id so it's created for the new connector rather than matched against the source's, and a
   * group mapped as its constant groupId is remapped to that group's own recreated (temp id) copy.
   */
  private toInMemoryWorkflow(
    workflow: ConfigurationWorkflowDTO,
    duplicateIndex: number | null,
    groupIdMap: Map<string, string>
  ): ConfigurationWorkflowCommandDTO {
    const command = toConfigurationWorkflowCommand(workflow);
    if (duplicateIndex === null) {
      return command;
    }
    const mappedGroupId = command.itemFieldMapping?.['groupId'];
    const itemFieldMapping =
      command.itemFieldMapping && mappedGroupId && groupIdMap.has(mappedGroupId)
        ? { ...command.itemFieldMapping, groupId: groupIdMap.get(mappedGroupId)! }
        : command.itemFieldMapping;
    return { ...command, id: `temp_${Date.now()}_${duplicateIndex}`, itemFieldMapping };
  }

  manageWorkflows() {
    const modalRef = this.modalService.open(ManageWorkflowsModalComponent, { size: 'xl', backdrop: 'static' });
    const component: ManageWorkflowsModalComponent = modalRef.componentInstance;
    component.prepareForInMemory(
      this.inMemoryWorkflows,
      this.southConnector()?.id || 'create',
      this.formSouthConnectorCommand.settings,
      this.scanModes(),
      this.manifest()!,
      this.itemGroups
    );
    modalRef.result.subscribe(() => this.itemTable()?.goToFirstPage());
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const southConnector = this.southConnector();
      const isDuplicate = this.existingSouthConnectors.some(south => {
        if (southConnector && south.id === southConnector.id) {
          return false;
        }
        return south.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  buildForm() {
    const form: SouthConnectorForm = this.fb.group({
      name: this.fb.control('', {
        validators: [Validators.required, this.checkUniqueness()]
      }),
      description: '',
      enabled: true as boolean,
      settings: this.fb.group({})
    });
    for (const attribute of this.manifest()!.settings.attributes) {
      addAttributeToForm(this.fb, form.controls.settings, attribute);
    }
    addEnablingConditions(form.controls.settings, this.manifest()!.settings.enablingConditions);
    // if we have a south connector, we initialize the values
    const southConnector = this.southConnector();
    if (southConnector) {
      form.patchValue(southConnector);
    } else {
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      form.setValue(form.getRawValue());
    }

    form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.form.set(form);
  }

  get formSouthConnectorCommand(): SouthConnectorCommandDTO {
    const formValue = this.form()!.value;
    return {
      name: formValue.name!,
      type: this.southType()!,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: extractFormValue(formValue.settings)!,
      items: this.inMemoryItems(),
      groups: this.inMemoryGroups(),
      configurationWorkflows: this.inMemoryWorkflows()
    } as SouthConnectorCommandDTO;
  }

  // Mass action methods
  unselectAll() {
    this.selectedItems.set(new Map());
  }

  private setSelectedItemsEnabled(enabled: boolean) {
    const selectedItems = this.selectedItems();
    this.inMemoryItems.update(items => items.map(item => (selectedItems.has(item.name) ? { ...item, enabled } : item)));
    this.selectedItems.set(new Map());
  }

  enableSelectedItems() {
    this.setSelectedItemsEnabled(true);
  }

  disableSelectedItems() {
    this.setSelectedItemsEnabled(false);
  }

  deleteSelectedItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems().size.toString() }
      })
      .subscribe(() => {
        const selectedItems = this.selectedItems();
        this.inMemoryItems.update(items => items.filter(item => !selectedItems.has(item.name)));
        this.selectedItems.set(new Map());
      });
  }

  moveSelectedItemsToGroup() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id!);
    if (itemIds.length === 0) return;

    const modalRef = this.modalService.open(SelectGroupModalComponent, { backdrop: 'static' });
    const component: SelectGroupModalComponent = modalRef.componentInstance;
    component.prepare(this.itemGroups, this.scanModes(), this.manifest()!);

    modalRef.result.subscribe((groupId: string) => {
      const group = this.inMemoryGroups().find(element => element.id === groupId);
      const selectedItems = this.selectedItems();
      this.inMemoryItems.update(items =>
        items.map(item =>
          selectedItems.has(item.name) ? { ...item, groupId: group?.id || null, groupName: group?.standardSettings.name || null } : item
        )
      );
      this.selectedItems.set(new Map());
    });
  }

  getGroupName(item: SouthConnectorItemCommandDTO): string {
    return item.groupName || this.translateService.instant('south.items.group-none');
  }

  /** Looks up the in-memory group for an item (null when the item has no group). */
  getTooltipGroup(item: SouthConnectorItemCommandDTO): SouthItemGroupCommandDTO | null {
    if (!item.groupId) return null;
    return this.inMemoryGroups().find(g => g.id === item.groupId) ?? null;
  }

  /**
   * Returns the scan mode name that is effectively active for the item.
   * - Item in a group and synced → group's scan mode.
   * - Otherwise (no group) → item's own scan mode.
   */
  getEffectiveScanModeName(item: SouthConnectorItemCommandDTO): string {
    if (item.scanModeId === 'subscription') {
      return this.translateService.instant('scan-mode.subscription');
    }
    if (item.groupId) {
      const group = this.inMemoryGroups().find(g => g.id === item.groupId);
      if (group) {
        return this.scanModes().find(s => s.id === group.standardSettings.scanModeId)?.name ?? item.scanModeName ?? '';
      }
    }
    return item.scanModeName ?? '';
  }

  protected readonly asFormGroup = asFormGroup;
}
