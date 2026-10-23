import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  WritableSignal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, FormsModule, NonNullableFormBuilder } from '@angular/forms';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthConnectorDTO, SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTO, TransformerDTOWithOptions, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';
import { DataSourceType } from '@oibus/shared/domain/transformer.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { AuditHistoryModalComponent } from '../../shared/audit-history-modal/audit-history-modal.component';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DocsUrlService } from '../../shared/docs-url.service';
import { addAttributeToForm, addEnablingConditions } from '../../shared/form/dynamic-form.builder';
import { ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { getAssociatedInputType } from '../../shared/utils/utils';
import { transformerName, transformerOptionsSummary } from '../north-summary';
import {
  EditNorthTransformerModalComponent,
  TransformerSourcePreset
} from './edit-north-transformer-modal/edit-north-transformer-modal.component';
import { ItemAction, NorthSouthTransformersComponent } from './north-south-transformers/north-south-transformers.component';
import {
  findDefaultTransformer,
  isSouthLevel,
  resolveItemRouting,
  southLevelTransformers,
  SouthTransformer,
  southTransformers,
  unusedTransformerIds
} from './transformer-routing';

/**
 * Whether the data of a source reaches the North: through a transformer for all of it, only for some of it (some items of
 * a south, some data sources of the OIBus API), or not at all. A source no standard transformer can send to the North is
 * dropped too: a custom transformer can still send it.
 */
export type SourceStatus = 'sent' | 'partial' | 'dropped';

/** A source of data for the North: a south, the OIBus API, or the OIAnalytics setpoints */
export interface SourceRow {
  key: string;
  dataSourceType: DataSourceType;
  south: SouthConnectorLightDTO | null;
  /** The transformers applying to all the data of the source (to every data source for the OIBus API) */
  transformers: Array<TransformerDTOWithOptions>;
  /** The transformers applying to some of it: groups or items of a south, data sources of the OIBus API */
  otherTransformers: Array<TransformerDTOWithOptions>;
  status: SourceStatus;
  /** The transformer to add in one click, when its default options are valid */
  quickTransformer: TransformerDTO | null;
}

@Component({
  selector: 'oib-north-transformers',
  imports: [
    NgTemplateOutlet,
    TranslateDirective,
    BoxComponent,
    FormsModule,
    TranslatePipe,
    BoxTitleDirective,
    OibHelpComponent,
    NgbTooltip,
    OIBusSouthTypeEnumPipe,
    NorthSouthTransformersComponent
  ],
  templateUrl: './north-transformers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './routing-rows.scss'
})
export class NorthTransformersComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalService = inject(ModalService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly translateService = inject(TranslateService);
  private readonly docsUrlService = inject(DocsUrlService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly helpUrl = this.docsUrlService.resolve('guide/north-connectors/common-settings#transformers');

  readonly northConnector = input<NorthConnectorDTO | null>(null);

  readonly inMemoryTransformersWithOptions = output<Array<TransformerDTOWithOptions> | null>();
  readonly saveChangesDirectly = input<boolean>(false);
  /** A box with its own title, or a section of the page, under a section title (on the edit pages) */
  readonly layout = input<'box' | 'section'>('box');

  readonly northManifest = input.required<NorthConnectorManifest>();
  readonly certificates = input.required<Array<CertificateDTO>>();
  readonly scanModes = input.required<Array<ScanModeDTO>>();
  readonly transformers = input.required<Array<TransformerDTO>>();

  // Local transformers: initialized from the edited connector and kept in sync with it, then updated in memory
  readonly transformersWithOptions = linkedSignal<NorthConnectorDTO | null, Array<TransformerDTOWithOptions>>({
    source: this.northConnector,
    computation: (connector, previous) => (connector ? [...connector.transformers] : (previous?.value ?? []))
  });
  private readonly southConnectors = toSignal(this.southConnectorService.list(), { initialValue: [] });

  readonly search = signal('');
  // The filters, as in the south list: no selected value keeps every source
  readonly activeStatuses = signal<Array<SourceStatus>>([]);
  readonly activeEnabledStates = signal<Array<boolean>>([]);
  readonly activeTypes = signal<Array<OIBusSouthType>>([]);
  readonly STATUSES: Array<{ status: SourceStatus; class: string }> = [
    { status: 'sent', class: 'routing-chip routing-sent' },
    { status: 'partial', class: 'routing-chip routing-partial' },
    { status: 'dropped', class: 'routing-chip routing-dropped' }
  ];
  // Each status pairs a distinct icon shape with its color, as in the south list
  readonly LEGEND: Array<{ label: string; enabled: boolean; class: string }> = [
    { label: 'south.disabled', enabled: false, class: 'fa-solid fa-minus-circle status-grey' },
    { label: 'south.enabled', enabled: true, class: 'fa-solid fa-check-circle status-green' }
  ];
  /** The types of the souths, to filter them */
  readonly types = computed(() => Array.from(new Set(this.southConnectors().map(south => south.type))).sort((a, b) => a.localeCompare(b)));
  readonly expandedSouths = signal<Set<string>>(new Set());
  readonly unusedTransformerIds = computed(() => unusedTransformerIds(this.transformersWithOptions()));
  /** The souths loaded with their groups and items: the expanded ones, and the ones whose items are not all sent the same way */
  readonly loadedSouths = signal<Map<string, SouthConnectorDTO>>(new Map());
  private readonly requestedSouthIds = new Set<string>();

  constructor() {
    // Whether all the items of a south are sent depends on its items when no transformer applies to all of them
    effect(() => {
      const transformers = this.transformersWithOptions();
      for (const south of this.southConnectors()) {
        if (dependsOnItems(southTransformers(transformers, south.id))) {
          untracked(() => this.loadSouth(south.id));
        }
      }
    });
  }

  readonly sources = computed<Array<SourceRow>>(() => {
    const transformers = this.transformersWithOptions();
    const rows: Array<SourceRow> = this.southConnectors().map(south => {
      const southLevel = southLevelTransformers(transformers, south.id);
      const others = southTransformers(transformers, south.id).filter(transformer => !southLevel.includes(transformer));
      const row = this.buildRow(south.id, 'south', south, getAssociatedInputType(south.type), southLevel, others);
      return { ...row, status: this.southStatus(south.id, row.status) };
    });
    const apiTransformers = transformers.filter(transformer => transformer.source.type === 'oibus-api');
    rows.push(
      this.buildRow(
        'oibus-api',
        'oibus-api',
        null,
        'any',
        apiTransformers.filter(transformer => transformer.source.type === 'oibus-api' && !transformer.source.dataSourceId),
        apiTransformers.filter(transformer => transformer.source.type === 'oibus-api' && !!transformer.source.dataSourceId)
      ),
      this.buildRow(
        'oianalytics-setpoint',
        'oianalytics-setpoint',
        null,
        'setpoint',
        transformers.filter(transformer => transformer.source.type === 'oianalytics-setpoint'),
        []
      )
    );
    return rows;
  });

  readonly counts = computed<Record<SourceStatus, number>>(() => {
    const sources = this.sources();
    return {
      sent: sources.filter(source => source.status === 'sent').length,
      partial: sources.filter(source => source.status === 'partial').length,
      dropped: sources.filter(source => source.status === 'dropped').length
    };
  });

  readonly filteredSources = computed(() => {
    const search = this.search().toLowerCase();
    const activeStatuses = this.activeStatuses();
    const activeEnabledStates = this.activeEnabledStates();
    const activeTypes = this.activeTypes();
    return this.sources().filter(
      source =>
        (activeStatuses.length === 0 || activeStatuses.includes(source.status)) &&
        // the OIBus API and the OIAnalytics setpoints have no status nor type
        (activeEnabledStates.length === 0 || (!!source.south && activeEnabledStates.includes(source.south.enabled))) &&
        (activeTypes.length === 0 || (!!source.south && activeTypes.includes(source.south.type))) &&
        this.sourceName(source).toLowerCase().includes(search)
    );
  });

  /** Adds a value to the values a filter keeps, or removes it */
  toggleFilter<T>(filter: WritableSignal<Array<T>>, value: T) {
    filter.update(values => (values.includes(value) ? values.filter(element => element !== value) : [...values, value]));
  }

  sourceName(source: SourceRow): string {
    return source.south ? source.south.name : this.translateService.instant(`enums.oibus-data-source-type.${source.dataSourceType}`);
  }

  name(transformer: TransformerDTOWithOptions | TransformerDTO): string {
    return transformerName('transformer' in transformer ? transformer.transformer : transformer, this.translateService);
  }

  /** The options of a transformer shown beside its name (e.g. the time precision of the OIAnalytics payloads) */
  options(transformer: TransformerDTOWithOptions): string {
    return transformerOptionsSummary(transformer, this.translateService);
  }

  /** What a transformer applies to, on the line of its source */
  scope(transformer: TransformerDTOWithOptions): string {
    if (transformer.source.type === 'oibus-api') {
      return transformer.source.dataSourceId
        ? transformer.source.dataSourceId
        : this.translateService.instant('configuration.oibus.manifest.transformers.all-data-sources');
    }
    if (transformer.source.type === 'south') {
      const excluded = transformer.source.excludedItems?.length ?? 0;
      return excluded
        ? this.translateService.instant('north.transformers.list.all-items-except', { count: excluded })
        : this.translateService.instant('configuration.oibus.manifest.transformers.all-items');
    }
    return '';
  }

  toggleSouth(source: SourceRow) {
    const expandedSouths = new Set(this.expandedSouths());
    if (expandedSouths.has(source.key)) {
      expandedSouths.delete(source.key);
    } else {
      expandedSouths.add(source.key);
      this.loadSouth(source.key);
    }
    this.expandedSouths.set(expandedSouths);
  }

  /** Opens the transformer modal, for the given source when there is one */
  addTransformer(preset: TransformerSourcePreset | null = null) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    component.directSave.set(this.saveChangesDirectly());
    component.prepareForCreation(
      this.southConnectors(),
      this.scanModes(),
      this.certificates(),
      this.transformers(),
      this.northManifest().types,
      preset
    );
    modalRef.result.subscribe((transformer: TransformerDTOWithOptions) => this.addOrMerge(transformer));
  }

  /** Adds the obvious transformer of a source with its default options, or lets the user configure it when they are not valid */
  quickAdd(source: SourceRow) {
    const transformer = source.quickTransformer!;
    const sourceDTO: TransformerSourceDTO =
      source.dataSourceType === 'south'
        ? { type: 'south', south: source.south!, items: [], excludedItems: [] }
        : source.dataSourceType === 'oibus-api'
          ? { type: 'oibus-api' }
          : { type: 'oianalytics-setpoint' };
    this.save({ id: `temp_${Date.now()}`, transformer, options: this.defaultOptions(transformer) ?? {}, source: sourceDTO }, 'added');
  }

  editTransformer(transformer: TransformerDTOWithOptions) {
    const modalRef = this.modalService.open(EditNorthTransformerModalComponent, {
      size: 'xl',
      beforeDismiss: () => {
        const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
        const result = component.canDismiss();
        return typeof result === 'boolean' ? result : firstValueFrom(result);
      }
    });
    const component: EditNorthTransformerModalComponent = modalRef.componentInstance;
    component.directSave.set(this.saveChangesDirectly());
    component.prepareForEdition(
      this.southConnectors(),
      this.scanModes(),
      this.certificates(),
      this.transformers(),
      this.northManifest().types,
      transformer
    );
    modalRef.result.subscribe((editedTransformer: TransformerDTOWithOptions) => this.save(editedTransformer, 'edited'));
  }

  deleteTransformer(transformer: TransformerDTOWithOptions) {
    this.confirmationService.confirm({ messageKey: `north.transformers.confirm-deletion` }).subscribe(() => {
      this.transformersWithOptions.update(transformersWithOptions =>
        transformersWithOptions.filter(element => element.id !== transformer.id)
      );
      if (this.saveChangesDirectly()) {
        this.northConnectorService.removeTransformer(this.northConnector()!.id, transformer.id).subscribe(() => {
          this.notificationService.success('north.transformers.removed');
          this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
        });
      } else {
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
      }
    });
  }

  /** Leaves an item out of the transformer of its group or of its south */
  excludeItem({ transformer, item }: ItemAction) {
    if (transformer.source.type !== 'south') return;
    this.save(
      { ...transformer, source: { ...transformer.source, excludedItems: [...(transformer.source.excludedItems ?? []), item] } },
      'edited'
    );
  }

  /** Removes an item from the list of a transformer, deleting the transformer when it was the last one */
  removeItem({ transformer, item }: ItemAction) {
    if (transformer.source.type !== 'south') return;
    const items = transformer.source.items.filter(element => element.id !== item.id);
    if (items.length === 0) {
      // A transformer without item would apply to all the items of the south
      this.deleteTransformer(transformer);
      return;
    }
    this.save({ ...transformer, source: { ...transformer.source, items } }, 'edited');
  }

  /**
   * Open a modal to view the audit history of a transformer of the north connector
   */
  showAudit(transformer: TransformerDTOWithOptions) {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare('north_transformer', transformer.id);
  }

  /**
   * Adds a transformer, or, when it applies to items already sent through the same transformer with the same options,
   * adds them to the list of that transformer, so that overriding items one by one does not multiply the transformers
   */
  private addOrMerge(transformer: TransformerDTOWithOptions) {
    const source = transformer.source;
    if (source.type === 'south' && source.items.length > 0 && !source.group) {
      const sameTransformer = southTransformers(this.transformersWithOptions(), source.south.id).find(
        candidate =>
          candidate.source.items.length > 0 &&
          !candidate.source.group &&
          candidate.transformer.id === transformer.transformer.id &&
          JSON.stringify(candidate.options) === JSON.stringify(transformer.options)
      );
      if (sameTransformer) {
        const newItems = source.items.filter(item => !sameTransformer.source.items.some(element => element.id === item.id));
        this.save(
          { ...sameTransformer, source: { ...sameTransformer.source, items: [...sameTransformer.source.items, ...newItems] } },
          'edited'
        );
        return;
      }
    }
    this.save(transformer, 'added');
  }

  /** Saves a transformer, through the API on the detail pages, in memory on the edit pages (kept at its place in the list) */
  private save(transformer: TransformerDTOWithOptions, change: 'added' | 'edited') {
    const northConnector = this.northConnector();
    if (northConnector && this.saveChangesDirectly()) {
      // remove temp_ id when creating directly
      const transformerToSave = change === 'added' ? { ...transformer, id: '' } : transformer;
      this.northConnectorService.addOrEditTransformer(northConnector.id, transformerToSave).subscribe(() => {
        this.notificationService.success(`north.transformers.${change}`);
        this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
      });
      return;
    }
    this.transformersWithOptions.update(transformersWithOptions =>
      change === 'added'
        ? [...transformersWithOptions, transformer]
        : transformersWithOptions.map(element => (element.id === transformer.id ? transformer : element))
    );
    this.inMemoryTransformersWithOptions.emit(this.transformersWithOptions());
  }

  private buildRow(
    key: string,
    dataSourceType: DataSourceType,
    south: SouthConnectorLightDTO | null,
    dataType: InputType,
    transformers: Array<TransformerDTOWithOptions>,
    otherTransformers: Array<TransformerDTOWithOptions>
  ): SourceRow {
    const northTypes = this.northManifest().types;
    let status: SourceStatus = 'dropped';
    if (transformers.length) {
      status = 'sent';
    } else if (otherTransformers.length) {
      status = 'partial';
    }
    const defaultTransformer = findDefaultTransformer(this.transformers(), dataType, northTypes);
    return {
      key,
      dataSourceType,
      south,
      transformers,
      otherTransformers,
      status,
      quickTransformer: defaultTransformer && this.defaultOptions(defaultTransformer) ? defaultTransformer : null
    };
  }

  private loadSouth(southId: string) {
    if (this.requestedSouthIds.has(southId)) return;
    this.requestedSouthIds.add(southId);
    this.southConnectorService.findById(southId).subscribe(southConnector => {
      this.loadedSouths.update(loadedSouths => new Map(loadedSouths).set(southId, southConnector));
    });
  }

  /**
   * Whether the items of a south are sent: all of them, some of them or none. Until its items are loaded, a south is sent
   * when a transformer applies to all its items, partly dropped otherwise.
   */
  private southStatus(southId: string, statusWithoutItems: SourceStatus): SourceStatus {
    const southConnector = this.loadedSouths().get(southId);
    const transformers = this.transformersWithOptions();
    if (!southConnector || !dependsOnItems(southTransformers(transformers, southId))) return statusWithoutItems;
    const sentItems = southConnector.items.filter(item =>
      resolveItemRouting(transformers, southId, { id: item.id, groupId: item.group?.id ?? null })
    ).length;
    if (sentItems === 0) return 'dropped';
    return sentItems === southConnector.items.length ? 'sent' : 'partial';
  }

  /** The default options of a transformer, `null` when they are not valid (some must be set by the user) */
  private defaultOptions(transformer: TransformerDTO): Record<string, unknown> | null {
    const form = new FormGroup({});
    for (const attribute of transformer.manifest.attributes) {
      addAttributeToForm(this.fb, form, attribute);
    }
    addEnablingConditions(form, transformer.manifest.enablingConditions);
    return form.valid ? form.value : null;
  }
}

/**
 * Whether the items of a south are not all sent the same way: it has transformers, but none applying to all its items
 * without leaving some out
 */
function dependsOnItems(transformers: Array<SouthTransformer>): boolean {
  return (
    transformers.length > 0 &&
    !transformers.some(transformer => isSouthLevel(transformer) && (transformer.source.excludedItems ?? []).length === 0)
  );
}
