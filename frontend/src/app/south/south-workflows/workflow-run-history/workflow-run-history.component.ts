import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY, Subscription, switchMap } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ConfigurationWorkflowDTO } from '../../../../../../backend/shared/model/configuration-workflow.model';
import { Instant, Page } from '../../../../../../backend/shared/model/types';
import {
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_RUN_TRIGGER_TYPES,
  WorkflowRunDTO,
  WorkflowRunSearchParam,
  WorkflowRunStatus,
  WorkflowRunTriggerType
} from '../../../../../../backend/shared/model/workflow-run.model';
import { PageLoader } from '../../../shared/page-loader.service';
import { emptyPage } from '../../../shared/test-utils';
import { ConfigurationWorkflowService } from '../../../services/configuration-workflow.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { ModalService } from '../../../shared/modal.service';
import PreviewWorkflowModalComponent from '../preview-workflow-modal/preview-workflow-modal.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { DatetimepickerComponent } from '../../../shared/datetimepicker/datetimepicker.component';
import { ascendingDates } from '../../../shared/form/validators';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';

/**
 * Standalone, server-paginated page listing a Configuration Workflow's run history, most recent first -
 * filterable by a search form mirroring LogsComponent's own (date range, plus status/trigger type
 * filter chips that double as a legend, the same way that page's level/scope-type chips do). Always
 * shown in full (unlike LogsComponent's own collapsible form): this page is never embedded elsewhere,
 * so there's no reason to hide it behind a toggle.
 */
