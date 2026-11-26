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
import { AuditInfoComponent } from '../../shared/audit-info/audit-info.component';
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
import { SectionAnchorDirective } from '../../shared/section-anchor/section-anchor.directive';
import { SectionLinkComponent } from '../../shared/section-anchor/section-link.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import EditSouthItemModalComponent from '../south-items/edit-south-item-modal/edit-south-item-modal.component';
import { ImportSouthItemsModalComponent } from '../south-items/import-south-items-modal/import-south-items-modal.component';
import ManageGroupsModalComponent from '../south-items/manage-groups-modal/manage-groups-modal.component';
import { SelectGroupModalComponent } from '../south-items/select-group-modal/select-group-modal.component';
import { SaveGroupCommand, SouthItemGroup, SouthItemGroups } from '../south-items/south-item-groups';
import { ViewSouthItemModalComponent } from '../south-items/view-south-item-modal/view-south-item-modal.component';
import { openExploreWizard } from '../south-workflows/edit-workflow-modal/edit-workflow-modal.component';
import ManageWorkflowsModalComponent, {
  ExploreAndSyncResult
} from '../south-workflows/manage-workflows-modal/manage-workflows-modal.component';
import { SouthMetricsComponent } from './south-metrics/south-metrics.component';

/** The group column is added by the page: the other columns are sorted by the item table. */
function sortValue(item: SouthConnectorItemDTO, column: string): string | number {
  return column === 'group' ? item.group?.standardSettings.name || '' : builtInSortValue(item, column);
}

import { PresentedServerIdentity, ServerIdentity } from '@oibus/shared/domain/server-identity.model';

import { builtInSortValue, ItemSelection, itemTableParams } from '../../shared/item-table/item-table';
import { ItemTableComponent } from '../../shared/item-table/item-table.component';
import { ITEM_TABLE_TEMPLATES } from '../../shared/item-table/item-table-templates';
import { toDisplayedServerTrust } from '../../shared/server-trust/server-trust';
import { askServerTrust, reviewServerIdentity } from '../../shared/server-trust/server-trust-modal/server-trust-modal.component';
import { ServerTrustPanelComponent } from '../../shared/server-trust/server-trust-panel/server-trust-panel.component';
import { ITEM_LINK_PARAM, optionalParam, paramValue, UrlState } from '../../shared/url-state';

/** Prefix of the query params of the items table, distinct from the ones of the logs of the connector, on the same page */
const ITEM_PARAMS_PREFIX = 'items';
/** The query params of the filters added to the items table: the group and the scan mode of the items */
const ITEM_PARAMS = {
  ...itemTableParams(ITEM_PARAMS_PREFIX),
  group: optionalParam(`${ITEM_PARAMS_PREFIX}Group`),
  scanMode: optionalParam(`${ITEM_PARAMS_PREFIX}ScanMode`)
};

