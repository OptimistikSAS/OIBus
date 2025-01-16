import { Component, inject, viewChild, input, effect, OnInit, AfterContentInit } from '@angular/core';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest,
  SouthConnectorCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatetimepickerComponent } from '../../shared/datetimepicker/datetimepicker.component';
import { ValErrorDelayDirective } from '../../shared/val-error-delay.directive';
import { SouthConnectorService } from '../../services/south-connector.service';
import { catchError, of, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { getMessageFromHttpErrorResponse } from '../../shared/error-interceptor.service';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { createPageFromArray, Instant, Page } from '../../../../../backend/shared/model/types';
import { dateTimeRangeValidatorBuilder } from '../../shared/validators';
import { DateTime } from 'luxon';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryItemCommandDTO } from '../../../../../backend/shared/model/history-query.model';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { OIBusContent, OIBusTimeValue } from '../../../../../backend/shared/model/engine.model';
import { emptyPage } from '../../shared/test-utils';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

const PAGE_SIZE = 10;

type DisplayMode = 'table' | 'raw' | 'json';

@Component({
  selector: 'oib-south-item-test',
  templateUrl: './south-item-test.component.html',
  styleUrl: './south-item-test.component.scss',
  imports: [
    ...formDirectives,
    OibCodeBlockComponent,
    TranslateDirective,
    DatetimepickerComponent,
    ValErrorDelayDirective,
    NgbDropdownModule,
    TranslatePipe,
    PaginationComponent
  ]
})
export class SouthItemTestComponent<TItemType extends 'south' | 'history-south'> implements AfterContentInit, OnInit {
  private translate = inject(TranslateService);

  readonly codeBlock = viewChild<OibCodeBlockComponent>('monacoEditor');

  /** What kind of item is being tested */
  readonly type = input.required<TItemType>();

  /** Either southId or historyId (or 'create') */
  readonly entityId = input.required<string>();

  readonly item =
    input.required<
      TItemType extends 'south'
        ? SouthConnectorItemCommandDTO<SouthItemSettings>
        : TItemType extends 'history-south'
          ? HistoryQueryItemCommandDTO<SouthItemSettings>
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
  testResult: OIBusContent | null = null;
  statusMessage: string | null = null;

  /**
   * These are the available displayed modes for the respective content types.
   * The first item in the array will be used as the default display mode
   */
  readonly displayModeSettings: Record<OIBusContent['type'], Array<DisplayMode>> = {
    'time-values': ['table', 'json', 'raw'],
    raw: ['raw']
  };
  readonly displayModeIcons: Record<DisplayMode, string> = { table: 'fa-table', raw: 'fa-file-text', json: 'fa-code' };
  currentDisplayMode: DisplayMode | null = null;
  availableDisplayModes: Array<DisplayMode> = [];

  tableView: Page<OIBusTimeValue> = emptyPage();

  ngOnInit() {
    this.initForm();
  }

  constructor() {
    effect(() => this.manifest() && this.initForm());
  }

  ngAfterContentInit(): void {
    const message = this.translate.instant('south.test-item.status-message.initial');
    this.showStatusMessage(message);
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

    this.testSubscription = this.makeRequest()!
      .pipe(
        catchError((errorResponse: HttpErrorResponse, _) => {
          const errorMessage = `${this.translate.instant('south.test-item.status-message.error')}:\n${getMessageFromHttpErrorResponse(errorResponse)}`;
          this.finishTest();
          this.showStatusMessage(errorMessage);
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();

        if (!result) {
          return;
        }

        this.testResult = result;
        this.displayTestResult();
      });
  }

  cancelTesting() {
    this.testSubscription?.unsubscribe();
    const message = this.translate.instant('south.test-item.status-message.cancel');
    this.finishTest();
    this.showStatusMessage(message);
  }

  private displayTestResult() {
    if (!this.testResult) {
      return;
    }

    if (!this.currentDisplayMode) {
      // Set the default display mode
      this.currentDisplayMode = this.displayModeSettings[this.testResult.type][0];
      this.availableDisplayModes = this.displayModeSettings[this.testResult.type];
    }

    switch (this.currentDisplayMode) {
      case 'table':
        // Empty the code block because it is hidden
        this.codeBlock()?.writeValue('');
        this.displayTable();
        break;

      case 'json':
        this.codeBlock()?.changeLanguage('json');
        this.codeBlock()?.writeValue(JSON.stringify(this.testResult.content, null, 2));
        break;

      case 'raw':
        switch (this.testResult.type) {
          case 'time-values':
            this.codeBlock()?.changeLanguage('plaintext');
            this.codeBlock()?.writeValue(JSON.stringify(this.testResult.content));
            break;
          case 'raw':
            const content = this.testResult.content ?? this.testResult.filePath;

            // There is a very tiny delay until Angular actually updates the UI to show the codeBlock
            // so we need a very small timeout for actually writing the value
            setTimeout(() => {
              this.codeBlock()?.changeLanguage('plaintext');
              this.codeBlock()?.writeValue(content);
            }, 10);
            break;
        }
        break;
    }
  }

  changeDisplayMode(displayMode: DisplayMode) {
    this.currentDisplayMode = displayMode;
    this.displayTestResult();
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
        this.item() as HistoryQueryItemCommandDTO<SouthItemSettings>,
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
    const message = this.translate.instant('south.test-item.status-message.loading');
    setTimeout(() => {
      if (this.isTestRunning) {
        this.showStatusMessage(message);
      }
    }, 500);
  }

  private finishTest() {
    this.isTestRunning = false;
    this.testSubscription = null;
  }

  private showStatusMessage(statusMessage: string) {
    this.statusMessage = statusMessage;
    this.currentDisplayMode = null;
  }

  private displayTable() {
    this.resetPage();
  }

  resetPage() {
    this.changePage(0);
  }

  changePage(pageNumber: number) {
    if (!this.testResult || !this.testResult.content || typeof this.testResult.content === 'string') return;
    this.tableView = createPageFromArray(this.testResult.content, PAGE_SIZE, pageNumber);
  }

  convertDataToString(data: OIBusTimeValue['data']) {
    const { value, ...rest } = data;
    return {
      value,
      other: JSON.stringify(rest, null, 2)
    };
  }
}
