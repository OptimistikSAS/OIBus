import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfigImportPreviewDTO, OIBusConfigurationDTO } from '../../../../../../backend/shared/model/config-transfer.model';
import { createPageFromArray, Page } from '../../../../../../backend/shared/model/types';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { TransformerSourceCommandDTO } from '../../../../../../backend/shared/model/transformer.model';
import { LogLevel } from '../../../../../../backend/shared/model/logs.model';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { OIBusNorthTypeEnumPipe } from '../../../shared/oibus-north-type-enum.pipe';
import { ScanModeSchedulePipe } from '../../../shared/scan-mode-schedule.pipe';
import { LogLevelsEnumPipe } from '../../../shared/log-levels-enum.pipe';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { TransformerService } from '../../../services/transformer.service';

type SouthEntry = OIBusConfigurationDTO['southConnectors'][number];
type SouthItemEntry = SouthEntry['settings']['items'][number];
type HistoryEntry = OIBusConfigurationDTO['historyQueries'][number];
type HistoryItemEntry = HistoryEntry['settings']['items'][number];
type ScanModeEntry = OIBusConfigurationDTO['scanModes'][number];
type TransformerEntry = OIBusConfigurationDTO['transformers'][number];

const ITEMS_PAGE_SIZE = 20;
const LOGGER_OUTPUTS = ['console', 'file', 'database', 'loki', 'oia', 'syslog'] as const;

/**
 * Read-only, collapsible view of every entity a config import is about to write, as returned by the
 * import preview endpoint. Each section only renders its content once expanded, so a configuration
 * with thousands of items stays cheap to display.
 */
@Component({
  selector: 'oib-config-import-preview',
  templateUrl: './config-import-preview.component.html',
  styleUrl: './config-import-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateDirective,
    TranslatePipe,
    JsonPipe,
    NgTemplateOutlet,
    OIBusSouthTypeEnumPipe,
    OIBusNorthTypeEnumPipe,
    ScanModeSchedulePipe,
    LogLevelsEnumPipe,
    PaginationComponent
  ]
})
export class ConfigImportPreviewComponent {
  private translateService = inject(TranslateService);
  private transformerService = inject(TransformerService);

  readonly preview = input.required<ConfigImportPreviewDTO>();
  readonly config = computed(() => this.preview().config);

  private readonly expandedSections = signal<ReadonlySet<string>>(new Set());
  private readonly pageNumbers = signal<ReadonlyMap<string, number>>(new Map());

  /** The proxy server settings without their passwords, which are never exported anyway. */
  readonly proxyServerDetails = computed(() => {
    const { password: _password, forward, ...proxyServer } = this.config().engine.settings.proxyServer;
    if (!forward) {
      return proxyServer;
    }
    const { password: _forwardPassword, ...forwardDetails } = forward;
    return { ...proxyServer, forward: forwardDetails };
  });

  /** One row per logging output: its level, and its other settings (the Loki password is never exported). */
  readonly loggerOutputs = computed(() => {
    const logger = this.config().engine.settings.logger;
    return LOGGER_OUTPUTS.map(output => {
      const { level, ...details } = logger[output] as { level: LogLevel } & Record<string, unknown>;
      delete details['password'];
      return { output, level, details };
    });
  });

  /**
   * Standard transformers are never imported: the file only carries them so that links to them (by
   * their per-instance random id) can be matched by function name with this instance's own ones.
   */
  readonly customTransformers = computed(() => this.config().transformers.filter(transformer => transformer.type === 'custom'));
  /** Only the standard transformers some north connector or history query links to (the file lists them all). */
  readonly standardTransformers = computed(() => {
    const config = this.config();
    const linkedIds = new Set([
      ...config.northConnectors.flatMap(north => north.settings.transformers.map(transformer => transformer.transformerId)),
      ...config.historyQueries.flatMap(history => history.settings.northTransformers.map(transformer => transformer.transformerId))
    ]);
    return config.transformers.filter(transformer => transformer.type === 'standard' && linkedIds.has(transformer.oIBusInternalId));
  });

  /** Function names of this instance's standard transformers, or null if they could not be retrieved. */
  private readonly localStandardFunctionNames = toSignal(
    this.transformerService.list().pipe(
      map(
        transformers =>
          new Set(transformers.filter(transformer => transformer.type === 'standard').map(transformer => transformer.functionName))
      ),
      catchError(() => of(null))
    ),
    { initialValue: null }
  );

  /** Standard transformers of the file this instance does not have: links to them are skipped by the import. */
  readonly missingStandardTransformers = computed(() => {
    const localFunctionNames = this.localStandardFunctionNames();
    if (!localFunctionNames) {
      return [];
    }
    return this.standardTransformers().filter(transformer => !localFunctionNames.has(this.functionName(transformer)));
  });

