import { Component, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusCodeAttribute } from '../../../../../../backend/shared/model/form.model';
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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, OibCodeBlockComponent]
})
export class OIBusCodeFormControlComponent {
  codeAttribute = input.required<OIBusCodeAttribute>();
}
