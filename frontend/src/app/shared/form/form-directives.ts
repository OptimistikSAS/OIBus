import { ReactiveFormsModule } from '@angular/forms';

import { ValdemortModule } from 'ngx-valdemort';

import { DefaultValidationErrorsComponent } from '../default-validation-errors/default-validation-errors.component';
import { FormControlValidationDirective } from './form-control-validation.directive';
import { ValErrorDelayDirective } from './val-error-delay.directive';

export const formDirectives = [
  ReactiveFormsModule,
  FormControlValidationDirective,
  ValdemortModule,
  DefaultValidationErrorsComponent,
  ValErrorDelayDirective
];
