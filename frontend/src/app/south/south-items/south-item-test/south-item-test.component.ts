import { AfterContentInit, Component, effect, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorManifest
} from '../../../../../../backend/shared/model/south-connector.model';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { catchError, forkJoin, of, Subscription, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { HistoryQueryService } from '../../../services/history-query.service';
import { HistoryQueryItemCommandDTO } from '../../../../../../backend/shared/model/history-query.model';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ContentDisplayMode, ItemTestResultComponent } from './item-test-result/item-test-result.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';

/** A transformer the user can pick to transform the raw test result. */
interface TransformerTestOption {
  transformerId: string;
  options: Record<string, unknown>;
  transformer: TransformerDTO;
  /** North name prefix (south tests) or null (history-query tests). */
  prefix: string | null;
}

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
    NgbDropdownModule,
    TranslatePipe,
    ItemTestResultComponent
  ]
})
class SouthItemTestComponent implements AfterContentInit {
  private translate = inject(TranslateService);

  readonly testResultView = viewChild.required<ItemTestResultComponent>('testResultViewComponent');
  // Optional: only present when supportsHistorySettings is true
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
  /** Transformers already configured that can be applied to the raw test result. */
  availableTransformers: Array<TransformerTestOption> = [];
  testingSettingsForm: FormGroup<{
    history?: FormGroup<{
      dateRange: FormControl<DateRange>;
    }>;
    transformer: FormControl<TransformerTestOption | null>;
  }> | null = null;

  currentDisplayMode: ContentDisplayMode | null = null;
  availableDisplayModes: Array<ContentDisplayMode> = [];

  constructor() {
    effect(() => this.manifest() && this.initForm());
    effect(() => this.loadAvailableTransformers());
  }

  ngAfterContentInit(): void {
    const message = this.translate.instant('south.test-item.status-message.initial');
    this.testResultView().displayInfo(message);
  }

  get supportsHistorySettings() {
    return this.manifest().modes.history;
  }

  get testingSettings(): SouthConnectorItemTestingSettings {
    if (!this.testingSettingsForm?.valid) {
      return { history: undefined };
    }

    const formValue = this.testingSettingsForm.value;
    const selectedTransformer = formValue.transformer ?? null;
    const transformer = selectedTransformer
      ? { transformerId: selectedTransformer.transformerId, options: selectedTransformer.options }
      : undefined;

    if (formValue.history?.dateRange !== undefined) {
      // Re-calculate the date range at the moment the test is triggered so that
      // predefined ranges (e.g. "last 10 minutes") are always fresh and never
      // reflect stale values from the time the user changed the dropdown.
      const liveRange = this.dateRangeSelector()?.currentDateRange() ?? formValue.history.dateRange;
      return {
        history: {
          startTime: liveRange.startTime,
          endTime: liveRange.endTime
        },
        transformer
      };
    }

    return { history: undefined, transformer };
  }

  testItem() {
    if (!this.testingSettingsForm?.valid) {
      return;
    }

    this.initTest();
    const request = this.makeRequest();
    if (!request) return;

    this.testSubscription = request
      .pipe(
        catchError((errorResponse: HttpErrorResponse, _) => {
          const errorMessage = getMessageFromHttpErrorResponse(errorResponse);
          this.finishTest();
          this.testResultView().displayError(errorMessage);
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();

        if (!result) {
          return;
        }

        this.testResultView().displayResult(result);
      });
  }

  cancelTesting() {
    this.testSubscription?.unsubscribe();
    const message = this.translate.instant('south.test-item.status-message.cancel');
    this.finishTest();
    this.testResultView().displayInfo(message);
  }

  onAvailableDisplayModesChange(newModes: Array<ContentDisplayMode>) {
    this.availableDisplayModes = newModes;
  }

  onCurrentDisplayModeChange(newMode: ContentDisplayMode | null) {
    this.currentDisplayMode = newMode;
  }

  changeDisplayMode(displayMode: ContentDisplayMode) {
    this.testResultView().changeDisplayMode(displayMode);
    this.testResultView().displayResult();
  }

  private makeRequest() {
    const type = this.type();
    if (type === 'south') {
      return this.southConnectorService.testItem(
        this.entityId(),
        this.connectorCommand().type,
        this.item().name,
        this.connectorCommand().settings,
        this.item().settings,
        this.testingSettings
      );
    } else if (type === 'history-south') {
      return this.historyQueryService.testItem(
        this.entityId(),
        this.fromSouth(),
        this.connectorCommand().type,
        this.item().name,
        this.connectorCommand().settings,
        this.item().settings,
        this.testingSettings
      );
    }

    return null;
  }

  private initForm() {
    this.testingSettingsForm = this.fb.group({
      transformer: this.fb.control<TransformerTestOption | null>(null)
    });

    if (this.supportsHistorySettings) {
      const defaultDateRange: DateRange = {
        startTime: DateTime.now().minus({ minutes: 10 }).toUTC().toISO()!,
        endTime: DateTime.now().toUTC().toISO()!
      };

      this.testingSettingsForm.addControl(
        'history',
        this.fb.group({
          dateRange: [defaultDateRange, Validators.required]
        })
      );
    }
  }

  /**
   * Collect the transformers already configured that can be applied to this item's raw result.
   * For a south item: transformers configured on any north whose source targets this south.
   * For a history-query item: only the transformers associated with that history query.
   */
  private loadAvailableTransformers() {
    const entityId = this.entityId();
    const type = this.type();
    if (entityId === 'create') {
      this.availableTransformers = [];
      return;
    }

    if (type === 'south') {
      this.northConnectorService
        .list()
        .pipe(
          catchError(() => of([])),
          switchMap(norths => (norths.length ? forkJoin(norths.map(north => this.northConnectorService.findById(north.id))) : of([]))),
          catchError(() => of([]))
        )
        .subscribe(norths => {
          this.availableTransformers = norths.flatMap(north =>
            north.transformers
              .filter(t => t.source.type === 'south' && t.source.south.id === entityId)
              .map(t => ({ transformerId: t.transformer.id, options: t.options, transformer: t.transformer, prefix: north.name }))
          );
        });
    } else if (type === 'history-south') {
      this.historyQueryService
        .findById(entityId)
        .pipe(catchError(() => of(null)))
        .subscribe(historyQuery => {
          this.availableTransformers = (historyQuery?.northTransformers ?? []).map(t => ({
            transformerId: t.transformer.id,
            options: t.options,
            transformer: t.transformer,
            prefix: null
          }));
        });
    }
  }

  private initTest() {
    this.isTestRunning = true;
    setTimeout(() => {
      if (this.isTestRunning) {
        this.testResultView().displayLoading();
      }
    }, 500);
  }

  private finishTest() {
    this.isTestRunning = false;
    this.testSubscription = null;
  }
}

export default SouthItemTestComponent;
