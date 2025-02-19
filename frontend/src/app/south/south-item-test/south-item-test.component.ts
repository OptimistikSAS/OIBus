import { Component, inject, viewChild, input, effect, OnInit, AfterContentInit } from '@angular/core';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest,
  SouthConnectorCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { ValErrorDelayDirective } from '../../shared/val-error-delay.directive';
import { SouthConnectorService } from '../../services/south-connector.service';
import { catchError, of, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getMessageFromHttpErrorResponse } from '../../shared/error-interceptor.service';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { Instant } from '../../../../../backend/shared/model/types';
import { dateTimeRangeValidatorBuilder } from '../../shared/validators';
import { DateTime } from 'luxon';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQuerySouthItemCommandDTO } from '../../../../../backend/shared/model/history-query.model';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ContentDisplayMode, ItemTestResultComponent } from './item-test-result/item-test-result.component';

@Component({
  selector: 'oib-south-item-test',
  templateUrl: './south-item-test.component.html',
  styleUrl: './south-item-test.component.scss',
  imports: [
    ...formDirectives,
    TranslateDirective,
    DatetimepickerComponent,
    ValErrorDelayDirective,
    NgbDropdownModule,
    TranslatePipe,
    ItemTestResultComponent
  ]
})
export class SouthItemTestComponent<TItemType extends 'south' | 'history-south'> implements AfterContentInit, OnInit {
  private translate = inject(TranslateService);

  readonly testResultView = viewChild.required<ItemTestResultComponent>('testResultViewComponent');

  /** What kind of item is being tested */
  readonly type = input.required<TItemType>();

  /** Either southId or historyId (or 'create') */
  readonly entityId = input.required<string>();

  readonly item =
    input.required<
      TItemType extends 'south'
        ? SouthConnectorItemCommandDTO<SouthItemSettings>
        : TItemType extends 'history-south'
          ? HistoryQuerySouthItemCommandDTO<SouthItemSettings>
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
      startTime: FormControl<Instant>;
      endTime: FormControl<Instant>;
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

    return this.testingSettingsForm.value as SouthConnectorItemTestingSettings;
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
        this.connectorCommand(),
        this.item() as SouthConnectorItemCommandDTO<SouthItemSettings>,
        this.testingSettings
      );
    } else if (type === 'history-south') {
      return this.historyQueryService.testSouthItem(
        this.entityId(),
        this.connectorCommand(),
        this.item() as HistoryQuerySouthItemCommandDTO<SouthItemSettings>,
        this.testingSettings
      );
    }

    return null;
  }

  private initForm() {
    this.testingSettingsForm = this.fb.group({});

    if (this.supportsHistorySettings) {
      this.testingSettingsForm.addControl(
        'history',
        this.fb.group({
          startTime: [DateTime.now().minus({ minutes: 10 }).toUTC().toISO()!, [dateTimeRangeValidatorBuilder('start')]],
          endTime: [DateTime.now().toUTC().toISO()!, [dateTimeRangeValidatorBuilder('end')]]
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
