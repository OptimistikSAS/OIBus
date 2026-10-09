import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { catchError, EMPTY, switchMap } from 'rxjs';

import { AuditLogDTO } from '@oibus/shared/api/audit.model';
import { Instant, Page } from '@oibus/shared/common/types';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AuditAction, AuditEntityType } from '@oibus/shared/domain/audit.model';

import { AuditSearchParam, AuditService } from '../services/audit.service';
import { AuditEntityTypesEnumPipe } from '../shared/audit-entity-types-enum.pipe';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { AuditUserPipe } from '../shared/audit-user.pipe';
import { DatetimePipe } from '../shared/datetime.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { ascendingDates } from '../shared/form/validators';
import { ModalService } from '../shared/modal.service';
import { PageLoader } from '../shared/page-loader.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { emptyPage } from '../shared/utils/page.utils';

/**
 * Router link to the page displaying an audited entity: its own page for connectors and history queries, the
 * page of its owning connector or history query for child entities (items, groups, workflows, transformers),
 * and the engine page for engine-level entities (scan modes, IP filters, certificates…).
 * Returns null when the entity does not exist anymore, or has no page to display it (users).
 */
export function auditEntityLink(entry: AuditLogDTO): Array<string> | null {
  if (!entry.entity.exists) {
    return null;
  }
  const parentId = entry.entity.parentId;
  switch (entry.entityType) {
    case 'south_connector':
      return ['/south', entry.entityId];
    case 'south_item':
    case 'south_item_group':
    case 'configuration_workflow':
      return parentId ? ['/south', parentId] : null;
    case 'north_connector':
      return ['/north', entry.entityId];
    case 'north_transformer':
      return parentId ? ['/north', parentId] : null;
    case 'history_query':
      return ['/history-queries', entry.entityId];
    case 'history_query_item':
    case 'history_query_transformer':
      return parentId ? ['/history-queries', parentId] : null;
    case 'oianalytics_registration':
      return ['/engine', 'oianalytics'];
    case 'user':
      return null;
    case 'scan_mode':
    case 'ip_filter':
    case 'certificate':
    case 'transformer':
    case 'engine_general':
    case 'engine_web_server':
    case 'engine_proxy_server':
    case 'engine_logging':
      return ['/engine'];
  }
}

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
    NgbTooltip,
    RouterLink,
    AuditUserPipe
  ],
  templateUrl: './audit-list.component.html',
  styleUrl: './audit-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader]
})
export class AuditListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);
  private auditService = inject(AuditService);
  private modalService = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private fb = inject(NonNullableFormBuilder);

  // Kept in sync with AuditEntityType in backend/shared/model/audit.model.ts
  readonly entityTypes: ReadonlyArray<AuditEntityType> = AUDIT_ENTITY_TYPES;
  readonly actions: ReadonlyArray<AuditAction> = AUDIT_ACTIONS;
  readonly entityLink = auditEntityLink;

  readonly searchForm = this.fb.group(
    {
      entityType: null as AuditEntityType | null,
      action: null as AuditAction | null,
      start: null as Instant | null,
      end: null as Instant | null,
      page: null as number | null
    },
    { validators: [ascendingDates] }
  );

  readonly loading = signal(false);
  readonly entries = signal<Page<AuditLogDTO>>(emptyPage());

  ngOnInit(): void {
    const searchParams = this.toSearchParams(this.route);
    this.searchForm.setValue({
      entityType: searchParams.entityType ?? null,
      action: searchParams.action ?? null,
      start: searchParams.start ?? null,
      end: searchParams.end ?? null,
      page: searchParams.page ?? null
    });

    this.pageLoader.pageLoads$
      .pipe(
        switchMap(page => {
          this.loading.set(true);
          const criteria: AuditSearchParam = { ...this.toSearchParams(this.route), page };
          return this.auditService.search(criteria).pipe(
            catchError(() => {
              this.loading.set(false);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(entries => {
        this.entries.set(entries);
        this.loading.set(false);
      });
  }

  toSearchParams(route: ActivatedRoute): AuditSearchParam {
    const now = DateTime.now().endOf('minute');
    const queryParamMap = route.snapshot.queryParamMap;
    const entityType = (queryParamMap.get('entityType') as AuditEntityType | null) || undefined;
    const action = (queryParamMap.get('action') as AuditAction | null) || undefined;
    const start = queryParamMap.get('start') ?? now.minus({ weeks: 1 }).toISO();
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
