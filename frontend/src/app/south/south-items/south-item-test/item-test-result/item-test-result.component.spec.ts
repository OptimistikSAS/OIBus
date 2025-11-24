import { TestBed } from '@angular/core/testing';
import { ItemTestResultComponent } from './item-test-result.component';
import { Component, viewChild } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { OIBusTimeValueContent } from '../../../../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-test-item-test-result-component',
  template: ` <oib-item-test-result #testedComponent />`,
  imports: [ItemTestResultComponent]
})
class TestComponent {
  readonly testedComponent = viewChild.required<ItemTestResultComponent>('testedComponent');
}

class ItemTestResultComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }
}

describe('ItemTestResultComponent', () => {
  let tester: ItemTestResultComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new ItemTestResultComponentTester();
    await tester.change();
  });

  it('should display a table result', () => {
    const changeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeActiveComponent');
    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };
    tester.componentInstance.testedComponent().displayResult(testResult);

    // These should be the available display modes
    expect(tester.componentInstance.testedComponent()['_availableDisplayModes']).toEqual(['table', 'json', 'any']);
    // The first one should be the default
    expect(tester.componentInstance.testedComponent()['_currentDisplayMode']).toEqual('table');
    expect(changeActiveComponentSpy).toHaveBeenCalledWith('table', { content: testResult });
  });

  it('should display a json result', async () => {
    const changeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeActiveComponent');
    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };
    // This call initializes display mode related variables
    tester.componentInstance.testedComponent().displayResult(testResult);

    // These should be the available display modes
    expect(tester.componentInstance.testedComponent()['_availableDisplayModes']).toEqual(['table', 'json', 'any']);
    // The first one should be the default, so we need to change it to 'json'
    tester.componentInstance.testedComponent().changeDisplayMode('json');
    await tester.change();
    expect(tester.componentInstance.testedComponent()['_currentDisplayMode']).toEqual('json');

    // We make sure the displayed result will be 'raw'
    tester.componentInstance.testedComponent().displayResult(testResult);
    expect(changeActiveComponentSpy).toHaveBeenCalledWith('codeblock', { content: testResult, contentType: 'json' });
  });

  it('should display a raw result', async () => {
    const changeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeActiveComponent');
    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };
    // This call initializes display mode related variables
    tester.componentInstance.testedComponent().displayResult(testResult);

    // These should be the available display modes
    expect(tester.componentInstance.testedComponent()['_availableDisplayModes']).toEqual(['table', 'json', 'any']);
    // The first one should be the default, so we need to change it to 'any'
    tester.componentInstance.testedComponent().changeDisplayMode('any');
    await tester.change();
    expect(tester.componentInstance.testedComponent()['_currentDisplayMode']).toEqual('any');

    // We make sure the displayed result will be 'raw'
    tester.componentInstance.testedComponent().displayResult(testResult);
    expect(changeActiveComponentSpy).toHaveBeenCalledWith('codeblock', {
      content: testResult,
      contentType: 'plaintext'
    });
  });

  it('should not display anything when the result is null', () => {
    const changeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeActiveComponent');

    tester.componentInstance.testedComponent().displayResult();
    expect(changeActiveComponentSpy).not.toHaveBeenCalled();
  });

  it('should display an info message', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const changeAvailableDisplayModesSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeAvailableDisplayModes');
    const changeDisplayModeSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeDisplayMode');

    tester.componentInstance.testedComponent().displayInfo('Testing');

    // Make sure when an info message is shown, that display related data is reset
    expect(removeActiveComponentSpy).toHaveBeenCalled();
    expect(tester.componentInstance.testedComponent().result).toBeNull();
    expect(tester.componentInstance.testedComponent().isLoading).toBeFalse();
    expect(changeAvailableDisplayModesSpy).toHaveBeenCalledWith([]);
    expect(changeDisplayModeSpy).toHaveBeenCalledWith(null);
    expect(tester.componentInstance.testedComponent().message).toEqual({ value: 'Testing', type: 'info' });
  });

  it('should display an error message', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const changeAvailableDisplayModesSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeAvailableDisplayModes');
    const changeDisplayModeSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'changeDisplayMode');

    // item-error type
    tester.componentInstance.testedComponent().displayError('Testing');

    // Make sure when an error message is shown, that display related data is reset
    expect(removeActiveComponentSpy).toHaveBeenCalled();
    expect(tester.componentInstance.testedComponent().isLoading).toBeFalse();
    expect(tester.componentInstance.testedComponent().result).toBeNull();
    expect(changeAvailableDisplayModesSpy).toHaveBeenCalledWith([]);
    expect(changeDisplayModeSpy).toHaveBeenCalledWith(null);
    expect(tester.componentInstance.testedComponent().message).toEqual({ value: 'Testing', type: 'item-error' });

    // display-result-error type
    tester.componentInstance.testedComponent().displayError('Testing', 'display-result-error');

    // Make sure when an error message is shown, that display related data is reset
    expect(removeActiveComponentSpy).toHaveBeenCalled();
    expect(tester.componentInstance.testedComponent().isLoading).toBeFalse();
    expect(tester.componentInstance.testedComponent().message).toEqual({
      value: 'Testing',
      type: 'display-result-error'
    });
  });

  it('should display a loading indicator', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');

    tester.componentInstance.testedComponent().displayLoading();

    // Make sure when the loading indicator is shown, that we do *not* reset the display mode
    // only the result data
    expect(removeActiveComponentSpy).toHaveBeenCalled();
    expect(tester.componentInstance.testedComponent().result).toBeNull();
    expect(tester.componentInstance.testedComponent().message).toBeNull();
    expect(tester.componentInstance.testedComponent().isLoading).toBeTrue();
  });

  it("should provide the currently selected display mode's icon", () => {
    // Initially, since 'displayResult' hansn't been called, the current display mode is null
    // so the icon is 'empty'
    let icon: string;
    icon = tester.componentInstance.testedComponent().currentDisplayModeIcon;
    expect(icon).toBe('');

    // After displaying changing the display mode, there will be an icon available
    tester.componentInstance.testedComponent().changeDisplayMode('json');
    icon = tester.componentInstance.testedComponent().currentDisplayModeIcon;
    expect(icon).toBe(tester.componentInstance.testedComponent().displayModeIcons.json);

    tester.componentInstance.testedComponent().changeDisplayMode('any');
    icon = tester.componentInstance.testedComponent().currentDisplayModeIcon;
    expect(icon).toBe(tester.componentInstance.testedComponent().displayModeIcons.any);

    tester.componentInstance.testedComponent().changeDisplayMode('table');
    icon = tester.componentInstance.testedComponent().currentDisplayModeIcon;
    expect(icon).toBe(tester.componentInstance.testedComponent().displayModeIcons.table);
  });

  it('should remove the active component', () => {
    const detachSpy = spyOn(tester.componentInstance.testedComponent().resultView(), 'detach');
    const cleanupSpy = spyOn(tester.componentInstance.testedComponent().resultComponents['table'].ref.instance, 'cleanup');

    // Initially it should not remove the active component since there isn't one active
    tester.componentInstance.testedComponent()['removeActiveComponent']();
    expect(cleanupSpy).not.toHaveBeenCalled();
    expect(detachSpy).not.toHaveBeenCalled();

    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };
    tester.componentInstance.testedComponent().displayResult(testResult);

    // Now it should remove it, and clean up
    tester.componentInstance.testedComponent()['removeActiveComponent']();
    expect(cleanupSpy).toHaveBeenCalled();
    expect(detachSpy).toHaveBeenCalled();
  });

  it('should change the active component to table', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const setInputSpy = spyOn(tester.componentInstance.testedComponent().resultComponents['table'].ref, 'setInput');
    const detectChangesSpy = spyOn(
      tester.componentInstance.testedComponent().resultComponents['table'].ref.changeDetectorRef,
      'detectChanges'
    );
    const insertSpy = spyOn(tester.componentInstance.testedComponent().resultView(), 'insert');

    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };

    tester.componentInstance.testedComponent()['changeActiveComponent']('table', { content: testResult });

    expect(removeActiveComponentSpy).toHaveBeenCalled();
    // Values needed to be set: content
    expect(setInputSpy).toHaveBeenCalledOnceWith('content', testResult);

    // Change detection should be called, to ensure previous values are properly detected
    expect(detectChangesSpy).toHaveBeenCalled();

    // There should be no errors
    expect(tester.componentInstance.testedComponent().resultComponents['table'].ref.instance.errorMessage).toBeFalsy();

    // It should insert it to the view
    expect(insertSpy).toHaveBeenCalledWith(tester.componentInstance.testedComponent().resultComponents['table'].ref.hostView);

    // Active component identifier should be updated
    expect(tester.componentInstance.testedComponent().activeComponentIdentifier).toBe('table');
  });

  it('should change the active component to codeblock', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const setInputSpy = spyOn(tester.componentInstance.testedComponent().resultComponents['codeblock'].ref, 'setInput');
    const detectChangesSpy = spyOn(
      tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.changeDetectorRef,
      'detectChanges'
    );
    const insertSpy = spyOn(tester.componentInstance.testedComponent().resultView(), 'insert');

    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };

    tester.componentInstance.testedComponent()['changeActiveComponent']('codeblock', {
      content: testResult,
      contentType: 'json'
    });

    expect(removeActiveComponentSpy).toHaveBeenCalled();
    // Values needed to be set: content, contentType
    expect(setInputSpy).toHaveBeenCalledWith('content', testResult);
    expect(setInputSpy).toHaveBeenCalledWith('contentType', 'json');

    // Change detection should be called, to ensure previous values are properly detected
    expect(detectChangesSpy).toHaveBeenCalled();

    // There should be no errors
    expect(tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.instance.errorMessage).toBeFalsy();

    // It should insert it to the view
    expect(insertSpy).toHaveBeenCalledWith(tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.hostView);

    // Active component identifier should be updated
    expect(tester.componentInstance.testedComponent().activeComponentIdentifier).toBe('codeblock');
  });

  it('should not change the active component if it has an error message', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const setInputSpy = spyOn(tester.componentInstance.testedComponent().resultComponents['codeblock'].ref, 'setInput');
    const detectChangesSpy = spyOn(
      tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.changeDetectorRef,
      'detectChanges'
    );
    const insertSpy = spyOn(tester.componentInstance.testedComponent().resultView(), 'insert');
    const displayErrorSpy = spyOn(tester.componentInstance.testedComponent(), 'displayError');

    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };

    tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.instance.errorMessage = 'Component display error';
    tester.componentInstance.testedComponent()['changeActiveComponent']('codeblock', {
      content: testResult,
      contentType: 'json'
    });

    expect(removeActiveComponentSpy).toHaveBeenCalled();
    // Values needed to be set: content, contentType
    expect(setInputSpy).toHaveBeenCalledWith('content', testResult);
    expect(setInputSpy).toHaveBeenCalledWith('contentType', 'json');

    // Change detection should be called, to ensure previous values are properly detected
    expect(detectChangesSpy).toHaveBeenCalled();

    // There should be an error message
    expect(displayErrorSpy).toHaveBeenCalledWith('Component display error', 'display-result-error');

    // It should *not* insert it to the view
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('should not change the active component if the component throws an unexpected error', () => {
    const removeActiveComponentSpy = spyOn<any>(tester.componentInstance.testedComponent(), 'removeActiveComponent');
    const setInputSpy = spyOn(tester.componentInstance.testedComponent().resultComponents['codeblock'].ref, 'setInput');
    const detectChangesSpy = spyOn(
      tester.componentInstance.testedComponent().resultComponents['codeblock'].ref.changeDetectorRef,
      'detectChanges'
    );
    const insertSpy = spyOn(tester.componentInstance.testedComponent().resultView(), 'insert');
    const displayErrorSpy = spyOn(tester.componentInstance.testedComponent(), 'displayError');

    const testResult: OIBusTimeValueContent = {
      type: 'time-values',
      content: [{ data: { value: 'test' }, pointId: 'pointId', timestamp: 'timestamp' }]
    };

    detectChangesSpy.and.throwError('Cannot write value');
    tester.componentInstance.testedComponent()['changeActiveComponent']('codeblock', {
      content: testResult,
      contentType: 'json'
    });

    expect(removeActiveComponentSpy).toHaveBeenCalled();
    // Values needed to be set: content, contentType
    expect(setInputSpy).toHaveBeenCalledWith('content', testResult);
    expect(setInputSpy).toHaveBeenCalledWith('contentType', 'json');

    // Change detection should be called, to ensure previous values are properly detected
    expect(detectChangesSpy).toHaveBeenCalled();

    // There should be an error message
    expect(displayErrorSpy).toHaveBeenCalledWith('Cannot write value', 'display-result-error');

    // It should *not* insert it to the view
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
