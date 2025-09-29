import { AfterContentInit, Component, effect, inject, input, OnInit, viewChild } from '@angular/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorManifest
} from '../../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { catchError, of, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getMessageFromHttpErrorResponse } from '../../../shared/error-interceptor.service';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { HistoryQueryService } from '../../../services/history-query.service';
import { HistoryQueryItemDTO } from '../../../../../../backend/shared/model/history-query.model';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ContentDisplayMode, ItemTestResultComponent } from './item-test-result/item-test-result.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { DateRange, DateRangeSelectorComponent } from '../../../shared/date-range-selector/date-range-selector.component';

@Component({
  selector: 'oib-south-item-test',
  templateUrl: './south-item-test.component.html',
  styleUrl: './south-item-test.component.scss',
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
class SouthItemTestComponent<TItemType extends 'south' | 'history-south'> implements AfterContentInit, OnInit {
  private translate = inject(TranslateService);

  readonly testResultView = viewChild.required<ItemTestResultComponent>('testResultViewComponent');

  /** What kind of item is being tested */
  readonly type = input.required<TItemType>();

  /** Either southId or historyId (or 'create') */
  readonly entityId = input.required<string>();

  readonly item =
    input.required<
      TItemType extends 'south'
        ? SouthConnectorItemDTO<SouthItemSettings>
        : TItemType extends 'history-south'
          ? HistoryQueryItemDTO<SouthItemSettings>
          : never
    >();

  readonly connectorCommand = input.required<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>>();
  readonly manifest = input.required<SouthConnectorManifest>();

  private southConnectorService = inject(SouthConnectorService);
  private historyQueryService = inject(HistoryQueryService);
  private fb = inject(NonNullableFormBuilder);
  private testSubscription: Subscription | null = null;

  isTestRunning = false;
  testingSettingsForm: FormGroup<{
    history?: FormGroup<{
      dateRange: FormControl<DateRange>;
    }>;
  }> | null = null;

  currentDisplayMode: ContentDisplayMode | null = null;
  availableDisplayModes: Array<ContentDisplayMode> = [];

  ngOnInit() {
    this.initForm();
  }

  constructor() {
    effect(() => this.manifest() && this.initForm());
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
      return {};
    }

    const formValue = this.testingSettingsForm.value;

    if (formValue.history?.dateRange) {
      return {
        history: {
          startTime: formValue.history.dateRange.startTime,
          endTime: formValue.history.dateRange.endTime
        }
      };
    }

    return formValue as SouthConnectorItemTestingSettings;
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
        this.connectorCommand().settings,
        this.item().settings,
        this.testingSettings
      );
    } else if (type === 'history-south') {
      return this.historyQueryService.testSouthItem(
        this.entityId(),
        this.connectorCommand().type,
        this.connectorCommand().settings,
        this.item().settings,
        this.testingSettings
      );
    }

    return null;
  }

  private initForm() {
    this.testingSettingsForm = this.fb.group({});

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
