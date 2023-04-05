import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControlValidationDirective } from '../shared/form-control-validation.directive';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ValErrorDelayDirective } from '../shared/val-error-delay.directive';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { EngineService } from '../services/engine.service';
import { OIBusInfo } from '../../../../shared/model/engine.model';

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
export class AboutComponent implements OnInit {
  oibusInfo: OIBusInfo | null = null;
  readonly copyright = `(c) Copyright 2019-${new Date().getFullYear()} Optimistik, all rights reserved.`;
  constructor(private engineService: EngineService) {}

  ngOnInit() {
    this.engineService.getInfo().subscribe(info => {
      this.oibusInfo = info;
    });
  }
}
