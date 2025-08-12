import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { SouthConnectorItemCommandDTO, SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { delay, of, throwError } from 'rxjs';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { SouthItemTestComponent } from './south-item-test.component';
import { Component, ViewChild } from '@angular/core';
import { SouthItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryService } from '../../../services/history-query.service';
import { DateTime, Settings } from 'luxon';
import { provideDatepicker } from '../../../shared/datepicker.providers';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../../../backend/shared/model/engine.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  template: ` <oib-south-item-test
    #testedComponent
    [type]="type"
    [entityId]="entityId"
    [item]="item"
    [connectorCommand]="connectorCommand"
    [manifest]="manifest"
  />`,
  imports: [SouthItemTestComponent]
})
class TestComponent {
  @ViewChild('testedComponent') testedComponent!: SouthItemTestComponent<'south'>;

  type!: 'south' | 'history-south';
  entityId!: string;

  item = testData.south.itemCommand;
  connectorCommand = testData.south.command;
  manifest = testData.south.manifest;
}

class SouthItemTestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  changeType(type: 'south' | 'history-south') {
    this.componentInstance.type = type;
  }

  changeEntityId(entityId: string) {
    this.componentInstance.entityId = entityId;
  }

  changeSupportsHistory(support: boolean) {
    this.componentInstance.manifest = {
      ...this.componentInstance.manifest,
      modes: { history: support }
    } as SouthConnectorManifest;
  }

  get historyGroup() {
    return this.element<HTMLDivElement>('div#history');
  }

  get dateRangeSelector() {
    return this.element('oib-date-range-selector');
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

  get testResultViewComponent() {
    return this.componentInstance.testedComponent.testResultView();
  }

  setDateRange(startTime: string, endTime: string) {
    // Update the form control directly since we're testing the component logic
    const historyGroup = this.testingSettingsForm.get('history');
    if (historyGroup) {
      historyGroup.get('dateRange')?.setValue({
        startTime,
        endTime
      });
    }
  }
}

