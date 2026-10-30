import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { catchError, EMPTY, map, Observable, of, Subscription, switchMap, tap } from 'rxjs';

import { SouthConnectorItemDTO, SouthConnectorItemTestResult } from '@oibus/shared/api/south-connector.model';
import { TransformerDTO } from '@oibus/shared/api/transformer.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '@oibus/shared/connector/south-settings.model';
import { SouthConnectorItemTestingSettings } from '@oibus/shared/domain/south-connector.model';

import { HistoryQueryService } from '../../../services/history-query.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { inMemoryTypeahead } from '../../../shared/form/typeahead';
import { OI_TYPEAHEAD_DIRECTIVES } from '../../../shared/form/typeahead-directives';
import {
  PipelineActionsDirective,
  TransformerTestResultComponent
} from '../../../shared/transformer-test-result/transformer-test-result.component';

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
 * and history-query "edit transformer" modals, laid out as the test panel of the items. For a history
 * source, the items offered are exactly that history query's items. The result is shown as a pipeline:
 * Raw input → transformer output.
 */
@Component({
  selector: 'oib-north-transformer-test',
  templateUrl: './transformer-test.component.html',
  styleUrl: './transformer-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    OibCodeBlockComponent,
    TransformerTestResultComponent,
    PipelineActionsDirective,
    DateRangeSelectorComponent,
    ...OI_TYPEAHEAD_DIRECTIVES
  ]
})
export class NorthTransformerTestComponent {
  private readonly translate = inject(TranslateService);
  private readonly transformerService = inject(TransformerService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly transformer = input<TransformerDTO | null>(null);
  readonly options = input<Record<string, unknown>>({});
  readonly itemSource = input<TransformerTestItemSource>({ kind: 'none' });

  readonly dateRangeSelector = viewChild<DateRangeSelectorComponent>('dateRangeSelector');

  private testSubscription: Subscription | null = null;

  readonly isTestRunning = signal(false);
  readonly infoMessage = signal<string | null>(this.translate.instant('south.test-item.status-message.initial'));
  readonly errorMessage = signal<string | null>(null);

  /** Whether the source south supports history queries and therefore needs a query range. */
  private readonly sourceManifest = rxResource({
    params: () => {
      const source = this.itemSource();
      return source.kind === 'none' ? undefined : source.southType;
    },
    stream: ({ params: southType }) => this.southConnectorService.getSouthManifest(southType)
  });
  readonly supportsHistory = computed(() => (this.sourceManifest.hasValue() ? this.sourceManifest.value().modes.history : false));

  /** Items that can be run to produce input values, loaded from the transformer's source, with the source settings. */
  private readonly sourceItems = rxResource({
    params: () => {
      const source = this.itemSource();
      return source.kind === 'none' ? undefined : source;
    },
    stream: ({ params: source }): Observable<{ southSettings: SouthSettings; items: Array<TestItem> }> =>
      source.kind === 'south'
        ? this.southConnectorService.findById(source.id).pipe(
            map(south => {
              const items: ReadonlyArray<SouthConnectorItemDTO> = south.items;
              return {
                southSettings: south.settings,
                items: items.map(item => ({ id: item.id, name: item.name, settings: item.settings }))
              };
            })
          )
        : this.historyQueryService.findById(source.id).pipe(
            map(historyQuery => ({
              southSettings: historyQuery.southSettings,
              items: historyQuery.items.map(item => ({ id: item.id, name: item.name, settings: item.settings }))
            }))
          )
  });
  readonly availableItems = computed(() => (this.sourceItems.hasValue() ? this.sourceItems.value().items : []));
  private readonly southSettings = computed(() => (this.sourceItems.hasValue() ? this.sourceItems.value().southSettings : null));

  /** Latest test result (raw + transformed) feeding the pipeline view. */
  readonly testResult = signal<SouthConnectorItemTestResult | null>(null);
  /** What the latest test ran on: see `testedInput` */
  private readonly lastTestedInput = signal<string | null>(null);

  /** User-toggled: collapses the settings form into a summary chip to leave room for the result. */
  readonly settingsCollapsed = signal(false);

  readonly form = this.fb.group({
    inputSource: this.fb.control<'paste' | 'item'>('item'),
    inputData: this.fb.control<string>(''),
    item: this.fb.control<TestItem | null>(null, Validators.required),
    // No initial value here: <oib-date-range-selector> seeds itself from its `defaultRange` input
    // (last 10 minutes) and pushes the computed value up as soon as it initializes.
    dateRange: this.fb.control<DateRange | null>(null)
  });
  private readonly chosenInputSource = toSignal(this.form.controls.inputSource.valueChanges, {
    initialValue: this.form.controls.inputSource.value
  });
  /** What the test runs on: an item of the source by default, the pasted data when the source has no item to run */
  readonly inputSource = computed(() => (this.canUseItemSource() ? this.chosenInputSource() : 'paste'));
  private readonly inputData = toSignal(this.form.controls.inputData.valueChanges, { initialValue: this.form.controls.inputData.value });
  private readonly item = toSignal(this.form.controls.item.valueChanges, { initialValue: this.form.controls.item.value });
  private readonly dateRange = toSignal(this.form.controls.dateRange.valueChanges, { initialValue: this.form.controls.dateRange.value });

  constructor() {
    // A different transformer is being tested: drop the previous one's stale result and reopen
    // the settings, then prefill the paste editor with a sample payload for its input type.
    toObservable(this.transformer)
      .pipe(
        tap(() => {
          this.testResult.set(null);
          this.lastTestedInput.set(null);
          this.errorMessage.set(null);
          this.infoMessage.set(this.translate.instant('south.test-item.status-message.initial'));
          this.settingsCollapsed.set(false);
        }),
        switchMap(transformer => (transformer ? this.transformerService.getInputTemplate(transformer.inputType) : EMPTY)),
        takeUntilDestroyed()
      )
      .subscribe(template => this.form.controls.inputData.setValue(template.data));
  }

  /** Searches the items of the source by name */
  readonly itemTypeahead = inMemoryTypeahead(
    () => this.availableItems(),
    item => item.name
  );
  readonly itemName = (item: TestItem): string => item.name;

  readonly canUseItemSource = computed(() => this.itemSource().kind !== 'none' && this.availableItems().length > 0);

  /**
   * What a test runs on: the transformer with its options, and the pasted data or the item. The date range is left out: a
   * relative one (e.g. the last 10 minutes) moves on by itself.
   */
  private readonly testedInput = computed(() =>
    JSON.stringify({
      transformerId: this.transformer()?.id ?? null,
      options: this.options(),
      input: this.inputSource() === 'paste' ? { data: this.inputData() } : { itemId: this.item()?.id ?? null }
    })
  );
  /** The latest test result no longer matches what a test would run on: the options or the input changed since */
  readonly resultOutdated = computed(() => !!this.testResult() && this.lastTestedInput() !== this.testedInput());
  /** Whether the latest test ran an item, which connects to the source and queries it */
  readonly testedOnItem = signal(false);

  /** A test on an item needs one to be selected, as a test on pasted data needs no item */
  readonly canRunTest = computed(() => this.inputSource() === 'paste' || !!this.item());

  /** One-line recap of the current input settings, shown on the collapsed summary chip. */
  readonly settingsSummary = computed(() => {
    if (this.inputSource() === 'paste') {
      return this.translate.instant('north.transformers.test.source-paste');
    }
    const item = this.item();
    const itemLabel = item?.name ?? this.translate.instant('north.transformers.test.source-item');
    if (!this.supportsHistory()) {
      return itemLabel;
    }
    // read to recompute the label when the range changes
    this.dateRange();
    const rangeLabel = this.dateRangeSelector()?.getSummaryLabel() ?? '';
    return rangeLabel ? `${itemLabel} · ${rangeLabel}` : itemLabel;
  });

  setInputSource(inputSource: 'paste' | 'item') {
    this.form.controls.inputSource.setValue(inputSource);
  }

  runTest() {
    const transformer = this.transformer();
    if (!transformer || !this.canRunTest()) {
      return;
    }
    const request = this.buildRequest(transformer);
    if (!request) {
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isTestRunning.set(true);
    this.lastTestedInput.set(this.testedInput());
    const onItem = this.inputSource() === 'item';
    this.testSubscription = request
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.finishTest();
          this.errorMessage.set(getMessageFromHttpErrorResponse(error));
          this.testResult.set(null);
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();
        if (result) {
          this.testedOnItem.set(onItem);
          this.testResult.set(result);
        }
      });
  }

