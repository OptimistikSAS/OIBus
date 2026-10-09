import { ChangeDetectionStrategy, Component, ComponentRef, inputBinding, Type, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Locator, page } from 'vitest/browser';

import { DefaultValidationErrorsComponent } from '../default-validation-errors/default-validation-errors.component';

/**
 * OnPush host rendering a form control component in the `settings` group of its form, like `oib-oibus-object-form-control`
 * does, along with the default validation error messages.
 */
@Component({
  selector: 'oib-test-oibus-form-control-host',
  template: `
    <oib-default-validation-errors />
    <form [formGroup]="form">
      <ng-container formGroupName="settings">
        <ng-container #anchor />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, DefaultValidationErrorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class OIBusFormControlHostComponent {
  readonly form = new FormGroup({ settings: new FormGroup<Record<string, AbstractControl>>({}) });
  readonly anchor = viewChild.required('anchor', { read: ViewContainerRef });
}

export interface OIBusFormControlTester<C> {
  readonly fixture: ComponentFixture<unknown>;
  readonly componentRef: ComponentRef<C>;
  readonly root: Locator;
  /** The form of the host, whose `settings` group contains the rendered control */
  readonly form: FormGroup;
}

/**
 * Renders a form control component (`oib-oibus-*-form-control`) with the given inputs, in the `settings` group of the form
 * of an OnPush host, the group containing the given control under the attribute key.
 * Changes made by the test on the control (patching it, disabling it, marking the form as touched...) come from outside the
 * component, which checks that it renders them although it is OnPush.
 */
export async function renderOIBusFormControl<C>(
  type: Type<C>,
  inputs: Record<string, unknown>,
  key: string,
  control: AbstractControl
): Promise<OIBusFormControlTester<C>> {
  const fixture = TestBed.createComponent(OIBusFormControlHostComponent);
  const host = fixture.componentInstance;
  host.form.controls.settings.addControl(key, control);
  await fixture.whenStable();
  const componentRef = host.anchor().createComponent(type, {
    bindings: Object.entries(inputs).map(([name, value]) => inputBinding(name, () => value))
  });
  await fixture.whenStable();
  return { fixture, componentRef, root: page.elementLocator(fixture.nativeElement), form: host.form };
}
