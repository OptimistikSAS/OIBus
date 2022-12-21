import { FormControlValidationDirective } from './form-control-validation.directive';
import { ReactiveFormsModule } from '@angular/forms';
import { ValdemortModule } from 'ngx-valdemort';
import { DefaultValidationErrorsComponent } from './default-validation-errors/default-validation-errors.component';

export const formDirectives = [ReactiveFormsModule, FormControlValidationDirective, ValdemortModule, DefaultValidationErrorsComponent];
