import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgForOf, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { BoxComponent, BoxTitleDirective } from '../shared/box/box.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ModalService } from '../shared/modal.service';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';
import { switchMap, tap } from 'rxjs';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';

@Component({
  selector: 'oib-oia-module',
  standalone: true,
  imports: [TranslateModule, NgForOf, NgIf, RouterLink, BoxComponent, BoxTitleDirective, DatetimePipe],
  templateUrl: './oia-module.component.html',
  styleUrls: ['./oia-module.component.scss']
})
export class OiaModuleComponent implements OnInit {
  registration: RegistrationSettingsDTO | null = null;

  constructor(
    private oibusService: EngineService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.oibusService.getRegistrationSettings().subscribe(registration => {
      this.registration = registration;
    });
  }

  register(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent);
    modalRef.componentInstance.prepare(this.registration!);
    modalRef.result
      .pipe(
        tap(registration => this.notificationService.success('oia-module.registration.saved')),
        switchMap(() => this.oibusService.getRegistrationSettings())
      )
      .subscribe(registration => {
        this.registration = registration;
      });
  }

  unregister() {
    this.confirmationService
      .confirm({
        messageKey: 'oia-module.registration.confirm-unregistration'
      })
      .pipe(
        switchMap(() => this.oibusService.unregister()),
        tap(() => this.notificationService.success('oia-module.registration.unregistered')),
        switchMap(() => this.oibusService.getRegistrationSettings())
      )
      .subscribe(registration => {
        this.registration = registration;
      });
  }
}
