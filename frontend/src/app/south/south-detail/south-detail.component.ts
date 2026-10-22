import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { NgbDropdownItem, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemGroupDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { AuditEntityType } from '@oibus/shared/domain/audit.model';

import { LogsComponent } from '../../logs/logs.component';
import { CertificateService } from '../../services/certificate.service';
import { ConfigurationWorkflowService } from '../../services/configuration-workflow.service';
import { EngineService } from '../../services/engine.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { ExploreButtonComponent } from '../../shared/explore-button/explore-button.component';
import { ExportItemModalComponent } from '../../shared/export-item-modal/export-item-modal.component';
import { findItemIndex } from '../../shared/find-item-index';
import { OIBusSettingsSummaryComponent } from '../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { SettingSummary, summarizeSettings } from '../../shared/form/oibus-settings-summary/settings-summary';
import { ItemsMenuComponent } from '../../shared/items-menu/items-menu.component';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { PageLoader } from '../../shared/page-loader.service';
import { pollMetrics } from '../../shared/polling';
import { isScanModeWindowExpired } from '../../shared/scan-mode-schedule.pipe';
import { SouthExploreModalComponent, SouthExploreResult } from '../../shared/south-explore-modal/south-explore-modal.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { AddDiscoveredItemsModalComponent } from '../south-items/add-discovered-items-modal/add-discovered-items-modal.component';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { SaveGroupCommand, SouthItemGroup, SouthItemGroups } from '../south-items/south-item-groups';
import { ViewSouthItemModalComponent } from '../south-items/view-south-item-modal/view-south-item-modal.component';
import ManageWorkflowsModalComponent from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { exploreCheckedActions, WorkflowCreationService } from '../south-workflows/workflow-creation.service';
import { SouthMetricsComponent } from './south-metrics/south-metrics.component';

/** The group column is added by the page: the other columns are sorted by the item table. */
function sortValue(item: SouthConnectorItemDTO, column: string): string | number {
  return column === 'group' ? item.group?.standardSettings.name || '' : builtInSortValue(item, column);
}

import { builtInSortValue, ItemSelection } from '../../shared/item-table/item-table';
import { ItemTableComponent } from '../../shared/item-table/item-table.component';
import { ITEM_TABLE_TEMPLATES } from '../../shared/item-table/item-table-templates';

@Component({
  selector: 'oib-south-detail',
  imports: [
    TranslateDirective,
    RouterLink,
    SouthMetricsComponent,
    ClipboardModule,
    LogsComponent,
    OIBusSouthTypeEnumPipe,
    TranslatePipe,
    NgbTooltip,
    FormsModule,
    OibHelpComponent,
    ReactiveFormsModule,
    NgbDropdownItem,
    ItemTableComponent,
    ...ITEM_TABLE_TEMPLATES,
    OIBusSettingsSummaryComponent,
    ExploreButtonComponent,
    ItemsMenuComponent,
    NgTemplateOutlet
  ],
  templateUrl: './south-detail.component.html',
  styleUrl: './south-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader]
})
export class SouthDetailComponent {
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly configurationWorkflowService = inject(ConfigurationWorkflowService);
  private readonly workflowCreationService = inject(WorkflowCreationService);
  private readonly engineService = inject(EngineService);
  private readonly translateService = inject(TranslateService);
  private readonly docsUrlService = inject(DocsUrlService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly itemSectionHelpUrl = this.docsUrlService.resolve('guide/south-connectors/common-settings#item-section');

  readonly scanModes = toSignal(this.scanModeService.list(), { initialValue: [] });
  readonly certificates = toSignal(this.certificateService.list(), { initialValue: [] });
  readonly oibusInfo = toSignal(this.engineService.info$, { initialValue: null });

  private readonly southId = toSignal(this.route.paramMap.pipe(map(params => params.get('southId'))), { initialValue: null });
  private readonly southConnectorResource = rxResource({
    params: () => this.southId() ?? undefined,
    stream: ({ params: southId }) => this.southConnectorService.findById(southId)
  });
  readonly southConnector = computed(() => (this.southConnectorResource.hasValue() ? this.southConnectorResource.value() : null));
  private readonly manifestResource = rxResource({
    params: () => this.southConnector()?.type,
    stream: ({ params: type }) => this.southConnectorService.getSouthManifest(type)
  });
  readonly manifest = computed(() => (this.manifestResource.hasValue() ? this.manifestResource.value() : null));
  /** The items synchronisations of a connector with discovery, counted on the Explore button */
  private readonly workflowsResource = rxResource({
    params: () => (this.manifest()?.discovery ? this.southConnector()?.id : undefined),
    stream: ({ params: southId }) => this.configurationWorkflowService.list(southId)
  });
  /** How many items synchronisations the connector has; null when it has no discovery */
  readonly workflowCount = computed(() => {
    if (!this.manifest()?.discovery) {
      return null;
    }
    return this.workflowsResource.hasValue() ? this.workflowsResource.value().length : 0;
  });

  /** The settings of the connector, summed up from its manifest: its status shows in the header of the page */
  readonly displayedSettings = computed<Array<SettingSummary>>(() => {
    const manifest = this.manifest();
    const southConnector = this.southConnector();
    if (!manifest || !southConnector) {
      return [];
    }
    return summarizeSettings(manifest.settings, southConnector.settings, {
      translateService: this.translateService,
      scanModes: this.scanModes(),
      certificates: this.certificates(),
      applyEnablingConditions: true
    });
  });

  // the metrics are polled once the connector and its manifest are loaded
  private readonly metricsSouthId = computed(() => (this.manifest() ? (this.southConnector()?.id ?? null) : null));
  readonly connectorMetrics = toSignal(
    toObservable(this.metricsSouthId).pipe(
      switchMap(southId => (southId ? pollMetrics(() => this.southConnectorService.getMetrics(southId)) : of(null)))
    ),
    { initialValue: null }
  );

  // --- Items table: the group and scan mode filters are added to the name and status filters of the table ---
  readonly groupFilterControl = this.fb.control(null as string | null);
  readonly scanModeFilterControl = this.fb.control(null as string | null);
  private readonly groupFilter = toSignal(this.groupFilterControl.valueChanges, { initialValue: null });
  private readonly scanModeFilter = toSignal(this.scanModeFilterControl.valueChanges, { initialValue: null });
  readonly itemFilter = computed(() => {
    const groupFilter = this.groupFilter();
    const scanModeFilter = this.scanModeFilter();
    return (item: SouthConnectorItemDTO) => {
      if (groupFilter === 'none' && item.group) return false;
      if (groupFilter && groupFilter !== 'none' && item.group?.id !== groupFilter) return false;
      const effectiveScanModeId = item.group ? item.group.standardSettings.scanMode.id : item.scanMode?.id;
      return !scanModeFilter || effectiveScanModeId === scanModeFilter;
    };
  });
  /** The items of the connector, as an array of the item union type (the DTO is typed by connector type) */
  readonly items = computed<Array<SouthConnectorItemDTO>>(() => this.southConnector()?.items ?? []);
  protected readonly itemSortValue = sortValue;
  private readonly itemTable = viewChild(ItemTableComponent);

  /** The groups, as given to the modals that list or change them: saved through the API, then the connector is reloaded */
  private readonly itemGroups: SouthItemGroups = {
    list: computed(() => this.southConnector()?.groups ?? []),
    save: command => this.addOrEditGroup(command),
    delete: group => this.deleteGroup(group)
  };

  // Mass action properties
  readonly selectedItems = signal<ItemSelection<SouthConnectorItemDTO>>(new Map());

  /** The item currently hovered in the list — drives the schedule details tooltip. */
  readonly tooltipItem = signal<SouthConnectorItemDTO | null>(null);

  /** Whether the scan mode driving an item has an activation window that can never fire again. */
  isWindowExpired(scanMode: ScanModeDTO | null | undefined): boolean {
    return isScanModeWindowExpired(scanMode);
  }

  /** Displays the connector reloaded after a change. */
  private refresh(southConnector: SouthConnectorDTO) {
    this.southConnectorResource.set(southConnector);
  }

  addItem() {
    this.openItemCreation(null);
  }

  /**
   * Opens the modal for a new item, and again after each item saved with "save and add another".
   * @param previousItem the item added just before, whose shared settings the new one starts with
   */
  private openItemCreation(previousItem: SouthConnectorItemCommandDTO | null) {
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
      this.southConnector()!.items,
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      this.southConnector()!.id,
      this.southConnectorCommand,
      previousItem
    );
    let savedItem: SouthConnectorItemCommandDTO;
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          savedItem = command;
          return this.southConnectorService.createItem(this.southConnector()!.id, {
            id: command.id,
            name: command.name,
            enabled: command.enabled,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            startTimeOffset: command.startTimeOffset,
            endTimeOffset: command.endTimeOffset,
            recoveryStrategy: command.recoveryStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.refresh(southConnector);
        this.notificationService.success(`south.items.created`);
        // the connector reloaded above holds the item just added, so that the next one can't take its name
        if (component.addAnother) {
          this.openItemCreation(savedItem);
        }
      });
  }

  duplicateItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, { size: 'xl', backdrop: 'static' });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;
    component.prepareForCopy(
      this.southConnector()!.items,
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      item,
      this.southConnector()!.id,
      this.southConnectorCommand
    );
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          return this.southConnectorService.createItem(this.southConnector()!.id, {
            id: command.id || null,
            name: command.name,
            enabled: command.enabled,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            startTimeOffset: command.startTimeOffset,
            endTimeOffset: command.endTimeOffset,
            recoveryStrategy: command.recoveryStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.refresh(southConnector);
        this.notificationService.success(`south.items.created`);
      });
  }

  editItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(EditSouthItemModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditSouthItemModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditSouthItemModalComponent = modalRef.componentInstance;

    const tableIndex = findItemIndex(this.southConnector()!.items, item);
    component.prepareForEdition(
      this.southConnector()!.items,
      this.scanModes(),
      this.certificates(),
      this.itemGroups,
      this.manifest()!,
      item,
      this.southConnector()!.id,
      this.southConnectorCommand,
      tableIndex
    );
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          return this.southConnectorService.updateItem(this.southConnector()!.id, command.id!, {
            id: command.id,
            enabled: command.enabled,
            name: command.name,
            settings: command.settings,
            scanModeId: command.scanModeId,
            scanModeName: command.scanModeName,
            groupId: command.groupId,
            groupName: command.groupName,
            syncWithGroup: command.syncWithGroup,
            maxReadInterval: command.maxReadInterval,
            readDelay: command.readDelay,
            startTimeOffset: command.startTimeOffset,
            endTimeOffset: command.endTimeOffset,
            recoveryStrategy: command.recoveryStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval
          } as SouthConnectorItemCommandDTO);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.refresh(southConnector);
        this.notificationService.success(`south.items.updated`);
      });
  }

  deleteItem(item: SouthConnectorItemDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-deletion'
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteItem(this.southConnector()!.id, item.id!);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.refresh(southConnector);
        this.notificationService.success('south.items.deleted');
      });
  }

  deleteAllItems() {
    this.confirmationService
      .confirm({
        messageKey: 'south.items.confirm-delete-all'
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteAllItems(this.southConnector()!.id);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.refresh(southConnector);
        this.itemTable()?.goToFirstPage();
        this.notificationService.success('south.items.all-deleted');
      });
  }

  exportItems() {
    const modalRef = this.modalService.open(ExportItemModalComponent, { backdrop: 'static' });
    const filename = this.southConnector()!.name;
    modalRef.componentInstance.prepare(filename);
    modalRef.result.subscribe(response => {
      if (response) {
        this.southConnectorService.exportItems(this.southConnector()!.id, response.filename, response.delimiter).subscribe();
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
      this.southConnectorService
        .checkImportItems(this.manifest()!.id, this.southConnector()!.items, file, delimiter, deleteItemsNotPresent)
        .pipe(
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
        this.southConnector()!
          .items.map(item => ('topic' in item.settings ? item.settings.topic : undefined))
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
      this.southConnectorService
        .importItems(this.southConnector()!.id, response.items, response.eraseExisting)
        .pipe(
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector()!.id);
          })
        )
        .subscribe(southConnector => {
          this.refresh(southConnector);
          this.itemTable()?.goToFirstPage();
          this.notificationService.success(`south.items.import.imported`);
        });
    });
  }

  addOrEditGroup(command: SaveGroupCommand): Observable<SouthItemGroupDTO> {
    if (command.mode === 'create') {
      return this.southConnectorService.createGroup(this.southConnector()!.id, command.group).pipe(
        switchMap(createdGroup =>
          this.southConnectorService.findById(this.southConnector()!.id).pipe(map(southConnector => ({ southConnector, createdGroup })))
        ),
        tap(({ southConnector }) => {
          this.refresh(southConnector);
          this.notificationService.success('south.groups.created');
        }),
        map(({ createdGroup }) => createdGroup)
      );
    } else {
      return this.southConnectorService.updateGroup(this.southConnector()!.id, command.group!.id!, command.group).pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        }),
        tap(southConnector => {
          this.refresh(southConnector);
        }),
        switchMap(southConnector => {
          return this.southConnectorService.getGroup(southConnector.id, command.group!.id!);
        }),
        tap(() => {
          this.notificationService.success('south.groups.updated');
        })
      );
    }
  }

  deleteGroup(group: SouthItemGroup): Observable<void> {
    return this.confirmationService
      .confirm({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: group.standardSettings.name }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteGroup(this.southConnector()!.id, group.id!);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        }),
        tap({
          next: southConnector => {
            this.refresh(southConnector);
            this.notificationService.success('south.groups.deleted');
          },
          error: error => {
            this.notificationService.error('south.groups.delete-error', { error: error.message });
          }
        }),
        map(() => undefined)
      );
  }

  // Mass action methods
  unselectAll() {
    this.selectedItems.set(new Map());
  }

  enableSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.southConnectorService
      .enableItems(this.southConnector()!.id, itemIds)
      .pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.set(new Map());
        this.refresh(southConnector);
        this.notificationService.success('south.items.enabled-multiple', { count: itemIds.length.toString() });
      });
  }

  disableSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.southConnectorService
      .disableItems(this.southConnector()!.id, itemIds)
      .pipe(
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.set(new Map());
        this.refresh(southConnector);
        this.notificationService.success('south.items.disabled-multiple', { count: itemIds.length.toString() });
      });
  }

  deleteSelectedItems() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id);
    if (itemIds.length === 0) return;
    this.confirmationService
      .confirm({
        messageKey: 'south.items.delete-multiple-message',
        interpolateParams: { count: this.selectedItems().size.toString() }
      })
      .pipe(
        switchMap(() => {
          return this.southConnectorService.deleteItems(this.southConnector()!.id, itemIds);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.set(new Map());
        this.refresh(southConnector);
        this.notificationService.success('south.items.deleted-multiple', { count: itemIds.length.toString() });
      });
  }

  moveSelectedItemsToGroup() {
    const itemIds = Array.from(this.selectedItems().values(), item => item.id!);
    if (itemIds.length === 0) return;

    const modalRef = this.modalService.open(SelectGroupModalComponent, { backdrop: 'static' });
    const component: SelectGroupModalComponent = modalRef.componentInstance;
    component.prepare(this.itemGroups, this.scanModes(), this.manifest()!);

    modalRef.result
      .pipe(
        switchMap((groupId: string) => {
          return this.southConnectorService.moveItemsToGroup(this.southConnector()!.id, itemIds, groupId);
        }),
        switchMap(() => {
          return this.southConnectorService.findById(this.southConnector()!.id);
        })
      )
      .subscribe(southConnector => {
        this.selectedItems.set(new Map());
        this.refresh(southConnector);
        this.notificationService.success('south.items.moved-to-group', { count: itemIds.length.toString() });
      });
  }

  manageGroups() {
    const modalRef = this.modalService.open(ManageGroupsModalComponent, { size: 'lg', backdrop: 'static' });
    const component: ManageGroupsModalComponent = modalRef.componentInstance;
    component.prepare(
      this.itemGroups,
      this.scanModes(),
      this.manifest()!,
      true,
      groupId => this.southConnector()!.items.filter(item => item.group?.id === groupId).length
    );
  }

  manageWorkflows() {
    const modalRef = this.modalService.open(ManageWorkflowsModalComponent, { size: 'xl', backdrop: 'static' });
    const component: ManageWorkflowsModalComponent = modalRef.componentInstance;
    component.prepareForDirectSave(
      this.southConnector()!.id,
      this.southConnector()!.settings,
      this.scanModes(),
      this.manifest()!,
      this.itemGroups,
      () => this.reloadAfterWorkflowRun()
    );
    modalRef.result.subscribe(() => this.workflowsResource.reload());
  }

  /** A manual workflow run may have created/updated items directly on this connector - reload it so
   *  the item list reflects them without the user needing to leave and come back to this page. */
  private reloadAfterWorkflowRun() {
    this.southConnectorService.findById(this.southConnector()!.id).subscribe(southConnector => {
      this.refresh(southConnector);
    });
  }

  /** Displays the item, with what its cache holds, and edits it if the user chooses to */
  viewItem(item: SouthConnectorItemDTO) {
    const modalRef = this.modalService.open(ViewSouthItemModalComponent, { size: 'lg' });
    const component: ViewSouthItemModalComponent = modalRef.componentInstance;
    component.prepare(item, this.southConnector()!, this.manifest()!, this.scanModes(), this.certificates());

    this.southConnectorService.getItemLastValue(this.southConnector()!.id, item.id).subscribe({
      next: response => component.setData(response),
      error: error => component.setError(error.message)
    });
    modalRef.result.subscribe(() => this.editItem(item));
  }

  testConnection() {
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest('south', this.southConnector()!.id, this.southConnector()!.settings, this.southConnector()!.type);
  }

  /**
   * Browses the data source - and, with tree-based discovery, offers to keep items in sync with the checked nodes
   * through a Configuration Workflow (saved through the API, like the Manage workflows modal), and with discovery
   * defaults, to add them as items once.
   */
  explore() {
    const southConnector = this.southConnector()!;
    const manifest = this.manifest()!;
    const modalRef = this.modalService.open(SouthExploreModalComponent, { size: 'xl' });
    const component: SouthExploreModalComponent = modalRef.componentInstance;
    component.prepare(southConnector.id, southConnector.settings, southConnector.type, { checkedActions: exploreCheckedActions(manifest) });
    modalRef.result
      .pipe(
        switchMap((result: SouthExploreResult) =>
          result.action === 'add-items'
            ? this.addDiscoveredItems(result.nodeIds)
            : // The other workflows of the connector are only needed for the name uniqueness check
              this.configurationWorkflowService.list(southConnector.id).pipe(
                switchMap(workflows =>
                  this.workflowCreationService.createFromExploredNodes(
                    {
                      directSave: true,
                      southId: southConnector.id,
                      southSettings: southConnector.settings,
                      scanModes: this.scanModes(),
                      manifest,
                      groups: this.itemGroups,
                      existingWorkflows: workflows
                    },
                    result.nodeIds
                  )
                ),
                tap(() => this.workflowsResource.reload())
              )
        )
      )
      .subscribe();
  }

  /** Reviews the items the checked nodes give, then creates them and reloads the connector. */
  private addDiscoveredItems(nodeIds: Array<string>): Observable<unknown> {
    const southConnector = this.southConnector()!;
    const modalRef = this.modalService.open(AddDiscoveredItemsModalComponent, { size: 'xl', backdrop: 'static' });
    const component: AddDiscoveredItemsModalComponent = modalRef.componentInstance;
    component.prepare({
      southId: southConnector.id,
      southSettings: southConnector.settings,
      manifest: this.manifest()!,
      schedule: { scanModes: this.scanModes(), groups: this.itemGroups },
      existingItems: southConnector.items,
      nodeIds
    });
    return modalRef.result.pipe(
      switchMap((commands: Array<SouthConnectorItemCommandDTO>) =>
        this.southConnectorService.importItems(southConnector.id, commands).pipe(
          switchMap(() => this.southConnectorService.findById(southConnector.id)),
          tap(updatedSouthConnector => {
            this.refresh(updatedSouthConnector);
            this.itemTable()?.goToFirstPage();
            this.notificationService.success('south.add-discovered-items.added', { count: String(commands.length) });
          })
        )
      )
    );
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.southConnectorService
        .start(this.southConnector()!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.started', { name: this.southConnector()!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector()!.id);
          })
        )
        .subscribe(southConnector => {
          this.refresh(southConnector);
        });
    } else {
      this.southConnectorService
        .stop(this.southConnector()!.id)
        .pipe(
          tap(() => {
            this.notificationService.success('south.stopped', { name: this.southConnector()!.name });
          }),
          switchMap(() => {
            return this.southConnectorService.findById(this.southConnector()!.id);
          })
        )
        .subscribe(southConnector => {
          this.refresh(southConnector);
        });
    }
  }

  onClipboardCopy(result: boolean) {
    if (result) {
      this.notificationService.success('south.cache-path-copy.success');
    } else {
      this.notificationService.error('south.cache-path-copy.error');
    }
  }

  get southConnectorCommand() {
    return {
      ...this.southConnector()!,
      items: this.southConnector()!.items.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanModeId: item.scanMode?.id || null,
        scanModeName: null,
        groupId: item.group?.id || null,
        groupName: null,
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
      })),
      groups: this.southConnector()!.groups.map(group => ({
        id: group.id,
        standardSettings: {
          name: group.standardSettings.name,
          scanModeId: group.standardSettings.scanMode.id
        },
        historySettings: {
          maxReadInterval: group.historySettings.maxReadInterval,
          readDelay: group.historySettings.readDelay,
          startTimeOffset: group.historySettings.startTimeOffset,
          endTimeOffset: group.historySettings.endTimeOffset,
          recoveryStrategy: group.historySettings.recoveryStrategy,
          cachingStrategy: group.historySettings.cachingStrategy
        }
      })),
      // Only ever used to test items against the connector's settings - never sent as an update of the
      // connector itself (which would then sync its workflows to this list), so they aren't loaded here.
      configurationWorkflows: []
    } as SouthConnectorCommandDTO;
  }

  /**
   * Open a modal to view the audit history of the connector or one of its items
   */
  showAudit(entityType: Extract<AuditEntityType, 'south_connector' | 'south_item'>, entityId: string) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(entityType, entityId);
  }
}
