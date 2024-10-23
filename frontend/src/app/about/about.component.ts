import { Component, OnInit, inject } from '@angular/core';

import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../shared/val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { EngineService } from '../services/engine.service';
import { OIBusInfo } from '../../../../backend/shared/model/engine.model';

@Component({
  selector: 'oib-about',
  standalone: true,
  imports: [FormControlValidationDirective, ReactiveFormsModule, TranslateModule, ValErrorDelayDirective, ValidationErrorsComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements OnInit {
  private engineService = inject(EngineService);

  oibusInfo: OIBusInfo | null = null;
  readonly copyrightYear = new Date().getFullYear();

  ngOnInit() {
    this.engineService.getInfo().subscribe(info => {
      this.oibusInfo = info;
    });
  }
}
