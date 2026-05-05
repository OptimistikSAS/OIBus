import { TestBed } from '@angular/core/testing';
import { ItemTestResultComponent } from './item-test-result.component';
import { Component, viewChild } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { OIBusContent, OIBusTimeValueContent } from '../../../../../../../backend/shared/model/engine.model';

const timeValuesContent: OIBusTimeValueContent = {
  type: 'time-values',
  content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
};

@Component({
  selector: 'oib-test-item-test-result-component',
  template: `<oib-item-test-result #testedComponent />`,
  imports: [ItemTestResultComponent]
})
class TestComponent {
  readonly testedComponent = viewChild.required<ItemTestResultComponent>('testedComponent');
}

class ItemTestResultComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get testedComponent() {
    return this.componentInstance.testedComponent();
  }
}

describe('ItemTestResultComponent', () => {
  let tester: ItemTestResultComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    tester = new ItemTestResultComponentTester();
    await tester.change();
  });

  it('should default to table mode and populate the table for time-values content', () => {
    tester.testedComponent.displayResult(timeValuesContent);

    expect(tester.testedComponent.displayMode()).toBe('table');
    expect(tester.testedComponent['_availableDisplayModes']).toEqual(['table', 'json', 'any']);
    expect(tester.testedComponent.tableView.content.length).toBe(1);
    expect(tester.testedComponent.result).toBe(timeValuesContent);
  });

  it('should retain result across displayResult calls without a new argument', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.changeDisplayMode('json');
    tester.testedComponent.displayResult();

    expect(tester.testedComponent.result).toBe(timeValuesContent);
    expect(tester.testedComponent.displayMode()).toBe('json');
  });

  it('should not render if called without a result and no previous result', () => {
    tester.testedComponent.displayResult();

    expect(tester.testedComponent.result).toBeNull();
    expect(tester.testedComponent.displayMode()).toBeNull();
  });

  it('should infer table and any modes for a CSV any-content', () => {
    const csvContent: OIBusContent = { type: 'any', filePath: 'data.csv', content: 'a,b\n1,2' };
    tester.testedComponent.displayResult(csvContent);

    expect(tester.testedComponent['_availableDisplayModes']).toEqual(['table', 'any']);
    expect(tester.testedComponent.displayMode()).toBe('table');
  });

  it('should infer only the any mode for non-CSV content', () => {
    const txtContent: OIBusContent = { type: 'any', filePath: 'data.txt', content: 'hello' };
    tester.testedComponent.displayResult(txtContent);

    expect(tester.testedComponent['_availableDisplayModes']).toEqual(['any']);
    expect(tester.testedComponent.displayMode()).toBe('any');
  });

  it('should display an item-level error, clear result and mode', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.displayError('Something failed');

    expect(tester.testedComponent.result).toBeNull();
    expect(tester.testedComponent.displayMode()).toBeNull();
    expect(tester.testedComponent['_availableDisplayModes']).toEqual([]);
    expect(tester.testedComponent.message).toEqual({ value: 'Something failed', type: 'item-error' });
    expect(tester.testedComponent.isLoading).toBeFalse();
  });

  it('should display a display-result error while keeping the result', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.displayError('Render failed', 'display-result-error');

    expect(tester.testedComponent.result).toBe(timeValuesContent);
    expect(tester.testedComponent.displayMode()).toBe('table');
    expect(tester.testedComponent.message).toEqual({ value: 'Render failed', type: 'display-result-error' });
  });

  it('should display an info message and clear everything', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.displayInfo('No data yet');

    expect(tester.testedComponent.result).toBeNull();
    expect(tester.testedComponent.displayMode()).toBeNull();
    expect(tester.testedComponent['_availableDisplayModes']).toEqual([]);
    expect(tester.testedComponent.message).toEqual({ value: 'No data yet', type: 'info' });
    expect(tester.testedComponent.isLoading).toBeFalse();
  });

  it('should display a loading indicator and clear result and message', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.displayLoading();

    expect(tester.testedComponent.result).toBeNull();
    expect(tester.testedComponent.message).toBeNull();
    expect(tester.testedComponent.isLoading).toBeTrue();
    // mode is intentionally not reset during loading so it is preserved when result arrives
    expect(tester.testedComponent.displayMode()).toBe('table');
  });

  it('should return the icon for the current display mode', () => {
    expect(tester.testedComponent.currentDisplayModeIcon).toBe('');

    tester.testedComponent.changeDisplayMode('table');
    expect(tester.testedComponent.currentDisplayModeIcon).toBe(tester.testedComponent.displayModeIcons.table);

    tester.testedComponent.changeDisplayMode('json');
    expect(tester.testedComponent.currentDisplayModeIcon).toBe(tester.testedComponent.displayModeIcons.json);

    tester.testedComponent.changeDisplayMode('any');
    expect(tester.testedComponent.currentDisplayModeIcon).toBe(tester.testedComponent.displayModeIcons.any);
  });

  it('should update the display mode signal when changed', () => {
    tester.testedComponent.changeDisplayMode('json');
    expect(tester.testedComponent.displayMode()).toBe('json');

    tester.testedComponent.changeDisplayMode(null);
    expect(tester.testedComponent.displayMode()).toBeNull();
  });

  it('should reset the table page when switching to table mode', () => {
    const resetPageSpy = spyOn(tester.testedComponent, 'resetPage');

    tester.testedComponent.displayResult(timeValuesContent);
    tester.testedComponent.changeDisplayMode('table');
    tester.testedComponent.displayResult();

    expect(resetPageSpy).toHaveBeenCalled();
  });

  it('should handle table parse errors as display-result errors', () => {
    tester.testedComponent.displayResult(timeValuesContent);
    spyOn(tester.testedComponent, 'changePage').and.throwError('Parse error');
    tester.testedComponent.resetPage();

    expect(tester.testedComponent.message).toEqual({ value: 'Parse error', type: 'display-result-error' });
  });
});
