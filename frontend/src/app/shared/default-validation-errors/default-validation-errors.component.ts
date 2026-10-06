import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DisplayMode, ValdemortConfig, ValdemortModule } from 'ngx-valdemort';

@Component({
  selector: 'oib-default-validation-errors',
  templateUrl: './default-validation-errors.component.html',
  styleUrl: './default-validation-errors.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, ValdemortModule, DecimalPipe, TranslatePipe]
})
export class DefaultValidationErrorsComponent {
  constructor() {
    const valdemortConfig = inject(ValdemortConfig);
    valdemortConfig.errorsClasses = 'invalid-feedback';
    valdemortConfig.displayMode = DisplayMode.ONE;
  }
}
