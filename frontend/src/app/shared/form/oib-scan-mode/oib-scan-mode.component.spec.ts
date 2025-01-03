import { TestBed } from '@angular/core/testing';

import { OibScanModeComponent } from './oib-scan-mode.component';
import { Component } from '@angular/core';
import { OibScanModeFormControl } from '../../../../../../backend/shared/model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup } from '@angular/forms';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-scan-mode [scanModes]="scanModes" [key]="settings.key" [formControlName]="settings.key" [scanModeType]="'POLL'" />
    </div>
  </form>`,
  imports: [OibScanModeComponent, ...formDirectives]
})
class TestComponent {
  settings: OibScanModeFormControl = {
    key: 'myOibScanMode',
    type: 'OibScanMode',
    translationKey: 'Scan mode field'
  } as OibScanModeFormControl;
  scanModes: Array<ScanModeDTO> = [
    { id: 'id1', name: 'scanMode1', description: '', cron: '* * * * *' },
    { id: 'id2', name: 'scanMode2', description: '', cron: '* * * * *' }
  ];
  form = new FormGroup({ settings: new FormGroup({ myOibScanMode: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#OibScanMode-myOibScanMode')!;
  }
}

describe('OibScanModeComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.selectLabel('scanMode2');
    expect(tester.oibFormInput).toHaveSelectedLabel('scanMode2');
  });
});
