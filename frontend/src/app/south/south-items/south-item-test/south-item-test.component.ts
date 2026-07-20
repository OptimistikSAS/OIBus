import { AfterContentInit, Component, effect, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorItemTestResult,
  SouthConnectorManifest
} from '../../../../../../backend/shared/model/south-connector.model';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { catchError, of, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { HistoryQueryService } from '../../../services/history-query.service';
import { HistoryQueryItemCommandDTO } from '../../../../../../backend/shared/model/history-query.model';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { NorthConnectorLightDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { TransformerTestResultComponent } from '../../../shared/transformer-test-result/transformer-test-result.component';

/** A transformer available to run against the test item, with its configured (default) options. */
interface TransformerChoice {
  transformerId: string;
  transformer: TransformerDTO;
  options: Record<string, unknown>;
}

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
  changeDetection: ChangeDetectionStrategy.Eager,
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
class SouthItemTestComponent implements AfterContentInit {
  private translate = inject(TranslateService);

  readonly dateRangeSelector = viewChild<DateRangeSelectorComponent>('dateRangeSelector');

  /** What kind of item is being tested */
  readonly type = input.required<'south' | 'history-south'>();
  /** Either southId or historyId (or 'create') */
  readonly entityId = input.required<string>();
  readonly fromSouth = input<string | null>(null);
  readonly item = input.required<SouthConnectorItemCommandDTO | HistoryQueryItemCommandDTO>();
  readonly connectorCommand = input.required<SouthConnectorCommandDTO>();
  readonly manifest = input.required<SouthConnectorManifest>();

  private southConnectorService = inject(SouthConnectorService);
  private northConnectorService = inject(NorthConnectorService);
  private historyQueryService = inject(HistoryQueryService);
  private fb = inject(NonNullableFormBuilder);
  private testSubscription: Subscription | null = null;

  isTestRunning = false;
  infoMessage: string | null = null;
  errorMessage: string | null = null;

  /** Norths available to pick from (south context only). */
  norths: Array<NorthConnectorLightDTO> = [];
  /** Transformers of the currently selected north (south) or of the history query (history). */
  transformerChoices: Array<TransformerChoice> = [];
  /** The transformer currently selected (drives the options form + pipeline display). */
  selectedTransformer: TransformerDTO | null = null;

  /** Latest test result (raw + optional transformed) feeding the pipeline view. */
  testResult: SouthConnectorItemTestResult | null = null;

  /** Once a test has succeeded, the settings form collapses into a summary chip to leave room for the result. */
  settingsCollapsed = false;

  /** Transformer options default to a read-only summary; the edit icon reveals the editable form. */
  optionsEditMode = false;

  form: FormGroup<{
    history?: FormGroup<{ dateRange: FormControl<DateRange | null> }>;
    northId: FormControl<string | null>;
    transformerId: FormControl<string | null>;
    options: FormGroup;
  }> | null = null;

  constructor() {
    effect(() => this.manifest() && this.initForm());
    effect(() => this.loadTransformerSource());
  }

  ngAfterContentInit(): void {
    this.infoMessage = this.translate.instant('south.test-item.status-message.initial');
  }

  get supportsHistorySettings(): boolean {
    return this.manifest().modes.history;
  }

  get isHistory(): boolean {
    return this.type() === 'history-south';
  }

  /** Options currently entered for the test. */
  get currentOptions(): Record<string, unknown> {
    return (this.form?.controls.options.value as Record<string, unknown>) ?? {};
  }

  /** Current options, flattened for the read-only summary shown when not editing. */
  get currentOptionEntries(): Array<{ key: string; value: string }> {
    return Object.entries(this.currentOptions).map(([key, value]) => ({
      key,
      value: value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
  }

  /** Name of the north currently selected (south context only; null otherwise or until one is picked). */
  get selectedNorthName(): string | null {
    if (this.isHistory) {
      return null;
    }
    return this.norths.find(n => n.id === this.form?.controls.northId.value)?.name ?? null;
  }

  /** One-line recap of the current settings, shown on the collapsed summary chip. */
  get settingsSummary(): string {
    const parts: Array<string> = [];

    if (this.supportsHistorySettings) {
      parts.push(this.dateRangeSummary());
    }
    if (!this.isHistory) {
      parts.push(this.selectedNorthName ?? this.translate.instant('south.test-item.transformer-raw'));
    }
    if (this.isHistory || this.form?.controls.northId.value) {
      parts.push(
        this.selectedTransformer
          ? this.transformerLabel(this.selectedTransformer)
          : this.translate.instant('south.test-item.transformer-raw')
      );
    }
    return parts.join(' · ');
  }

  private dateRangeSummary(): string {
    const selector = this.dateRangeSelector();
    if (!selector) {
      return '';
    }
    const rangeType = selector.internalForm.controls.rangeType.value;
    if (rangeType !== 'custom') {
      const predefined = selector.predefinedRanges.find(r => r.key === rangeType);
      if (predefined) {
        return this.translate.instant(predefined.translationKey);
      }
    }
    return selector.getCurrentRangeDescription();
  }

  private transformerLabel(transformer: TransformerDTO): string {
    return transformer.type === 'standard'
      ? this.translate.instant('configuration.oibus.manifest.transformers.standard.' + transformer.functionName)
      : transformer.name;
  }

  private initForm() {
    this.settingsCollapsed = false;
    this.form = this.fb.group({
      northId: this.fb.control<string | null>(null),
      transformerId: this.fb.control<string | null>(null),
      options: this.fb.group({})
    });

    if (this.supportsHistorySettings) {
      // No initial value here: <oib-date-range-selector> seeds itself from its `defaultRange`
      // input (last 10 minutes) and pushes the computed value up as soon as it initializes.
      this.form.addControl('history', this.fb.group({ dateRange: this.fb.control<DateRange | null>(null, Validators.required) }));
    }

    this.form.controls.northId.valueChanges.subscribe(northId => this.onNorthChange(northId));
    this.form.controls.transformerId.valueChanges.subscribe(transformerId => this.onTransformerChange(transformerId));
  }

  /** Load norths (south) or the history query's transformers (history) once inputs are known. */
  private loadTransformerSource() {
    const entityId = this.entityId();
    if (entityId === 'create') {
      return;
    }
    if (this.isHistory) {
      this.historyQueryService
        .findById(entityId)
        .pipe(catchError(() => of(null)))
        .subscribe(historyQuery => {
          this.transformerChoices = (historyQuery?.northTransformers ?? []).map(t => ({
            transformerId: t.transformer.id,
            transformer: t.transformer,
            options: t.options
          }));
        });
    } else {
      this.northConnectorService
        .list()
        .pipe(catchError(() => of([])))
        .subscribe(norths => (this.norths = norths));
    }
  }

  private onNorthChange(northId: string | null) {
    this.form?.controls.transformerId.setValue(null);
    this.transformerChoices = [];
    if (!northId) {
      return;
    }
    this.northConnectorService
      .findById(northId)
      .pipe(catchError(() => of(null)))
      .subscribe(north => {
        this.transformerChoices = (north?.transformers ?? []).map(t => ({
          transformerId: t.transformer.id,
          transformer: t.transformer,
          options: t.options
        }));
      });
  }

  private onTransformerChange(transformerId: string | null) {
    const choice = this.transformerChoices.find(c => c.transformerId === transformerId) ?? null;
    this.selectedTransformer = choice?.transformer ?? null;
    this.optionsEditMode = false;
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
    this.form?.setControl('options', optionsForm);
  }

  private get testingSettings(): SouthConnectorItemTestingSettings {
    const transformerId = this.form?.controls.transformerId.value ?? null;
    const transformer = transformerId ? { transformerId, options: this.currentOptions } : undefined;

    if (this.supportsHistorySettings && this.form?.controls.history) {
      // The date-range selector always pushes a computed value up on init, so the form control
      // is only ever null in the instant before that happens; fall back to "last 10 minutes" just
      // in case a test is somehow triggered in that window.
      const fallbackRange: DateRange = {
        startTime: DateTime.now().minus({ minutes: 10 }).toUTC().toISO()!,
        endTime: DateTime.now().toUTC().toISO()!
      };
      const liveRange =
        this.dateRangeSelector()?.currentDateRange() ?? this.form.controls.history.controls.dateRange.value ?? fallbackRange;
      return { history: { startTime: liveRange.startTime, endTime: liveRange.endTime }, transformer };
    }
    return { history: undefined, transformer };
  }

  testItem() {
    if (!this.form?.valid) {
      return;
    }
    this.errorMessage = null;
    this.infoMessage = null;
    this.isTestRunning = true;
    this.optionsEditMode = false;

    const request = this.isHistory
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
          this.errorMessage = getMessageFromHttpErrorResponse(errorResponse);
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

  cancelTesting() {
    this.testSubscription?.unsubscribe();
    this.finishTest();
    this.infoMessage = this.translate.instant('south.test-item.status-message.cancel');
  }

  private finishTest() {
    this.isTestRunning = false;
    this.testSubscription = null;
  }
}

export default SouthItemTestComponent;
