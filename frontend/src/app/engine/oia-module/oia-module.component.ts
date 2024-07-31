import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EngineService } from '../../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../../shared/model/engine.model';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { ModalService } from '../../shared/modal.service';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';
import { catchError, EMPTY, exhaustMap, map, Subscription, switchMap, tap, timer } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MultiSelectComponent } from '../../shared/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../../shared/multi-select/multi-select-option.directive';
import { formDirectives } from '../../shared/form-directives';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { emptyPage } from '../../shared/test-utils';
import {
  OIBUS_COMMAND_STATUS,
  OIBUS_COMMAND_TYPES,
  OIBusCommand,
  OIBusCommandStatus,
  OIBusCommandType
} from '../../../../../shared/model/command.model';
import { Page } from '../../../../../shared/model/types';
import { PageLoader } from '../../shared/page-loader.service';
import { NonNullableFormBuilder } from '@angular/forms';
import { OibusCommandService } from '../../services/oibus-command.service';
import { OibusCommandTypeEnumPipe } from '../../shared/oibus-command-type-enum.pipe';
import { OibusCommandStatusEnumPipe } from '../../shared/oibus-command-status-enum.pipe';

const REGISTRATION_CHECK_DURATION = 3000;

@Component({
  selector: 'oib-oia-module',
  standalone: true,
  imports: [
    TranslateModule,
    ...formDirectives,
    RouterLink,
    BoxComponent,
    BoxTitleDirective,
    DatetimePipe,
    OibusCommandTypeEnumPipe,
    MultiSelectComponent,
    MultiSelectOptionDirective,
    PaginationComponent,
    OibusCommandStatusEnumPipe
  ],
  templateUrl: './oia-module.component.html',
  styleUrls: ['./oia-module.component.scss'],
  providers: [PageLoader]
})
export class OiaModuleComponent implements OnInit, OnDestroy {
  private oibusService = inject(EngineService);
  private oibusCommandService = inject(OibusCommandService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);

  registration: RegistrationSettingsDTO | null = null;
  commands: Page<OIBusCommand> = emptyPage();
  readonly statusList = OIBUS_COMMAND_STATUS;
  readonly typeList = OIBUS_COMMAND_TYPES;
  // subscription to reload the page periodically
  subscription = new Subscription();
  registrationSubscription = new Subscription();
  route = inject(ActivatedRoute);
  readonly searchForm = inject(NonNullableFormBuilder).group({
    types: this.route.snapshot.queryParamMap.getAll('types'),
    status: this.route.snapshot.queryParamMap.getAll('status')
  });

  ngOnInit(): void {
    this.createRegistrationSubscription();
    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => {
            // only reload the page if the page is 0
            if (page === 0) {
              return timer(0, 10_000).pipe(map(() => page));
            }
            return [page];
          }),
          exhaustMap(page => {
            const queryParamMap = this.route.snapshot.queryParamMap;
            const types: Array<OIBusCommandType> = queryParamMap.getAll('types') as Array<OIBusCommandType>;
            const status: Array<OIBusCommandStatus> = queryParamMap.getAll('status') as Array<OIBusCommandStatus>;
            return this.oibusCommandService.searchCommands({ page, types, status }).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(commands => {
          this.commands = commands;
        })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.registrationSubscription.unsubscribe();
  }

  register(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(this.registration!, 'register');

    modalRef.result.pipe(tap(() => this.notificationService.success('oia-module.registration.saved'))).subscribe(() => {
      this.createRegistrationSubscription();
    });
  }

  editRegister(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(this.registration!, 'edit');
  }

  createRegistrationSubscription(): void {
    this.registrationSubscription.unsubscribe();
    this.registrationSubscription = new Subscription();
    this.registrationSubscription.add(
      timer(0, REGISTRATION_CHECK_DURATION)
        .pipe(
          exhaustMap(() => {
            return this.oibusService.getRegistrationSettings();
          })
        )
        .subscribe(registration => {
          this.registration = registration;
          if (this.registration.status !== 'PENDING') {
            this.registrationSubscription.unsubscribe();
          }
        })
    );
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
        this.registrationSubscription.unsubscribe();
      });
  }

  searchCommands() {
    const searchFormValue = this.searchForm.value;
    const queryParams = {
      types: searchFormValue.types,
      status: searchFormValue.status,
      page: 0
    };
    this.router.navigate(['.'], { queryParams, relativeTo: this.route });
  }
}
