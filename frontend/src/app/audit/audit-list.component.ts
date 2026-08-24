import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, EMPTY, Subscription, switchMap } from 'rxjs';
import { DateTime } from 'luxon';
import { AuditAction, AuditEntityType, AuditLogDTO, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../../../backend/shared/model/audit.model';
import { Instant, Page } from '../../../../backend/shared/model/types';
import { PageLoader } from '../shared/page-loader.service';
import { ascendingDates } from '../shared/form/validators';
import { emptyPage } from '../shared/test-utils';
import { AuditService, AuditSearchParam } from '../services/audit.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { AuditEntityTypesEnumPipe } from '../shared/audit-entity-types-enum.pipe';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { ModalService } from '../shared/modal.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';

/**
 * Standalone, server-paginated page listing every recorded audit log entry, with filters on
 * entity type, action and a date range. Clicking a row opens the full history for that entity
 * in the shared `AuditHistoryModalComponent`.
 */
@Component({
  selector: 'oib-audit-list',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    PaginationComponent,
    DatetimepickerComponent,
    DatetimePipe,
    AuditEntityTypesEnumPipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    NgbTooltip
  ],
  templateUrl: './audit-list.component.html',
  styleUrl: './audit-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [PageLoader]
})
export class AuditListComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);
  private auditService = inject(AuditService);
  private modalService = inject(ModalService);

  // Kept in sync with AuditEntityType in backend/shared/model/audit.model.ts
  readonly entityTypes: ReadonlyArray<AuditEntityType> = AUDIT_ENTITY_TYPES;
  readonly actions: ReadonlyArray<AuditAction> = AUDIT_ACTIONS;

  readonly searchForm = inject(NonNullableFormBuilder).group(
    {
      entityType: null as AuditEntityType | null,
      action: null as AuditAction | null,
      start: null as Instant | null,
      end: null as Instant | null,
      page: null as number | null
    },
    { validators: [ascendingDates] }
  );

  loading = signal(false);
  entries = signal<Page<AuditLogDTO>>(emptyPage());
  subscription = new Subscription();

  ngOnInit(): void {
    const searchParams = this.toSearchParams(this.route);
    this.searchForm.setValue({
      entityType: searchParams.entityType ?? null,
      action: searchParams.action ?? null,
      start: searchParams.start ?? null,
      end: searchParams.end ?? null,
      page: searchParams.page ?? null
    });

    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => {
            this.loading.set(true);
            const criteria: AuditSearchParam = { ...this.toSearchParams(this.route), page };
            return this.auditService.search(criteria).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(entries => {
          this.entries.set(entries);
          this.loading.set(false);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toSearchParams(route: ActivatedRoute): AuditSearchParam {
    const now = DateTime.now().endOf('minute');
    const queryParamMap = route.snapshot.queryParamMap;
    const entityType = (queryParamMap.get('entityType') as AuditEntityType | null) || undefined;
    const action = (queryParamMap.get('action') as AuditAction | null) || undefined;
    const start = queryParamMap.get('start') ?? now.minus({ days: 1 }).toISO();
    const end = queryParamMap.get('end') || undefined;
    const page = queryParamMap.get('page') ? parseInt(queryParamMap.get('page')!, 10) : 0;
    return { entityType, action, start: start ?? undefined, end, page };
  }

  triggerSearch(): void {
    if (!this.searchForm.valid) {
      return;
    }
    const formValue = this.searchForm.value;
    const criteria: AuditSearchParam = {
      entityType: formValue.entityType ?? undefined,
      action: formValue.action ?? undefined,
      start: formValue.start ?? undefined,
      end: formValue.end ?? undefined,
      page: 0
    };
    this.router.navigate([], { queryParams: criteria });
  }

  showHistory(entry: AuditLogDTO): void {
    const modalRef = this.modalService.open(AuditHistoryModalComponent, { size: 'xl' });
    modalRef.componentInstance.prepare(entry.entityType, entry.entityId);
  }
}
