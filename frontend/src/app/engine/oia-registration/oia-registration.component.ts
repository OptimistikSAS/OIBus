import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EngineService } from '../../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { Modal, ModalService } from '../../shared/modal.service';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';
import { catchError, EMPTY, exhaustMap, map, Subscription, switchMap, tap, timer } from 'rxjs';
import { NotificationService } from '../../shared/notification.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { MultiSelectComponent } from '../../shared/form/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../../shared/form/multi-select/multi-select-option.directive';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { emptyPage } from '../../shared/test-utils';
import {
  OIBUS_COMMAND_STATUS,
  OIBUS_COMMAND_TYPES,
  OIBusCommandDTO,
  OIBusCommandStatus,
  OIBusCommandType
} from '../../../../../backend/shared/model/command.model';
import { Page } from '../../../../../backend/shared/model/types';
import { PageLoader } from '../../shared/page-loader.service';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { OibusCommandService } from '../../services/oibus-command.service';
import { OibusCommandTypeEnumPipe } from '../../shared/oibus-command-type-enum.pipe';
import { OibusCommandStatusEnumPipe } from '../../shared/oibus-command-status-enum.pipe';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { OiaCommandDetailsModalComponent } from './oibus-command-details-modal/oia-command-details-modal.component';

const REGISTRATION_CHECK_DURATION = 3000;

@Component({
  selector: 'oib-oia-module',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    DatetimePipe,
    OibusCommandTypeEnumPipe,
    MultiSelectComponent,
    MultiSelectOptionDirective,
    PaginationComponent,
    OibusCommandStatusEnumPipe,
    NgbTooltip,
    TranslatePipe
  ],
  templateUrl: './oia-registration.component.html',
  styleUrl: './oia-registration.component.scss',
  providers: [PageLoader]
})
export class OIARegistrationComponent implements OnInit, OnDestroy {
  private oibusService = inject(EngineService);
  private oibusCommandService = inject(OibusCommandService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);

  registration: RegistrationSettingsDTO | null = null;
  commands: Page<OIBusCommandDTO> = emptyPage();
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
            return this.oibusCommandService
              .search({ page, types, status, start: undefined, end: undefined, ack: undefined })
              .pipe(catchError(() => EMPTY));
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
    this.refreshAfterModalClosed(modalRef);
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
          if (this.registration!.status !== 'PENDING') {
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

  openCommandDetails(command: OIBusCommandDTO) {
    const modal = this.modalService.open(OiaCommandDetailsModalComponent, { size: 'lg' });
    modal.componentInstance.prepare(command);
  }

  private refreshAfterModalClosed(modalRef: Modal<any>) {
    modalRef.result
      .pipe(switchMap(() => this.oibusService.getRegistrationSettings()))
      .subscribe((registration: RegistrationSettingsDTO) => {
        this.registration = registration;
        this.notificationService.success('oia-module.registration.saved');
      });
  }

  deleteCommand(command: OIBusCommandDTO) {
    this.confirmationService
      .confirm({
        messageKey: 'oia-module.commands.confirm-delete'
      })
      .pipe(
        switchMap(() => this.oibusCommandService.delete(command)),
        tap(() => this.notificationService.success('oia-module.commands.deleted')),
        switchMap(() => {
          const queryParamMap = this.route.snapshot.queryParamMap;
          const page: number = +(queryParamMap.get('page') || 0);
          const types: Array<OIBusCommandType> = queryParamMap.getAll('types') as Array<OIBusCommandType>;
          const status: Array<OIBusCommandStatus> = queryParamMap.getAll('status') as Array<OIBusCommandStatus>;
          return this.oibusCommandService
            .search({ page, types, status, start: undefined, end: undefined, ack: undefined })
            .pipe(catchError(() => EMPTY));
        })
      )
      .subscribe(commands => {
        this.commands = commands;
      });
  }
}