describe('SouthItemTestComponent', () => {
  let tester: SouthItemTestComponentTester;
  const testResultOIBusContent: OIBusContent = { type: 'any', filePath: '/file/path' };
  const southConnectorService: jasmine.SpyObj<SouthConnectorService> = createMock(SouthConnectorService);
  const historyQueryService: jasmine.SpyObj<HistoryQueryService> = createMock(HistoryQueryService);

  // Force DateTime to use the date mocked by Jasmine
  // This works because we mock the date before creating the component,
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

    southConnectorService.testItem.calls.reset();
    southConnectorService.testItem.and.returnValue(of(testResultOIBusContent));

    historyQueryService.testSouthItem.calls.reset();
    historyQueryService.testSouthItem.and.returnValue(of(testResultOIBusContent));

    tester = new SouthItemTestComponentTester();
    tester.changeType('south');
    tester.changeEntityId('southId');
    tester.detectChanges();

    spyOn(tester.testResultViewComponent, 'displayInfo');
    spyOn(tester.testResultViewComponent, 'displayResult');
    spyOn(tester.testResultViewComponent, 'displayError');
    spyOn(tester.testResultViewComponent, 'changeDisplayMode');
    spyOn(tester.testResultViewComponent, 'displayLoading');
    tester.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  const testCases = [
    { type: 'south' as 'south' | 'history-south', entityId: 'southId', service: { testItem: southConnectorService!.testItem } },
    { type: 'history-south' as 'south' | 'history-south', entityId: 'historyId', service: { testItem: historyQueryService!.testSouthItem } }
  ];

  testCases.forEach(testCase => {
    it(`[${testCase.type}] should show history related settings`, () => {
      tester.changeSupportsHistory(true);
      tester.detectChanges();

      expect(tester.historyGroup).toBeDefined();
      expect(tester.dateRangeSelector).toBeDefined();
    });

    it(`[${testCase.type}] should hide history related settings`, () => {
      tester.changeSupportsHistory(false);
      tester.detectChanges();

      expect(tester.historyGroup).toBeNull();
      expect(tester.dateRangeSelector).toBeNull();
    });

    it(`[${testCase.type}] should test the item with default history settings`, () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {
        // by default, it should query the last 10 minutes
        history: {
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T00:10:00.000Z'
        }
      };

      expect(formValues).toEqual({
        history: {
          dateRange: {
            startTime: '2024-01-01T00:00:00.000Z',
            endTime: '2024-01-01T00:10:00.000Z'
          }
        }
      });

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should test the item with custom history settings`, () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const formValues = tester.testingSettingsForm?.value;
      const defaultSettings = {
        history: {
          dateRange: {
            startTime: '2024-01-01T00:00:00.000Z',
            endTime: '2024-01-01T00:10:00.000Z'
          }
        }
      };

      const expectedSettings = {
        history: {
          startTime: '2023-01-01T00:00:00.000Z',
          endTime: '2023-01-01T00:10:00.000Z'
        }
      };

      expect(formValues).toEqual(defaultSettings);

      // Set custom date range
      tester.setDateRange('2023-01-01T00:00:00.000Z', '2023-01-01T00:10:00.000Z');
      tester.detectChanges();

      tester.testButton.click();

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
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
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should cancel the item test`, fakeAsync(() => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      testCase.service.testItem.and.returnValue(
        of({
          type: 'any',
          filePath: '/file/path'
        } as OIBusRawContent).pipe(delay(3000))
      );

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
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
      expect(tester.testResultViewComponent.displayInfo).toHaveBeenCalled();
      expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    }));

    it(`[${testCase.type}] should not cancel the item test when it's already finished`, fakeAsync(() => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      testCase.service.testItem.and.returnValue(
        of({
          type: 'any',
          filePath: '/file/path'
        } as OIBusRawContent).pipe(delay(3000))
      );

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      expect(testCase.service.testItem).toHaveBeenCalledWith(
        tester.componentInstance.entityId,
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
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
      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
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
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(tester.testResultViewComponent.displayError).toHaveBeenCalled();
      expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
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
        tester.componentInstance.connectorCommand.type,
        tester.componentInstance.connectorCommand.settings,
        tester.componentInstance.item as SouthConnectorItemCommandDTO<SouthItemSettings>,
        expectedSettings
      );

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(result);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should be able to change display mode`, () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const result = { type: 'time-values', content: [{ pointId: 'pointId' }] } as OIBusTimeValueContent;
      testCase.service.testItem.and.returnValue(of(result));

      tester.testButton.click();

      // Mocking display mode changes after test data has been received
      tester.componentInstance.testedComponent.availableDisplayModes = ['table', 'any'];
      tester.componentInstance.testedComponent.currentDisplayMode = 'table';
      tester.detectChanges();
      tester.button('#view-dropdown')!.click();
      tester.button('.dropdown-item:not(.active)')!.click();
      tester.detectChanges();

      expect(tester.testResultViewComponent.changeDisplayMode).toHaveBeenCalledWith('any');
      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(result);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should not retrieve settings if form is invalid`, () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      tester.detectChanges();

      const historyGroup = tester.testingSettingsForm.get('history');
      if (historyGroup) {
        historyGroup.get('dateRange')?.setValue(null);
        historyGroup.get('dateRange')?.markAsTouched();
      }
      tester.detectChanges();

      tester.testButton.click();

      expect(tester.testingSettingsForm?.valid).toBeFalse();
      expect(tester.componentInstance.testedComponent.testingSettings).toEqual({});
      expect(testCase.service.testItem).not.toHaveBeenCalled();
    });
  });

  it('should not make request if the type provided is unsupported', () => {
    tester.changeType('unsupported' as 'south' | 'history-south');
    tester.changeEntityId('entityId');
    tester.detectChanges();

    tester.testButton.click();
    expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
    expect(southConnectorService.testItem).not.toHaveBeenCalled();
    expect(historyQueryService.testSouthItem).not.toHaveBeenCalled();
  });
});
