import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorManifest
} from '../../../../../backend/shared/model/south-connector.model';
import { delay, of, throwError } from 'rxjs';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthItemTestComponent } from './south-item-test.component';
import { Component, ViewChild } from '@angular/core';
import { SouthItemSettings, SouthSettings } from '../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryItemCommandDTO } from '../../../../../backend/shared/model/history-query.model';
import { HistoryQueryService } from '../../services/history-query.service';
import { DateTime, Settings } from 'luxon';
import { provideDatepicker } from '../../shared/datepicker.providers';
import { OibCodeBlockComponent } from '../../shared/form/oib-code-block/oib-code-block.component';
import { OIBusRawContent, OIBusTimeValueContent } from '../../../../../backend/shared/model/engine.model';
import { getMessageFromHttpErrorResponse } from '../../shared/error-interceptor.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  template: ` <oib-south-item-test
    #testedComponent
    [type]="type"
    [entityId]="entityId"
    [item]="item"
    [connectorCommand]="connectorCommand"
    [manifest]="manifest"
  />`,
  standalone: true,
  imports: [SouthItemTestComponent, TranslateModule]
})
class TestComponent {
  @ViewChild('testedComponent') testedComponent!: SouthItemTestComponent<'south'>;

  constructor(private translate: TranslateService) {}

  type!: string;
  entityId!: string;

  item = {} as SouthConnectorItemCommandDTO<SouthItemSettings> | HistoryQueryItemCommandDTO<SouthItemSettings>;
  connectorCommand = {} as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
  manifest = {
    id: 'sql',
    category: 'database',
    name: 'SQL',
    description: 'SQL description',
    modes: {
      history: true,
      lastFile: false,
      lastPoint: false,
      subscription: false,
      forceMaxInstantPerItem: false,
      sharedConnection: false
    },
    settings: [],
    items: {
      scanMode: {
        acceptSubscription: false,
        subscriptionOnly: false
      },
      settings: [],
      schema: {} as unknown
    },
    schema: {} as unknown
  } as SouthConnectorManifest;
}

class SouthItemTestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  changeType(type: string) {
    this.componentInstance.type = type;
  }

  changeEntityId(entityId: string) {
    this.componentInstance.entityId = entityId;
  }

  changeSupportsHistory(support: boolean) {
    const newManifest = { ...this.componentInstance.manifest, modes: { history: support } } as SouthConnectorManifest;
    this.componentInstance.manifest = newManifest;
  }

  get startTime() {
    return this.element<HTMLDivElement>('div#startTime');
  }

  get startTimeDate() {
    return this.elements('oib-datetimepicker')[0].elements<HTMLInputElement>('input')[0];
  }

  get startTimeHour() {
    return this.elements('oib-datetimepicker')[0].elements<HTMLInputElement>('input')[1];
  }

  get startTimeMinutes() {
    return this.elements('oib-datetimepicker')[0].elements<HTMLInputElement>('input')[2];
  }

  get endTime() {
    return this.element<HTMLDivElement>('div#endTime');
  }

  get endTimeDate() {
    return this.elements('oib-datetimepicker')[1].elements<HTMLInputElement>('input')[0];
  }

  get endTimeHour() {
    return this.elements('oib-datetimepicker')[1].elements<HTMLInputElement>('input')[1];
  }

  get endTimeMinutes() {
    return this.elements('oib-datetimepicker')[1].elements<HTMLInputElement>('input')[2];
  }

  get testButton() {
    return this.button('#test-item')!;
  }

  get cancelTestButton() {
    return this.button('#cancel-test-item')!;
  }

  get testingSettingsForm() {
    return this.componentInstance.testedComponent.testingSettingsForm!;
  }

  get translate() {
    return this.componentInstance['translate'];
  }
}

describe('SouthItemTestComponent', () => {
  let tester: SouthItemTestComponentTester;
  const southConnectorService: jasmine.SpyObj<SouthConnectorService> = createMock(SouthConnectorService);
  const historyQueryService: jasmine.SpyObj<HistoryQueryService> = createMock(HistoryQueryService);
  let codeBlockSpy: {
    changeLanguage: jasmine.SpyObj<OibCodeBlockComponent['changeLanguage']>;
    writeValue: jasmine.SpyObj<OibCodeBlockComponent['writeValue']>;
  };

  // Force DateTime to use the date mocked by Jasmine
  // This works becaus we mock the date before creating the component,
  // and all 'new Date()' calls will resolve in the mocked date
  beforeAll(() => {
    Settings.now = () => {
      return DateTime.fromJSDate(new Date()).toMillis();
    };
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        // IMPORTANT! In order for the datetime picker to work properly, this needs to be added!
        provideDatepicker(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService }
      ]
    });

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2024-01-01T00:10:00.000Z'));

    southConnectorService.testItem.and.returnValue(of({ type: 'raw', filePath: '/file/path' }));
    historyQueryService.testSouthItem.and.returnValue(of({ type: 'raw', filePath: '/file/path' }));

    tester = new SouthItemTestComponentTester();
    tester.changeType('south');
    tester.changeEntityId('southId');
    tester.detectChanges();

    // Even though the codeblock does not work in the testing env
    // we can spy on it's calls
    codeBlockSpy = {
      changeLanguage: spyOn(tester.componentInstance.testedComponent.codeBlock(), 'changeLanguage'),
      writeValue: spyOn(tester.componentInstance.testedComponent.codeBlock(), 'writeValue')
    };
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  const testCases = [
    { type: 'south', entityId: 'southId', service: { testItem: southConnectorService!.testItem } },
    { type: 'history-south', entityId: 'historyId', service: { testItem: historyQueryService!.testSouthItem } }
  ];

  testCases.forEach(testCase => {
    it(`[${testCase.type}] should show history related settings`, () => {
      tester.changeSupportsHistory(true);
      tester.detectChanges();

      expect(tester.startTime).toBeDefined();
      expect(tester.endTime).toBeDefined();
    });

    it(`[${testCase.type}] should hide history related settings`, () => {
      tester.changeSupportsHistory(false);
      tester.detectChanges();

      expect(tester.startTime).toBeNull();
      expect(tester.endTime).toBeNull();
    });

    it(`[${testCase.type}] should test the item with default history settings`, () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {
        // by deafault it should query the last 10 seconds
        history: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T00:10:00.000Z' }
      };

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(codeBlockSpy.changeLanguage).toHaveBeenCalledWith('plaintext');
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith('/file/path');
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should test the item with custom history settings`, () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const formValues = tester.testingSettingsForm?.value;
      const defaultSettings = {
        // by deafault it should query the last 10 seconds
        history: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T00:10:00.000Z' }
      };

      const expectedSettings = {
        history: { startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T00:10:00.000Z' }
      };

      expect(formValues).toEqual(defaultSettings);

      tester.startTimeDate.fillWith('2023-01-01');
      tester.startTimeHour.fillWith('00');
      tester.startTimeMinutes.fillWith('00');

      tester.endTimeDate.fillWith('2023-01-01');
      tester.endTimeHour.fillWith('10');
      tester.endTimeMinutes.fillWith('00');

      tester.testButton.click();

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(codeBlockSpy.changeLanguage).toHaveBeenCalledWith('plaintext');
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith('/file/path');
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should test the item without history`, () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(codeBlockSpy.changeLanguage).toHaveBeenCalledWith('plaintext');
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith('/file/path');
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should cancel the item test`, fakeAsync(() => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      testCase.service.testItem.and.returnValue(of({ type: 'raw', filePath: '/file/path' } as OIBusRawContent).pipe(delay(3000)));

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      // wait for a bit, but not enough for the test request to finish
      tick(1000);
      tester.detectChanges();

      tester.cancelTestButton.click();

      flushMicrotasks();
      tester.detectChanges();

      // values are not displayed
      expect(codeBlockSpy.changeLanguage).not.toHaveBeenCalled();
      expect(codeBlockSpy.writeValue).toHaveBeenCalled();
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    }));

    it(`[${testCase.type}] should not cancel the item test when it's already finished`, fakeAsync(() => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      testCase.service.testItem.and.returnValue(of({ type: 'raw', filePath: '/file/path' } as OIBusRawContent).pipe(delay(3000)));

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      // wait for more time than needed for the test request
      tick(5000);
      tester.detectChanges();

      flushMicrotasks();
      tester.detectChanges();

      // now the button is not clickable
      tester.cancelTestButton.click();

      // values are properly displayed
      expect(codeBlockSpy.changeLanguage).toHaveBeenCalledWith('plaintext');
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith('/file/path');
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    }));

    it(`[${testCase.type}] should handle test request error`, () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const error: HttpErrorResponse = new HttpErrorResponse({
        error: 'cannot make request',
        status: 406,
        statusText: 'Not Acceptable',
        url: 'https:tst.tst/item'
      });
      testCase.service.testItem.and.returnValue(throwError(() => error));

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(codeBlockSpy.changeLanguage).not.toHaveBeenCalled();
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith(
        `${tester.translate.instant('south.test-item.editor-message.error')}:\n${getMessageFromHttpErrorResponse(error)}`
      );
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should handle time values as well`, () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const result = { type: 'time-values', content: [{ pointId: 'pointId' }] } as OIBusTimeValueContent;
      testCase.service.testItem.and.returnValue(of(result));

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(codeBlockSpy.changeLanguage).toHaveBeenCalledWith('json');
      expect(codeBlockSpy.writeValue).toHaveBeenCalledWith(JSON.stringify(result.content));
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });
  });
});
