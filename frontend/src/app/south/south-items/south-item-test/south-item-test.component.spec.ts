import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { SouthConnectorItemDTO, SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { delay, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import SouthItemTestComponent from './south-item-test.component';
import { Component, ViewChild } from '@angular/core';
import { SouthFolderScannerItemSettings } from '../../../../../../backend/shared/model/south-settings.model';
import { HistoryQueryService } from '../../../services/history-query.service';
import { DateTime, Settings } from 'luxon';
import { provideDatepicker } from '../../../shared/datepicker.providers';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../../../backend/shared/model/engine.model';
import testData from '../../../../../../backend/src/tests/utils/test-data';

@Component({
  selector: 'oib-test-south-item-test-component',
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
  @ViewChild('testedComponent') testedComponent!: SouthItemTestComponent;

  type!: 'south' | 'history-south';
  entityId!: string;

  item: SouthConnectorItemDTO = {
    id: 'id1',
    name: 'item1',
    enabled: true,
    settings: {
      regex: '*',
      minAge: 100,
      preserveFiles: true
    } as SouthFolderScannerItemSettings,
    scanMode: testData.scanMode.list[0]
  };
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
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

    historyQueryService.testItem.calls.reset();
    historyQueryService.testItem.and.returnValue(of(testResultOIBusContent));

    tester = new SouthItemTestComponentTester();
    tester.changeType('south');
    tester.changeEntityId('southId');
    await tester.change();

    spyOn(tester.testResultViewComponent, 'displayInfo');
    spyOn(tester.testResultViewComponent, 'displayResult');
    spyOn(tester.testResultViewComponent, 'displayError');
    spyOn(tester.testResultViewComponent, 'changeDisplayMode');
    spyOn(tester.testResultViewComponent, 'displayLoading');
    await tester.change();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  const testCases = [
    {
      type: 'south' as 'south' | 'history-south',
      entityId: 'southId',
      service: { testItem: southConnectorService!.testItem }
    },
    {
      type: 'history-south' as 'south' | 'history-south',
      entityId: 'historyId',
      service: { testItem: historyQueryService!.testItem }
    }
  ];

  testCases.forEach(testCase => {
    it(`[${testCase.type}] should show history related settings`, async () => {
      tester.changeSupportsHistory(true);
      await tester.change();

      expect(tester.historyGroup).toBeDefined();
      expect(tester.dateRangeSelector).toBeDefined();
    });

    it(`[${testCase.type}] should hide history related settings`, async () => {
      tester.changeSupportsHistory(false);
      await tester.change();

      expect(tester.historyGroup).toBeNull();
      expect(tester.dateRangeSelector).toBeNull();
    });

    it(`[${testCase.type}] should test the item with default history settings`, async () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

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

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should test the item with custom history settings`, async () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

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
      await tester.change();

      tester.testButton.click();

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should test the item without history`, async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should cancel the item test`, fakeAsync(async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

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

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      // wait for a bit, but not enough for the test request to finish
      tick(1000);
      await tester.change();

      tester.cancelTestButton.click();

      flushMicrotasks();
      await tester.change();

      // values are not displayed
      expect(tester.testResultViewComponent.displayInfo).toHaveBeenCalled();
      expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    }));

    it(`[${testCase.type}] should not cancel the item test when it's already finished`, fakeAsync(async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

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

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      // wait for more time than needed for the test request
      tick(5000);
      await tester.change();

      flushMicrotasks();
      await tester.change();

      // now the button is not clickable
      tester.cancelTestButton.click();

      // values are properly displayed
      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(testResultOIBusContent);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    }));

    it(`[${testCase.type}] should handle test request error`, async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

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

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      expect(tester.testResultViewComponent.displayError).toHaveBeenCalled();
      expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should handle time values as well`, async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

      const result = { type: 'time-values', content: [{ pointId: 'pointId' }] } as OIBusTimeValueContent;
      testCase.service.testItem.and.returnValue(of(result));

      tester.testButton.click();

      const formValues = tester.testingSettingsForm?.value;
      const expectedSettings = {};

      expect(formValues).toEqual(expectedSettings);

      if (testCase.type === 'south') {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      } else {
        expect(testCase.service.testItem).toHaveBeenCalledWith(
          tester.componentInstance.entityId,
          null,
          tester.componentInstance.connectorCommand.type,
          tester.componentInstance.item.name,
          tester.componentInstance.connectorCommand.settings,
          {
            regex: '*',
            minAge: 100,
            preserveFiles: true
          } as SouthFolderScannerItemSettings,
          expectedSettings
        );
      }

      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(result);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should be able to change display mode`, async () => {
      tester.changeSupportsHistory(false);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

      const result = { type: 'time-values', content: [{ pointId: 'pointId' }] } as OIBusTimeValueContent;
      testCase.service.testItem.and.returnValue(of(result));

      tester.testButton.click();

      // Mocking display mode changes after test data has been received
      tester.componentInstance.testedComponent.availableDisplayModes = ['table', 'any'];
      tester.componentInstance.testedComponent.currentDisplayMode = 'table';
      await tester.change();
      tester.button('#view-dropdown')!.click();
      tester.button('.dropdown-item:not(.active)')!.click();
      await tester.change();

      expect(tester.testResultViewComponent.changeDisplayMode).toHaveBeenCalledWith('any');
      expect(tester.testResultViewComponent.displayResult).toHaveBeenCalledWith(result);
      expect(tester.componentInstance.testedComponent.isTestRunning).toBeFalse();
    });

    it(`[${testCase.type}] should not retrieve settings if form is invalid`, async () => {
      tester.changeSupportsHistory(true);
      tester.changeType(testCase.type);
      tester.changeEntityId(testCase.entityId);
      await tester.change();

      const historyGroup = tester.testingSettingsForm.get('history');
      if (historyGroup) {
        historyGroup.get('dateRange')?.setValue(null);
        historyGroup.get('dateRange')?.markAsTouched();
      }
      await tester.change();

      tester.testButton.click();

      expect(tester.testingSettingsForm?.valid).toBeFalse();
      expect(tester.componentInstance.testedComponent.testingSettings).toEqual({ history: undefined });
      expect(testCase.service.testItem).not.toHaveBeenCalled();
    });
  });

  it('should not make request if the type provided is unsupported', async () => {
    tester.changeType('unsupported' as 'south' | 'history-south');
    tester.changeEntityId('entityId');
    await tester.change();

    tester.testButton.click();
    expect(tester.testResultViewComponent.displayResult).not.toHaveBeenCalled();
    expect(southConnectorService.testItem).not.toHaveBeenCalled();
    expect(historyQueryService.testItem).not.toHaveBeenCalled();
  });
});