@Component({
  selector: 'oib-south-detail',
  imports: [
    SectionAnchorDirective,
    SectionLinkComponent,
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
    NgTemplateOutlet,
    AuditInfoComponent,
    ServerTrustPanelComponent
  ],
  templateUrl: './south-detail.component.html',
  styleUrl: './south-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader, UrlState]
})
export class SouthDetailComponent {
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly configurationWorkflowService = inject(ConfigurationWorkflowService);
  private readonly engineService = inject(EngineService);
  private readonly translateService = inject(TranslateService);
  private readonly docsUrlService = inject(DocsUrlService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly urlState = inject(UrlState);

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

  /** Bumped to read again the trust of the connector in the identity of its server, once a user trusted it */
  private readonly serverTrustRefresh = signal(0);
  private readonly serverTrustSouthId = computed(() =>
    this.manifest()?.serverIdentity ? { southId: this.southConnector()?.id ?? null, refresh: this.serverTrustRefresh() } : null
  );
  /** The trust of the connector in the identity of its server, with the identity it refused, polled as the metrics */
  private readonly polledServerTrust = toSignal(
    toObservable(this.serverTrustSouthId).pipe(
      switchMap(target => (target?.southId ? pollMetrics(() => this.southConnectorService.getServerTrust(target.southId!)) : of(null)))
    ),
    { initialValue: null }
  );
  /** The trust shown on the page (see toDisplayedServerTrust) */
  readonly serverTrust = computed(() => toDisplayedServerTrust(this.polledServerTrust(), this.southConnector()?.enabled ?? false));

  // --- Items table: the group and scan mode filters are added to the name and status filters of the table ---
  // They are kept in the URL with the filters of the table (see ITEM_PARAMS)
  readonly groupFilterControl = this.fb.control(null as string | null);
  readonly scanModeFilterControl = this.fb.control(null as string | null);
  /** The group filtered on: `none` for the items without group, null for all; a group that does not exist (anymore) is ignored */
  private readonly groupFilter = computed(() => {
    const groupFilter = this.urlState.value(ITEM_PARAMS.group);
    const groups = this.southConnector()?.groups;
    return groupFilter === 'none' || (groupFilter && groups?.some(group => group.id === groupFilter)) ? groupFilter : null;
  });
  /** The scan mode filtered on, null for all; a scan mode that does not exist (anymore) is ignored */
  private readonly scanModeFilter = computed(() => {
    const scanModeFilter = this.urlState.value(ITEM_PARAMS.scanMode);
    return scanModeFilter && this.scanModes().some(scanMode => scanMode.id === scanModeFilter) ? scanModeFilter : null;
  });
  /** True when the group or scan mode filter hides items */
  readonly extraItemFiltered = computed(() => !!this.groupFilter() || !!this.scanModeFilter());
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
  protected readonly itemParamsPrefix = ITEM_PARAMS_PREFIX;
  protected readonly itemSortValue = sortValue;
  private readonly itemTable = viewChild(ItemTableComponent);

  constructor() {
    const firstPage = () => paramValue(ITEM_PARAMS.page, 0);
    this.urlState.syncControl(ITEM_PARAMS.group, this.groupFilterControl, { otherChanges: firstPage });
    this.urlState.syncControl(ITEM_PARAMS.scanMode, this.scanModeFilterControl, { otherChanges: firstPage });
    this.urlState.openLinked<SouthConnectorItemDTO>(
      ITEM_LINK_PARAM,
      () => (this.manifest() ? (this.southConnector()?.items ?? null) : null),
      item => this.viewItem(item)
    );
  }

  /** Resets the group and scan mode filters, when the filters of the items table are reset */
  resetItemExtraFilters() {
    this.urlState.patch({ ...paramValue(ITEM_PARAMS.group, null), ...paramValue(ITEM_PARAMS.scanMode, null) });
  }

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
  private openItemCreation(previousItem: SouthConnectorItemCommandDTO | null, prefill: SouthConnectorItemCommandDTO | null = null) {
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
      previousItem,
      prefill
    );
    let savedItem: SouthConnectorItemCommandDTO;
    modalRef.result
      .pipe(
        switchMap((command: SouthConnectorItemCommandDTO) => {
          savedItem = command;
          return this.southConnectorService.createItem(this.southConnector()!.id, {
            id: command.id,
            name: command.name,
            description: command.description,
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
            emptyIntervalStrategy: command.emptyIntervalStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval,
            northTransformers: command.northTransformers
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
            description: command.description,
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
            emptyIntervalStrategy: command.emptyIntervalStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval,
            northTransformers: command.northTransformers
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
            description: command.description,
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
            emptyIntervalStrategy: command.emptyIntervalStrategy,
            cachingStrategy: command.cachingStrategy,
            thresholdType: command.thresholdType,
            threshold: command.threshold,
            rangeLow: command.rangeLow,
            rangeHigh: command.rangeHigh,
            maxCachingInterval: command.maxCachingInterval,
            northTransformers: command.northTransformers
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
      'description',
      'group',
      'maxReadInterval',
      'readDelay',
      'startTimeOffset',
      'endTimeOffset',
      'recoveryStrategy',
      'emptyIntervalStrategy',
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
                  description: item.description,
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
                  emptyIntervalStrategy: item.emptyIntervalStrategy,
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
      this.southConnector()!.items,
      () => this.reloadAfterWorkflowRun(),
      // the items the wizard of the modal adds are created before it closes: it stays open when they can't be
      commands => this.addDiscoveredItems(commands)
    );
    modalRef.result.subscribe((result: ExploreAndSyncResult | undefined) => {
      this.workflowsResource.reload();
      if (result?.kind === 'item') {
        // the item the tables checked give, which the item modal completes
        this.openItemCreation(null, result.command);
      }
    });
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
    this.urlState.showInUrl(ITEM_LINK_PARAM, item.id, modalRef.result);
  }

  testConnection() {
    const southConnector = this.southConnector()!;
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    if (this.manifest()!.serverIdentity) {
      component.allowServerTrust({
        trusted: southConnector.serverTrust.identity,
        trust: identity => this.trustServerIdentity(identity)
      });
    }
    component.runTest('south', southConnector.id, southConnector.settings, southConnector.type);
  }

  /** Reviews the identity the connector refused, and trusts it if the user does */
  reviewServerIdentity(pending: PresentedServerIdentity) {
    askServerTrust(this.modalService, 'review', pending, this.serverTrust()?.identity ?? null)
      .pipe(switchMap(() => this.trustServerIdentity(pending.identity)))
      .subscribe();
  }

  /** Trusts the identity the server presents (the connector restarts with it) */
  private trustServerIdentity(identity: ServerIdentity): Observable<void> {
    const southConnector = this.southConnector()!;
    return this.southConnectorService.trustServerIdentity(southConnector.id, identity.fingerprint).pipe(
      tap(() => {
        this.notificationService.success('server-trust.trusted', { name: southConnector.name });
        this.serverTrustRefresh.update(refresh => refresh + 1);
      }),
      switchMap(() => this.southConnectorService.findById(southConnector.id)),
      tap(updatedSouthConnector => this.refresh(updatedSouthConnector)),
      map(() => undefined)
    );
  }

  /**
   * Before starting a connector checking the identity of its server: proposes to trust it when it must be reviewed. Starting
   * does not depend on reaching the server: the connector then waits until its server is trusted.
   */
  private reviewServerIdentityBeforeStart(): Observable<void> {
    const southConnector = this.southConnector()!;
    if (!this.manifest()!.serverIdentity) {
      return of(undefined);
    }
    return reviewServerIdentity(
      this.modalService,
      'start',
      this.southConnectorService.retrieveServerIdentity(southConnector.id, southConnector.settings, southConnector.type),
      southConnector.serverTrust,
      southConnector.serverTrust.identity
    ).pipe(switchMap(identity => (identity ? this.trustServerIdentity(identity) : of(undefined))));
  }

  /**
   * Explore and sync: with discovery, the home of the data source lists the items synchronisations (saved through the API,
   * see `manageWorkflows`) and starts exploring it; otherwise the data source is only browsed.
   */
  explore() {
    const southConnector = this.southConnector()!;
    if (this.manifest()!.discovery) {
      this.manageWorkflows();
      return;
    }
    openExploreWizard(this.modalService, {
      southId: southConnector.id,
      exploreConnectorId: southConnector.id,
      southSettings: southConnector.settings,
      manifest: this.manifest()!,
      schedule: { scanModes: this.scanModes(), groups: this.itemGroups },
      existingItems: southConnector.items
    }).subscribe();
  }

  /** Creates the items of the wizard and reloads the connector. */
  private addDiscoveredItems(commands: Array<SouthConnectorItemCommandDTO>): Observable<unknown> {
    const southConnector = this.southConnector()!;
    return this.southConnectorService.importItems(southConnector.id, commands).pipe(
      switchMap(() => this.southConnectorService.findById(southConnector.id)),
      tap(updatedSouthConnector => {
        this.refresh(updatedSouthConnector);
        this.itemTable()?.goToFirstPage();
        this.notificationService.success('south.add-discovered-items.added', { count: String(commands.length) });
      })
    );
  }

  toggleConnector(value: boolean) {
    if (value) {
      this.reviewServerIdentityBeforeStart()
        .pipe(
          switchMap(() => this.southConnectorService.start(this.southConnector()!.id)),
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
        description: item.description,
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
        emptyIntervalStrategy: item.emptyIntervalStrategy,
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
          emptyIntervalStrategy: group.historySettings.emptyIntervalStrategy,
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
