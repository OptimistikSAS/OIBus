import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';

import { OIBusCodeAttribute } from '@oibus/shared/connector/form.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OibCodeBlockComponent } from '../oib-code-block/oib-code-block.component';

@Component({
  selector: 'oib-oibus-code-form-control',
  templateUrl: './oibus-code-form-control.component.html',
  styleUrl: './oibus-code-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, OibCodeBlockComponent]
})
export class OIBusCodeFormControlComponent {
  codeAttribute = input.required<OIBusCodeAttribute>();
}
