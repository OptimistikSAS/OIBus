import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, EMPTY, exhaustMap, map, merge, of, startWith, Subject, switchMap, takeWhile, tap } from 'rxjs';

import { RegistrationSettingsDTO } from '@oibus/shared/api/engine.model';
import { Page } from '@oibus/shared/common/types';
import { RegistrationStatus } from '@oibus/shared/domain/engine.model';
import { PresentedServerIdentity } from '@oibus/shared/domain/server-identity.model';
import {
  OIBUS_COMMAND_STATUS,
  OIBUS_COMMAND_TYPES,
  OIBusCommandDTO,
  OIBusCommandStatus,
  OIBusCommandType
} from '@oibus/shared/oia/command.model';

import { EngineService } from '../../services/engine.service';
import { OibusCommandService } from '../../services/oibus-command.service';
import { ConfirmationService } from '../../shared/confirmation.service';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { MultiSelectComponent } from '../../shared/form/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../../shared/form/multi-select/multi-select-option.directive';
import { Modal, ModalService } from '../../shared/modal.service';
import { NotificationService } from '../../shared/notification.service';
import { OibusCommandStatusEnumPipe } from '../../shared/oibus-command-status-enum.pipe';
import { OibusCommandTypeEnumPipe } from '../../shared/oibus-command-type-enum.pipe';
import { PageLoader } from '../../shared/page-loader.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { visibleTimer } from '../../shared/polling';
import { ResizableColumnsDirective } from '../../shared/resizable-columns.directive';
import { toDisplayedServerTrust } from '../../shared/server-trust/server-trust';
import { askServerTrust } from '../../shared/server-trust/server-trust-modal/server-trust-modal.component';
import { ServerTrustPanelComponent } from '../../shared/server-trust/server-trust-panel/server-trust-panel.component';
import { emptyPage } from '../../shared/utils/page.utils';
import { OiaCommandDetailsModalComponent } from './oibus-command-details-modal/oia-command-details-modal.component';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';

const REGISTRATION_CHECK_DURATION = 3000;
const SERVER_TRUST_REFRESH_DURATION = 10_000;

@Component({
  selector: 'oib-oia-module',
  imports: [
    ResizableColumnsDirective,
    ReactiveFormsModule,
    TranslateDirective,
    DatetimePipe,
    OibusCommandTypeEnumPipe,
    MultiSelectComponent,
    MultiSelectOptionDirective,
    PaginationComponent,
    OibusCommandStatusEnumPipe,
    NgbTooltip,
    TranslatePipe,
    ServerTrustPanelComponent
  ],
  templateUrl: './oia-registration.component.html',
  styleUrl: './oia-registration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader]
})
export class OIARegistrationComponent {
  private readonly oibusService = inject(EngineService);
  private readonly oibusCommandService = inject(OibusCommandService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly modalService = inject(ModalService);
  private readonly router = inject(Router);
  private readonly pageLoader = inject(PageLoader);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly registration = signal<RegistrationSettingsDTO | null>(null);
  // refreshes the trust in the identity of OIAnalytics right away, once trusted
  private readonly serverTrustRefresh = new Subject<void>();
  // the status of the registration: the identity of OIAnalytics is only read while OIBus is (being) registered
  private readonly registrationStatus = new Subject<RegistrationStatus>();
  private readonly polledServerTrust = toSignal(
    this.registrationStatus.pipe(
      distinctUntilChanged(),
      switchMap(status =>
        status === 'NOT_REGISTERED'
          ? of(null)
          : merge(visibleTimer(SERVER_TRUST_REFRESH_DURATION), this.serverTrustRefresh).pipe(
              exhaustMap(() => this.oibusService.getRegistrationServerTrust().pipe(catchError(() => EMPTY)))
            )
      )
    ),
    { initialValue: null }
  );
  /** The trust of the registration in the identity of OIAnalytics, when there is something to show (see toDisplayedServerTrust) */
  readonly serverTrust = computed(() => toDisplayedServerTrust(this.polledServerTrust(), true));
  private readonly ignoreRemoteUpdate = toSignal(this.oibusService.getInfo().pipe(map(info => info.ignoreRemoteUpdate)), {
    initialValue: false
  });
  readonly commands = signal<Page<OIBusCommandDTO>>(emptyPage());
  readonly statusList = OIBUS_COMMAND_STATUS;
  readonly typeList = OIBUS_COMMAND_TYPES;
  // true to (re)start checking the registration until it is no longer pending, false to stop checking it
  private readonly registrationCheck = new Subject<boolean>();
  readonly searchForm = this.fb.group({
    // wrapped in a control: an array given to group() would be read as [value, validators]
    types: this.fb.control(this.route.snapshot.queryParamMap.getAll('types') as Array<OIBusCommandType>),
    status: this.fb.control(this.route.snapshot.queryParamMap.getAll('status') as Array<OIBusCommandStatus>)
  });

  constructor() {
    this.registrationCheck
      .pipe(
        startWith(true),
        switchMap(check =>
          check
            ? visibleTimer(REGISTRATION_CHECK_DURATION).pipe(
                exhaustMap(() => this.oibusService.getRegistrationSettings()),
                takeWhile(registration => registration.status === 'PENDING', true)
              )
            : EMPTY
        ),
        takeUntilDestroyed()
      )
      .subscribe(registration => this.setRegistration(registration));
    this.pageLoader.pageLoads$
      .pipe(
        switchMap(page => {
          // only reload the page if the page is 0
          if (page === 0) {
            return visibleTimer(10_000).pipe(map(() => page));
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
        }),
        takeUntilDestroyed()
      )
      .subscribe(commands => {
        this.commands.set(commands);
      });
  }

  private setRegistration(registration: RegistrationSettingsDTO) {
    this.registration.set(registration);
    this.registrationStatus.next(registration.status);
  }

  /** Reviews the identity of OIAnalytics the registration refused, and trusts it if the user does */
  reviewServerIdentity(pending: PresentedServerIdentity) {
    askServerTrust(this.modalService, 'review', pending, this.serverTrust()?.identity ?? null)
      .pipe(switchMap(() => this.oibusService.trustRegistrationServerIdentity(pending.identity.fingerprint)))
      .subscribe(() => {
        this.notificationService.success('oia-module.registration.server-trust.trusted');
        this.serverTrustRefresh.next();
        this.registrationCheck.next(true);
      });
  }

  register(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(this.registration()!, 'register', this.ignoreRemoteUpdate());

    modalRef.result.pipe(tap(() => this.notificationService.success('oia-module.registration.saved'))).subscribe(() => {
      this.registrationCheck.next(true);
    });
  }

  editRegister(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(this.registration()!, 'edit', this.ignoreRemoteUpdate());
    this.refreshAfterModalClosed(modalRef);
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
        this.registrationCheck.next(false);
        this.setRegistration(registration);
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

  private refreshAfterModalClosed(modalRef: Modal<RegisterOibusModalComponent>) {
    modalRef.result
      .pipe(switchMap(() => this.oibusService.getRegistrationSettings()))
      .subscribe((registration: RegistrationSettingsDTO) => {
        this.setRegistration(registration);
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
        this.commands.set(commands);
      });
  }
}
