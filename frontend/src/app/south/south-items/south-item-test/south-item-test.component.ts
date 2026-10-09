import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { catchError, map, of, Subscription } from 'rxjs';

import { HistoryQueryItemCommandDTO } from '@oibus/shared/api/history-query.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestResult
} from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthConnectorItemTestingSettings } from '@oibus/shared/domain/south-connector.model';

import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';

/** A transformer available to run against the test item, with its configured (default) options. */
interface TransformerChoice {
  transformerId: string;
  transformer: TransformerDTO;
  options: Record<string, unknown>;
}

type TestingSettingsForm = FormGroup<{
  history?: FormGroup<{ dateRange: FormControl<DateRange | null> }>;
  northId: FormControl<string | null>;
  transformerId: FormControl<string | null>;
  options: FormGroup;
}>;

/**
 * Test panel for a South/History item. The user optionally selects a North (south context only) and
 * one of its transformers, tweaks that transformer's options for the test, and runs the item. The
 * result is shown as a pipeline: Raw result → transformer + its options → transformer output.
 * In a history-query context there is no North to pick — the history query's own transformers are used.
 */
@Component({
  selector: 'oib-south-item-test',
  templateUrl: './south-item-test.component.html',
  styleUrl: './south-item-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    TranslateDirective,
    DateRangeSelectorComponent,
    ValErrorDelayDirective,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    TransformerTestResultComponent
  ]
})
class SouthItemTestComponent {
  private readonly translate = inject(TranslateService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly historyQueryService = inject(HistoryQueryService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly dateRangeSelector = viewChild<DateRangeSelectorComponent>('dateRangeSelector');

  /** What kind of item is being tested */
  readonly type = input.required<'south' | 'history-south'>();
  /** Either southId or historyId (or 'create') */
  readonly entityId = input.required<string>();
  readonly fromSouth = input<string | null>(null);
  readonly item = input.required<SouthConnectorItemCommandDTO | HistoryQueryItemCommandDTO>();
  readonly connectorCommand = input.required<SouthConnectorCommandDTO>();
  readonly manifest = input.required<SouthConnectorManifest>();
  /**
   * History context only. When the history query's transformers are still being edited in memory
   * (create mode, or edit mode before the whole form is saved), the caller passes the current
   * in-memory list here so it's used instead of fetching the last-saved state from the API.
   */
  readonly inMemoryTransformers = input<Array<HistoryTransformerDTOWithOptions> | null>(null);

  private testSubscription: Subscription | null = null;

  readonly isTestRunning = signal(false);
  readonly infoMessage = signal<string | null>(this.translate.instant('south.test-item.status-message.initial'));
  readonly errorMessage = signal<string | null>(null);

  readonly supportsHistorySettings = computed(() => this.manifest().modes.history);
  readonly isHistory = computed(() => this.type() === 'history-south');

  /** Norths available to pick from (south context only). */
  private readonly northsResource = rxResource({
    params: () => (!this.isHistory() && this.entityId() !== 'create' ? this.entityId() : undefined),
    stream: () => this.northConnectorService.list().pipe(catchError(() => of([])))
  });
  readonly norths = computed(() => (this.northsResource.hasValue() ? this.northsResource.value() : []));

  /**
   * The last saved transformers of the history query (history context only). While the history query's transformers are
   * still being edited in memory (create mode, or edit mode before the whole form is saved), the live list is used
   * instead: a fetch would either 404 (create) or return stale data (edit).
   */
  private readonly historyTransformersResource = rxResource({
    params: () => (this.isHistory() && !this.inMemoryTransformers() && this.entityId() !== 'create' ? this.entityId() : undefined),
    stream: ({ params }) =>
      this.historyQueryService.findById(params).pipe(
        map(historyQuery => historyQuery.northTransformers),
        catchError(() => of([]))
      )
  });

  /**
   * Transformers of the currently selected north (south, set when a north is picked) or of the history query (history).
   */
  readonly transformerChoices = linkedSignal<Array<TransformerChoice>>(() => {
    if (!this.isHistory()) {
      return [];
    }
    const historyTransformers =
      this.inMemoryTransformers() ?? (this.historyTransformersResource.hasValue() ? this.historyTransformersResource.value() : []);
    return toTransformerChoices(historyTransformers);
  });
  /** The transformer currently selected (drives the options form + pipeline display). */
  readonly selectedTransformer = signal<TransformerDTO | null>(null);

  /** Latest test result (raw + optional transformed) feeding the pipeline view. */
  readonly testResult = signal<SouthConnectorItemTestResult | null>(null);

  /** User-toggled: collapses the settings form into a summary chip to leave room for the result. */
  readonly settingsCollapsed = signal(false);

  /** Transformer options default to a read-only summary; the edit icon reveals the editable form. */
  readonly optionsEditMode = signal(false);

  readonly form = signal<TestingSettingsForm | null>(null);
  /** The value of the form, kept in sync by initForm(). */
  private readonly formValue = signal<{ northId: string | null; options: Record<string, unknown> } | null>(null);

  readonly northId = computed(() => this.formValue()?.northId ?? null);

  /** Options currently entered for the test. */
  readonly currentOptions = computed(() => this.formValue()?.options ?? {});

  /** Current options, flattened for the read-only summary shown when not editing. */
  readonly currentOptionEntries = computed(() =>
    Object.entries(this.currentOptions()).map(([key, value]) => ({
      key,
      value: value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)
    }))
  );

  /** Name of the north currently selected (south context only; null otherwise or until one is picked). */
  readonly selectedNorthName = computed(() => {
    if (this.isHistory()) {
      return null;
    }
    return this.norths().find(n => n.id === this.northId())?.name ?? null;
  });

  /** One-line recap of the current settings, shown on the collapsed summary chip. */
  readonly settingsSummary = computed(() => {
    // the date range selector state is not a signal, but it is pushed into the form value whenever it changes
    this.formValue();
    const parts: Array<string> = [];

    if (this.supportsHistorySettings()) {
      parts.push(this.dateRangeSelector()?.getSummaryLabel() ?? '');
    }
    if (!this.isHistory()) {
      parts.push(this.selectedNorthName() ?? this.translate.instant('south.test-item.transformer-raw'));
    }
    if (this.isHistory() || this.northId()) {
      const selectedTransformer = this.selectedTransformer();
      parts.push(
        selectedTransformer ? this.transformerLabel(selectedTransformer) : this.translate.instant('south.test-item.transformer-raw')
      );
    }
    return parts.join(' · ');
  });

  constructor() {
    effect(() => this.manifest() && this.initForm());
  }

  private transformerLabel(transformer: TransformerDTO): string {
    return transformer.type === 'standard'
      ? this.translate.instant('configuration.oibus.manifest.transformers.standard.' + transformer.functionName)
      : transformer.name;
  }

  private initForm() {
    this.settingsCollapsed.set(false);
    const form: TestingSettingsForm = this.fb.group({
      northId: this.fb.control<string | null>(null),
      transformerId: this.fb.control<string | null>(null),
      options: this.fb.group({})
    });

    if (this.supportsHistorySettings()) {
      // No initial value here: <oib-date-range-selector> seeds itself from its `defaultRange`
      // input (last 10 minutes) and pushes the computed value up as soon as it initializes.
      form.addControl('history', this.fb.group({ dateRange: this.fb.control<DateRange | null>(null, Validators.required) }));
    }

    form.controls.northId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(northId => this.onNorthChange(northId));
    form.controls.transformerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(transformerId => this.onTransformerChange(transformerId));
    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateFormValue(form));
    this.updateFormValue(form);
    this.form.set(form);
  }

