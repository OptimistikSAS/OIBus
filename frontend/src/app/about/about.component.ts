import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../shared/val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';

@Component({
  selector: 'oib-about',
  standalone: true,
  imports: [
    CommonModule,
    FormControlValidationDirective,
    ReactiveFormsModule,
    TranslateModule,
    ValErrorDelayDirective,
    ValidationErrorsComponent
  ],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {}
