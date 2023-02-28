import { TestBed } from '@angular/core/testing';

import { OibProxyComponent } from './oib-proxy.component';
import { Component } from '@angular/core';
import { OibProxyFormControl } from '../../../../../../shared/model/form.model';
import { ProxyDTO } from '../../../../../../shared/model/proxy.model';
import { formDirectives } from '../../form-directives';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, FormRecord } from '@angular/forms';

@Component({
  template: `<form [formGroup]="form">
    <div formGroupName="settings">
      <oib-proxy [key]="settings.key" [label]="settings.label" [proxies]="proxies" [formControlName]="settings.key"></oib-proxy>
    </div>
  </form>`,
  standalone: true,
  imports: [OibProxyComponent, ...formDirectives]
})
class TestComponent {
  proxies: Array<ProxyDTO> = [{ id: 'id1', name: 'proxy1' } as ProxyDTO, { id: 'id2', name: 'proxy2' } as ProxyDTO];
  settings: OibProxyFormControl = {
    key: 'myOibProxy',
    type: 'OibProxy',
    label: 'Select field'
  } as OibProxyFormControl;
  form = new FormGroup({ settings: new FormRecord({ myOibProxy: new FormControl('') }) });
}
class OibFormComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get oibFormInput() {
    return this.select('#oib-proxy-input-myOibProxy')!;
  }
}

describe('OibProxyComponent', () => {
  let tester: OibFormComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OibProxyComponent]
    });

    tester = new OibFormComponentTester();
    tester.detectChanges();
  });

  it('should have a select input', () => {
    expect(tester.oibFormInput).not.toBeNull();
  });

  it('should change value', () => {
    tester.oibFormInput.selectLabel('proxy2');
    expect(tester.oibFormInput).toHaveSelectedLabel('proxy2');
  });
});
