import { AfterViewInit, Component, inject, OnInit, viewChild, input } from '@angular/core';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest,
  SouthConnectorItemTestingSettings,
  SouthConnectorCommandDTO
} from '../../../../../backend/shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
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
import { HistoryQueryItemCommandDTO } from '../../../../../backend/shared/model/history-query.model';

@Component({
  selector: 'oib-south-item-test',
  templateUrl: './south-item-test.component.html',
  styleUrl: './south-item-test.component.scss',
  imports: [...formDirectives, OibCodeBlockComponent, TranslateDirective, DatetimepickerComponent, ValErrorDelayDirective]
})
export class SouthItemTestComponent<TItemType extends 'south' | 'history-south'> implements AfterViewInit, OnInit {
  private translate = inject(TranslateService);

  readonly codeBlock = viewChild.required<OibCodeBlockComponent>('monacoEditor');

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

  readonly connector = input.required<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>>();
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

  ngAfterViewInit() {
    this.codeBlock().writeValue(this.translate.instant('south.test-item.editor-message.initial'));
  }

  ngOnInit() {
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
          const errorMessage = `${this.translate.instant('south.test-item.editor-message.error')}:\n${getMessageFromHttpErrorResponse(errorResponse)}`;
          this.finishTest(errorMessage);
          return of(null);
        })
      )
      .subscribe(result => {
        this.finishTest();

        if (!result) {
          return;
        }

        switch (result.type) {
          case 'time-values':
            this.codeBlock().changeLanguage('json');
            this.codeBlock().writeValue(JSON.stringify(result.content));
            break;
          case 'raw':
            this.codeBlock().changeLanguage('plaintext');
            this.codeBlock().writeValue(result.content ?? result.filePath);
            break;
        }
      });
  }

  cancelTesting() {
    this.testSubscription?.unsubscribe();
    const message = this.translate.instant('south.test-item.editor-message.cancel');
    this.finishTest(message);
  }

  private makeRequest() {
    const type = this.type();
    if (type === 'south') {
      return this.southConnectorService.testItem(
        this.entityId(),
        this.connector(),
        this.item() as SouthConnectorItemCommandDTO<SouthItemSettings>,
        this.testingSettings
      );
    } else if (type === 'history-south') {
      return this.historyQueryService.testSouthItem(
        this.entityId(),
        this.connector(),
        this.item() as HistoryQueryItemCommandDTO<SouthItemSettings>,
        this.testingSettings
      );
    }

    return null;
  }

  private initTest() {
    this.isTestRunning = true;
    this.codeBlock().writeValue(this.translate.instant('south.test-item.editor-message.loading'));
  }

  private finishTest(editorMessage: string | undefined = undefined) {
    this.isTestRunning = false;
    this.testSubscription = null;

    if (editorMessage) {
      this.codeBlock().writeValue(editorMessage);
    }
  }
}
