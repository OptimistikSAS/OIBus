import { ChangeDetectionStrategy, Component, effect, inject, input, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { catchError, Observable, of, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DateTime } from 'luxon';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';
import { TransformerService } from '../../../services/transformer.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import {
  OIBusSouthType,
  SouthConnectorItemTestingSettings,
  SouthConnectorItemTestResult
} from '../../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';

/** Where the "from a source item" input pulls values from (or `none` for paste-only sources). */
export type TransformerTestItemSource =
  { kind: 'south'; id: string; southType: OIBusSouthType } | { kind: 'history'; id: string; southType: OIBusSouthType } | { kind: 'none' };

interface TestItem {
  id: string;
  name: string;
  settings: SouthItemSettings;
}

/**
 * Embedded panel to test a configured transformer with its options, using either copy-pasted input
 * or the values produced by running one of the transformer's source items. Used inside the north
 * and history-query "edit transformer" modals. For a history source, the items offered are exactly
 * that history query's items. The result is shown as a pipeline: Raw input → transformer + its
 * options → transformer output.
 */
@Component({
  selector: 'oib-north-transformer-test',
  templateUrl: './transformer-test.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OibCodeBlockComponent, TransformerTestResultComponent, DateRangeSelectorComponent]
})
export class NorthTransformerTestComponent {
  readonly transformer = input<TransformerDTO | null>(null);
  readonly options = input<Record<string, unknown>>({});
  readonly itemSource = input<TransformerTestItemSource>({ kind: 'none' });

  readonly dateRangeSelector = viewChild<DateRangeSelectorComponent>('dateRangeSelector');

  private translate = inject(TranslateService);
  private transformerService = inject(TransformerService);
  private southConnectorService = inject(SouthConnectorService);
  private historyQueryService = inject(HistoryQueryService);
  private fb = inject(NonNullableFormBuilder);
  private testSubscription: Subscription | null = null;

  isTestRunning = false;
  errorMessage: string | null = null;
  /** True when the source south supports history queries and therefore needs a query range. */
  supportsHistory = false;
  /** Items that can be run to produce input values, loaded from the transformer's source. */
  availableItems: Array<TestItem> = [];
  private southSettings: SouthSettings | null = null;

  /** Latest test result (raw + transformed) feeding the pipeline view. */
  testResult: SouthConnectorItemTestResult | null = null;

  /** Once a test has succeeded, the settings form collapses into a summary chip to leave room for the result. */
  settingsCollapsed = false;

  form = this.fb.group({
    inputSource: this.fb.control<'paste' | 'item'>('paste'),
    inputData: this.fb.control<string>(''),
    itemId: this.fb.control<string | null>(null),
    // No initial value here: <oib-date-range-selector> seeds itself from its `defaultRange` input
    // (last 10 minutes) and pushes the computed value up as soon as it initializes.
    dateRange: this.fb.control<DateRange | null>(null)
  });

  constructor() {
    effect(() => {
      const transformer = this.transformer();
      // A different transformer is being tested: drop the previous one's stale result and reopen
      // the settings, then prefill the paste editor with a sample payload for its input type.
      this.testResult = null;
      this.errorMessage = null;
      this.settingsCollapsed = false;
      if (transformer) {
        this.transformerService
          .getInputTemplate(transformer.inputType)
          .subscribe(template => this.form.controls.inputData.setValue(template.data));
      }
    });
    // Load the source's items + settings and whether it supports history, so an item can be run.
    effect(() => this.loadItemSource(this.itemSource()));
  }

  get canUseItemSource(): boolean {
    return this.itemSource().kind !== 'none' && this.availableItems.length > 0;
  }

  /** One-line recap of the current input settings, shown on the collapsed summary chip. */
  get settingsSummary(): string {
    if (this.form.controls.inputSource.value === 'paste') {
      return this.translate.instant('north.transformers.test.source-paste');
    }
    const item = this.availableItems.find(candidate => candidate.id === this.form.controls.itemId.value);
    const itemLabel = item?.name ?? this.translate.instant('north.transformers.test.source-item');
    if (!this.supportsHistory) {
      return itemLabel;
    }
    const rangeLabel = this.dateRangeSelector()?.getSummaryLabel() ?? '';
    return rangeLabel ? `${itemLabel} · ${rangeLabel}` : itemLabel;
  }

  runTest() {
    const transformer = this.transformer();
    if (!transformer) {
      return;
    }
    const request = this.buildRequest(transformer);
    if (!request) {
      return;
    }

    this.errorMessage = null;
    this.isTestRunning = true;
    this.testSubscription = request
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.finishTest();
          this.errorMessage = getMessageFromHttpErrorResponse(error);
          this.testResult = null;
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();
        if (result) {
          this.testResult = result;
          this.settingsCollapsed = true;
        }
      });
  }

  cancelTest() {
    this.testSubscription?.unsubscribe();
    this.finishTest();
  }

  private loadItemSource(source: TransformerTestItemSource) {
    this.availableItems = [];
    this.southSettings = null;
    this.supportsHistory = false;
    if (source.kind === 'none') {
      return;
    }

    this.southConnectorService.getSouthManifest(source.southType).subscribe(manifest => (this.supportsHistory = manifest.modes.history));

    if (source.kind === 'south') {
      this.southConnectorService.findById(source.id).subscribe(south => (this.southSettings = south.settings));
      this.southConnectorService.searchItems(source.id, { page: 0 }).subscribe(page => {
        this.availableItems = page.content.map(item => ({ id: item.id, name: item.name, settings: item.settings }));
      });
    } else {
      this.historyQueryService.findById(source.id).subscribe(historyQuery => {
        this.southSettings = historyQuery.southSettings;
        this.availableItems = historyQuery.items.map(item => ({ id: item.id, name: item.name, settings: item.settings }));
      });
    }
  }

  private buildRequest(transformer: TransformerDTO): Observable<SouthConnectorItemTestResult> | null {
    if (this.form.controls.inputSource.value === 'paste') {
      return this.transformerService.testTransformer(transformer.id, {
        inputData: this.form.controls.inputData.value,
        options: this.options()
      });
    }

    const source = this.itemSource();
    const item = this.availableItems.find(candidate => candidate.id === this.form.controls.itemId.value);
    if (source.kind === 'none' || !item || !this.southSettings) {
      return null;
    }

    const testingSettings: SouthConnectorItemTestingSettings = {
      history: this.supportsHistory ? this.currentRange() : undefined,
      transformer: { transformerId: transformer.id, options: this.options() }
    };

    if (source.kind === 'south') {
      return this.southConnectorService.testItem(
        source.id,
        source.southType,
        item.name,
        this.southSettings,
        item.settings,
        testingSettings
      );
    }
    return this.historyQueryService.testItem(
      source.id,
      null,
      source.southType,
      item.name,
      this.southSettings,
      item.settings,
      testingSettings
    );
  }

  private currentRange(): { startTime: string; endTime: string } {
    // The date-range selector always pushes a computed value up on init, so the form control is
    // only ever null in the instant before that happens; fall back to "last 10 minutes" just in
    // case a test is somehow triggered in that window.
    const fallbackRange: DateRange = {
      startTime: DateTime.now().minus({ minutes: 10 }).toUTC().toISO()!,
      endTime: DateTime.now().toUTC().toISO()!
    };
    const range = this.dateRangeSelector()?.currentDateRange() ?? this.form.controls.dateRange.value ?? fallbackRange;
    return { startTime: range.startTime, endTime: range.endTime };
  }

  private finishTest() {
    this.isTestRunning = false;
    this.testSubscription = null;
  }
}

export default NorthTransformerTestComponent;
