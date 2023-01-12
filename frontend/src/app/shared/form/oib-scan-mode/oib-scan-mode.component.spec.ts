import { TestBed } from '@angular/core/testing';

import { OibScanModeComponent } from './oib-scan-mode.component';
import { Component } from '@angular/core';
import { OibScanModeFormControl } from '../../../model/form.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup } from '@angular/forms';
import { ScanModeDTO } from '../../../model/scan-mode.model';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-scan-mode
        [scanModes]="scanModes"
        [key]="settings.key"
        [formControlName]="settings.key"
        [acceptSubscription]="true"
        [subscriptionOnly]="false"
      ></oib-scan-mode>
    </div>
  </form>`,
  standalone: true,
  imports: [OibScanModeComponent, ...formDirectives]
})
class TestComponent {
  settings: OibScanModeFormControl = {
    key: 'myOibScanMode',
    type: 'OibScanMode',
    label: 'Scan mode field'
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
    return this.select('#oib-scan-mode-input-myOibScanMode')!;
  }
}

describe('OibScanModeComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibScanModeComponent, MockI18nModule]
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