  private updateFormValue(form: TestingSettingsForm) {
    this.formValue.set({ northId: form.controls.northId.value, options: form.controls.options.value as Record<string, unknown> });
  }

  private onNorthChange(northId: string | null) {
    this.form()?.controls.transformerId.setValue(null);
    this.transformerChoices.set([]);
    if (!northId) {
      return;
    }
    this.northConnectorService
      .findById(northId)
      .pipe(catchError(() => of(null)))
      .subscribe(north => this.transformerChoices.set(toTransformerChoices(north?.transformers ?? [])));
  }

  private onTransformerChange(transformerId: string | null) {
    const choice = this.transformerChoices().find(c => c.transformerId === transformerId) ?? null;
    this.selectedTransformer.set(choice?.transformer ?? null);
    this.optionsEditMode.set(false);
    // Rebuild the (editable, test-only) options form from the transformer's manifest, pre-filled
    // with the configured options.
    const optionsForm = this.fb.group({});
    if (choice) {
      for (const attribute of choice.transformer.manifest.attributes) {
        addAttributeToForm(this.fb, optionsForm, attribute);
      }
      addEnablingConditions(optionsForm, choice.transformer.manifest.enablingConditions);
      optionsForm.patchValue(choice.options);
    }
    this.form()?.setControl('options', optionsForm);
  }

  private get testingSettings(): SouthConnectorItemTestingSettings {
    const form = this.form();
    const transformerId = form?.controls.transformerId.value ?? null;
    const transformer = transformerId ? { transformerId, options: this.currentOptions() } : undefined;

    if (this.supportsHistorySettings() && form?.controls.history) {
      // The date-range selector always pushes a computed value up on init, so the form control
      // is only ever null in the instant before that happens; fall back to "last 10 minutes" just
      // in case a test is somehow triggered in that window.
      const fallbackRange: DateRange = {
        startTime: DateTime.now().minus({ minutes: 10 }).toUTC().toISO()!,
        endTime: DateTime.now().toUTC().toISO()!
      };
      const liveRange = this.dateRangeSelector()?.currentDateRange() ?? form.controls.history.controls.dateRange.value ?? fallbackRange;
      return { history: { startTime: liveRange.startTime, endTime: liveRange.endTime }, transformer };
    }
    return { history: undefined, transformer };
  }

  testItem() {
    if (!this.form()?.valid) {
      return;
    }
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isTestRunning.set(true);
    this.optionsEditMode.set(false);

    const request = this.isHistory()
      ? this.historyQueryService.testItem(
          this.entityId(),
          this.fromSouth(),
          this.connectorCommand().type,
          this.item().name,
          this.connectorCommand().settings,
          this.item().settings,
          this.testingSettings
        )
      : this.southConnectorService.testItem(
          this.entityId(),
          this.connectorCommand().type,
          this.item().name,
          this.connectorCommand().settings,
          this.item().settings,
          this.testingSettings
        );

    this.testSubscription = request
      .pipe(
        catchError((errorResponse: HttpErrorResponse) => {
          this.finishTest();
          this.errorMessage.set(getMessageFromHttpErrorResponse(errorResponse));
          this.testResult.set(null);
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();
        if (result) {
          this.testResult.set(result);
        }
      });
  }

  cancelTesting() {
    this.testSubscription?.unsubscribe();
    this.finishTest();
    this.infoMessage.set(this.translate.instant('south.test-item.status-message.cancel'));
  }

  private finishTest() {
    this.isTestRunning.set(false);
    this.testSubscription = null;
  }
}

function toTransformerChoices(transformers: Array<TransformerDTOWithOptions | HistoryTransformerDTOWithOptions>): Array<TransformerChoice> {
  return transformers.map(t => ({ transformerId: t.transformer.id, transformer: t.transformer, options: t.options }));
}

export default SouthItemTestComponent;