@Component({
  selector: 'oib-workflow-run-history',
  imports: [
    TranslateDirective,
    TranslatePipe,
    PaginationComponent,
    DatetimePipe,
    NgbTooltip,
    ReactiveFormsModule,
    DatetimepickerComponent,
    OI_FORM_VALIDATION_DIRECTIVES
  ],
  templateUrl: './workflow-run-history.component.html',
  styleUrl: './workflow-run-history.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [PageLoader]
})
export class WorkflowRunHistoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);
  private configurationWorkflowService = inject(ConfigurationWorkflowService);
  private modalService = inject(ModalService);
  private fb = inject(NonNullableFormBuilder);

  southId!: string;
  workflowId!: string;
  workflow = signal<ConfigurationWorkflowDTO | null>(null);
  loading = signal(false);
  runs = signal<Page<WorkflowRunDTO>>(emptyPage());
  subscription = new Subscription();

  readonly statuses = WORKFLOW_RUN_STATUSES;
  readonly triggerTypes = WORKFLOW_RUN_TRIGGER_TYPES;

  readonly searchForm = this.fb.group(
    {
      start: null as Instant | null,
      end: null as Instant | null,
      statuses: [[] as Array<WorkflowRunStatus>],
      triggerTypes: [[] as Array<WorkflowRunTriggerType>]
    },
    { validators: [ascendingDates] }
  );

  /** Signal version of the current selected statuses, kept in sync with the form control. */
  readonly activeStatuses = toSignal(this.searchForm.controls.statuses.valueChanges, {
    initialValue: this.searchForm.controls.statuses.value
  });

  /** True when at least one status is selected (i.e. the filter is active). */
  readonly hasActiveStatuses = computed(() => this.activeStatuses()!.length > 0);

  /** Signal version of the current selected trigger types, kept in sync with the form control. */
  readonly activeTriggerTypes = toSignal(this.searchForm.controls.triggerTypes.valueChanges, {
    initialValue: this.searchForm.controls.triggerTypes.value
  });

  /** True when at least one trigger type is selected (i.e. the filter is active). */
  readonly hasActiveTriggerTypes = computed(() => this.activeTriggerTypes()!.length > 0);

  /** Signal version of the route's own query params - the single source of truth for what's actually
   *  applied right now (as opposed to the search form's own live, not-yet-submitted buffer). */
  private readonly queryParamMap = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /** True once any filter is actually applied - distinguishes "no runs match the filters" from "no runs yet". */
  readonly hasActiveFilters = computed(() => {
    const map = this.queryParamMap();
    return !!(map.get('start') || map.get('end') || map.getAll('statuses').length > 0 || map.getAll('triggerTypes').length > 0);
  });

  ngOnInit(): void {
    this.southId = this.route.snapshot.paramMap.get('southId')!;
    this.workflowId = this.route.snapshot.paramMap.get('workflowId')!;

    this.configurationWorkflowService.get(this.southId, this.workflowId).subscribe(workflow => this.workflow.set(workflow));

    const searchParams = this.toSearchParams();
    this.searchForm.setValue({
      start: searchParams.start || null,
      end: searchParams.end || null,
      statuses: searchParams.statuses,
      triggerTypes: searchParams.triggerTypes
    });

    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => {
            this.loading.set(true);
            const criteria: WorkflowRunSearchParam = { ...this.toSearchParams(), page };
            return this.configurationWorkflowService.listRuns(this.southId, this.workflowId, criteria).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(runs => {
          this.runs.set(runs);
          this.loading.set(false);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** Reads the current filters straight from the URL - the single source of truth a bookmark/reload restores. */
  toSearchParams(): WorkflowRunSearchParam {
    const queryParamMap = this.route.snapshot.queryParamMap;
    const start = queryParamMap.get('start') || undefined;
    const end = queryParamMap.get('end') || undefined;
    const statuses = queryParamMap.getAll('statuses') as Array<WorkflowRunStatus>;
    const triggerTypes = queryParamMap.getAll('triggerTypes') as Array<WorkflowRunTriggerType>;
    const page = queryParamMap.get('page') ? parseInt(queryParamMap.get('page')!, 10) : 0;
    return { start, end, statuses, triggerTypes, page };
  }

  /** Applies the search form by navigating with the new filters as query params - always resets to page 0. */
  triggerSearch(): void {
    if (!this.searchForm.valid) {
      return;
    }
    const formValue = this.searchForm.value;
    this.router.navigate([], {
      queryParams: {
        start: formValue.start || null,
        end: formValue.end || null,
        statuses: formValue.statuses,
        triggerTypes: formValue.triggerTypes,
        page: 0
      }
    });
  }

  /** Toggles a status in/out of the active status filter and immediately applies the search. */
  toggleStatus(status: WorkflowRunStatus): void {
    const current = this.searchForm.controls.statuses.value;
    const next = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
    this.searchForm.controls.statuses.setValue(next);
    this.triggerSearch();
  }

  /** Clears the active status filter and immediately applies the search. */
  clearStatuses(): void {
    this.searchForm.controls.statuses.setValue([]);
    this.triggerSearch();
  }

  /** Toggles a trigger type in/out of the active trigger-type filter and immediately applies the search. */
  toggleTriggerType(triggerType: WorkflowRunTriggerType): void {
    const current = this.searchForm.controls.triggerTypes.value;
    const next = current.includes(triggerType) ? current.filter(t => t !== triggerType) : [...current, triggerType];
    this.searchForm.controls.triggerTypes.setValue(next);
    this.triggerSearch();
  }

  /** Clears the active trigger-type filter and immediately applies the search. */
  clearTriggerTypes(): void {
    this.searchForm.controls.triggerTypes.setValue([]);
    this.triggerSearch();
  }

  /** The badge color class for one status, used by the table's own status badge - it already carries a
   *  text label, so color there is only ever supplementary, never the sole differentiator. */
  getStatusClass(status: WorkflowRunStatus): string {
    switch (status) {
      case 'RUNNING':
        return 'bg-primary';
      case 'COMPLETED':
        return 'bg-success';
      case 'ERRORED':
        return 'bg-danger';
    }
  }

  /** Icon (+ color) class for one status, used by the filter chip legend - a distinct shape per status,
   *  not just a colored dot, so the legend stays readable for colorblind users (mirrors LogsComponent's
   *  own level icons). */
  getStatusIconClass(status: WorkflowRunStatus): string {
    switch (status) {
      case 'RUNNING':
        return 'fa fa-spinner text-primary';
      case 'COMPLETED':
        return 'fa fa-check-circle text-success';
      case 'ERRORED':
        return 'fa fa-times-circle text-danger';
    }
  }

  /**
   * Fetches this one run's full detail (fetched on demand - not part of the paginated list, which
   * stays lean) and shows it in the same modal a live Preview uses, just labeled for a past run
   * instead of a hypothetical next one. Opened immediately, with its own loading spinner, rather than
   * waiting for the fetch to resolve first - see PreviewWorkflowModalComponent.prepareForRunPayload,
   * which makes the request itself.
   */
  onViewPayload(run: WorkflowRunDTO): void {
    const modalRef = this.modalService.open(PreviewWorkflowModalComponent, { size: 'xl' });
    const component: PreviewWorkflowModalComponent = modalRef.componentInstance;
    component.prepareForRunPayload(this.southId, this.workflowId, run.id, this.workflow()?.name ?? '');
  }
}