  cancelTest() {
    this.testSubscription?.unsubscribe();
    this.finishTest();
    // the message replaces the previous result, which held the run button: drop it so that the button shows on its own
    this.testResult.set(null);
    this.infoMessage.set(this.translate.instant('south.test-item.status-message.cancel'));
  }

  private buildRequest(transformer: TransformerDTO): Observable<SouthConnectorItemTestResult> | null {
    if (this.inputSource() === 'paste') {
      return this.transformerService.testTransformer(transformer.id, {
        inputData: this.form.controls.inputData.value,
        options: this.options()
      });
    }

    const source = this.itemSource();
    const item = this.form.controls.item.value;
    const southSettings = this.southSettings();
    if (source.kind === 'none' || !item || !southSettings) {
      return null;
    }

    const testingSettings: SouthConnectorItemTestingSettings = {
      history: this.supportsHistory() ? this.currentRange() : undefined,
      transformer: { transformerId: transformer.id, options: this.options() }
    };

    if (source.kind === 'south') {
      return this.southConnectorService.testItem(source.id, source.southType, item.name, southSettings, item.settings, testingSettings);
    }
    return this.historyQueryService.testItem(source.id, null, source.southType, item.name, southSettings, item.settings, testingSettings);
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
    this.isTestRunning.set(false);
    this.testSubscription = null;
  }
}

export default NorthTransformerTestComponent;