  private readonly transformersById = computed(
    () => new Map(this.config().transformers.map(transformer => [transformer.oIBusInternalId, transformer]))
  );
  private readonly southsById = computed(() => new Map(this.config().southConnectors.map(south => [south.oIBusInternalId, south])));
  private readonly scanModesById = computed(() => new Map(this.config().scanModes.map(scanMode => [scanMode.oIBusInternalId, scanMode])));

  isExpanded(key: string): boolean {
    return this.expandedSections().has(key);
  }

  toggle(key: string) {
    this.expandedSections.update(sections => {
      const updated = new Set(sections);
      if (!updated.delete(key)) {
        updated.add(key);
      }
      return updated;
    });
  }

  southItemsPage(key: string, south: SouthEntry): Page<SouthItemEntry> {
    return this.page<SouthItemEntry>(key, south.settings.items);
  }

  historyItemsPage(key: string, history: HistoryEntry): Page<HistoryItemEntry> {
    return this.page<HistoryItemEntry>(key, history.settings.items);
  }

  private page<T>(key: string, elements: Array<T>): Page<T> {
    return createPageFromArray(elements, ITEMS_PAGE_SIZE, this.pageNumbers().get(key) ?? 0);
  }

  changePage(key: string, pageNumber: number) {
    this.pageNumbers.update(pages => new Map(pages).set(key, pageNumber));
  }

  isEmptyObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
  }

  enabledLabel(enabled: boolean): string {
    return this.translateService.instant(enabled ? 'enabled' : 'disabled');
  }

  southItemSubtitle(south: SouthEntry, item: SouthItemEntry): string {
    return [this.enabledLabel(item.enabled), this.scanModeName(item.scanModeId, item.scanModeName), this.groupName(south, item.groupId)]
      .filter(part => part)
      .join(' · ');
  }

  historyTransformerItems(items: Array<{ name: string }>): string {
    if (items.length === 0) {
      return this.translateService.instant('configuration.oibus.manifest.transformers.all-items-selected');
    }
    if (items.length === 1) {
      return items[0].name;
    }
    return this.translateService.instant('configuration.oibus.manifest.transformers.several-items-selected', {
      numberOfItems: items.length
    });
  }

  asScanMode(scanMode: ScanModeEntry): ScanModeDTO {
    return { id: scanMode.oIBusInternalId, ...scanMode.settings } as ScanModeDTO;
  }

  scanModeName(scanModeId: string | null, scanModeName: string | null = null): string {
    if (!scanModeId) {
      return '';
    }
    return this.scanModesById().get(scanModeId)?.settings.name ?? scanModeName ?? scanModeId;
  }

  groupName(south: SouthEntry, groupId: string | null): string {
    if (!groupId) {
      return '';
    }
    return south.settings.groups.find(group => group.id === groupId)?.standardSettings.name ?? groupId;
  }

  transformerName(transformerId: string): string {
    const transformer = this.transformersById().get(transformerId);
    if (!transformer) {
      return transformerId;
    }
    const label = this.transformerLabel(transformer);
    if (this.missingStandardTransformers().includes(transformer)) {
      return `${label} (${this.translateService.instant('engine.config-transfer.import.preview.link-skipped')})`;
    }
    return label;
  }

  transformerLabel(transformer: TransformerEntry): string {
    if (transformer.type === 'standard') {
      return this.translateService.instant(`configuration.oibus.manifest.transformers.standard.${this.functionName(transformer)}`);
    }
    return (transformer.settings as unknown as { name: string }).name;
  }

  private functionName(transformer: TransformerEntry): string {
    return (transformer.settings as unknown as { functionName: string }).functionName;
  }

  transformerSource(source: TransformerSourceCommandDTO): string {
    if (source.type === 'south') {
      const south = this.southsById().get(source.southId);
      const southLabel = south
        ? `${south.settings.name} (${this.translateService.instant('enums.oibus-south-type.' + south.type)})`
        : source.southId;
      if (source.groupId) {
        const groupName = south ? this.groupName(south, source.groupId) : source.groupId;
        return `${southLabel} [${this.translateService.instant('configuration.oibus.manifest.transformers.group-selected', { groupName })}]`;
      }
      if (source.items.length === 1) {
        return `${southLabel} [${source.items[0].name}]`;
      }
      if (source.items.length > 1) {
        const numberOfItems = source.items.length;
        return `${southLabel} [${this.translateService.instant('configuration.oibus.manifest.transformers.several-items-selected', { numberOfItems })}]`;
      }
      return `${southLabel} [${this.translateService.instant('configuration.oibus.manifest.transformers.all-items-selected')}]`;
    }
    if (source.type === 'oibus-api') {
      return this.translateService.instant('configuration.oibus.manifest.transformers.oibus-api-selected', {
        dataSourceId: source.dataSourceId
      });
    }
    return this.translateService.instant('configuration.oibus.manifest.transformers.oianalytics-setpoint-selected');
  }
}
