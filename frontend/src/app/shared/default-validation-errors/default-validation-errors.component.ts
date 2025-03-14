import { Component, inject } from '@angular/core';
import { DisplayMode, ValdemortConfig, ValdemortModule } from 'ngx-valdemort';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'oib-default-validation-errors',
  templateUrl: './default-validation-errors.component.html',
  styleUrl: './default-validation-errors.component.scss',
  imports: [TranslateDirective, ValdemortModule, DecimalPipe, TranslatePipe]
})
export class DefaultValidationErrorsComponent {
  constructor() {
    const valdemortConfig = inject(ValdemortConfig);
    valdemortConfig.errorsClasses = 'invalid-feedback';
    valdemortConfig.displayMode = DisplayMode.ONE;
  }
}
