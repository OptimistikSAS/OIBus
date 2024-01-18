import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgForOf, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { BoxComponent, BoxTitleDirective } from '../shared/box/box.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ModalService } from '../shared/modal.service';
import { RegisterOibusModalComponent } from './register-oibus-modal/register-oibus-modal.component';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import { NotificationService } from '../shared/notification.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { MultiSelectComponent } from '../shared/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../shared/multi-select/multi-select-option.directive';
import { formDirectives } from '../shared/form-directives';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { emptyPage } from '../shared/test-utils';
import {
  OIBUS_COMMAND_STATUS,
  OIBUS_COMMAND_TYPES,
  OIBusCommandDTO,
  OIBusCommandStatus,
  OIBusCommandType
} from '../../../../shared/model/command.model';
import { Page } from '../../../../shared/model/types';
import { PageLoader } from '../shared/page-loader.service';
import { NonNullableFormBuilder } from '@angular/forms';
import { OibusCommandService } from '../services/oibus-command.service';
import { OibusCommandTypeEnumPipe } from '../shared/oibus-command-type-enum.pipe';
import { OibusCommandStatusEnumPipe } from '../shared/oibus-command-status-enum.pipe';

@Component({
  selector: 'oib-oia-module',
  standalone: true,
  imports: [
    TranslateModule,
    ...formDirectives,
    NgForOf,
    NgIf,
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
export class OiaModuleComponent implements OnInit {
  registration: RegistrationSettingsDTO | null = null;
  oibusCommands: Page<OIBusCommandDTO> = emptyPage();
  readonly statusList = OIBUS_COMMAND_STATUS;
  readonly typeList = OIBUS_COMMAND_TYPES;
  readonly searchForm = this.fb.group({
    types: this.route.snapshot.queryParamMap.getAll('types'),
    status: this.route.snapshot.queryParamMap.getAll('status')
  });

  constructor(
    private oibusService: EngineService,
    private oibusCommandService: OibusCommandService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private modalService: ModalService,
    private route: ActivatedRoute,
    private router: Router,
    private pageLoader: PageLoader,
    private fb: NonNullableFormBuilder
  ) {}

  ngOnInit(): void {
    this.pageLoader.pageLoads$
      .pipe(
        switchMap(pageNumber => {
          const queryParamMap = this.route.snapshot.queryParamMap;
          const types: Array<OIBusCommandType> = queryParamMap.getAll('types') as Array<OIBusCommandType>;
          const status: Array<OIBusCommandStatus> = queryParamMap.getAll('status') as Array<OIBusCommandStatus>;
          return this.oibusCommandService.searchCommands({ page: pageNumber, types, status }).pipe(catchError(() => EMPTY));
        })
      )
      .subscribe(oibusCommands => {
        this.oibusCommands = oibusCommands;
      });

    this.oibusService.getRegistrationSettings().subscribe(registration => {
      this.registration = registration;
    });
  }

  register(): void {
    const modalRef = this.modalService.open(RegisterOibusModalComponent, { size: 'xl' });
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
