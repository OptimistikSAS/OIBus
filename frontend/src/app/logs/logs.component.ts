import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageLoader } from '../shared/page-loader.service';
import { NonNullableFormBuilder } from '@angular/forms';
import { LogDTO, LogSearchParam, Scope } from '../../../../shared/model/logs.model';
import { DateTime } from 'luxon';
import { Instant, Page } from '../../../../shared/model/types';
import { ascendingDates } from '../shared/validators';
import { LOG_LEVELS, LogLevel, SCOPE_TYPES, ScopeType } from '../../../../shared/model/engine.model';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { emptyPage } from '../shared/test-utils';
import { LogService } from '../services/log.service';
import { formDirectives } from '../shared/form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { MultiSelectComponent } from '../shared/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../shared/multi-select/multi-select-option.directive';
import { LogLevelsEnumPipe } from '../shared/log-levels-enum.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ScopeTypesEnumPipe } from '../shared/scope-types-enum.pipe';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/typeahead';
import { NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { PillComponent } from '../shared/pill/pill.component';

@Component({
  selector: 'oib-logs',
  standalone: true,
  imports: [
    TranslateModule,
    ...formDirectives,
    NgForOf,
    NgIf,
    PaginationComponent,
    MultiSelectComponent,
    MultiSelectOptionDirective,
    LogLevelsEnumPipe,
    DatetimepickerComponent,
    DatetimePipe,
    ScopeTypesEnumPipe,
    NgbTypeahead,
    PillComponent
  ],
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
  providers: [PageLoader]
})
export class LogsComponent implements OnInit, OnDestroy {
  readonly searchForm = this.fb.group(
    {
      messageContent: null as string | null,
      start: null as Instant | null,
      end: null as Instant | null,
      scopeTypes: [[] as Array<ScopeType>],
      scopeIds: null as string | null,
      levels: [[] as Array<LogLevel>],
      page: null as number | null
    },
    { validators: [ascendingDates] }
  );
  searchParams: LogSearchParam | null = null;
  readonly levels = LOG_LEVELS.filter(level => level !== 'silent');
  readonly scopeTypes = SCOPE_TYPES;
  selectedScopes: Array<Scope> = [];
  loading = false;
  // subscription to reload the page periodically
  subscription = new Subscription();
  logs: Page<LogDTO> = emptyPage();
  noLogMatchingWarning = false;

  scopeTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestByScopeName(text)),
      tap(scopes => {
        this.noLogMatchingWarning = scopes.length === 0;
      })
    );
  scopeFormatter = (scope: Scope) => scope.scopeName;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pageLoader: PageLoader,
    private fb: NonNullableFormBuilder,
    private logService: LogService
  ) {
    this.searchParams = this.toSearchParams(this.route);
    this.searchForm.setValue({
      messageContent: this.searchParams.messageContent,
      start: this.searchParams.start,
      end: this.searchParams.end,
      scopeTypes: this.searchParams.scopeTypes,
      scopeIds: '',
      levels: this.searchParams.levels,
      page: this.searchParams.page
    });
  }

  ngOnInit(): void {
    const queryScopeIds = this.route.snapshot.queryParamMap.getAll('scopeIds');
    if (queryScopeIds.length > 0) {
      combineLatest(queryScopeIds.map(scopeId => this.logService.getScopeById(scopeId))).subscribe(selectedScopes => {
        this.selectedScopes = selectedScopes.filter(scope => !!scope) as Array<Scope>;
      });
    }
    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => timer(0, 10_000).pipe(map(() => page))),
          exhaustMap(page => {
            this.searchParams = this.toSearchParams(this.route);
            this.loading = true;
            const criteria: LogSearchParam = { ...this.searchParams, page };
            return this.logService.searchLogs(criteria).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(logs => {
          this.logs = logs;
          this.loading = false;
        })
    );
  }

  toSearchParams(route: ActivatedRoute): LogSearchParam {
    const now = DateTime.now().endOf('minute');
    const queryParamMap = route.snapshot.queryParamMap;
    const messageContent = queryParamMap.get('messageContent');
    const scopeTypes = queryParamMap.getAll('scopeTypes');
    const scopeIds = queryParamMap.getAll('scopeIds');
    const start = queryParamMap.get('start') ?? now.minus({ days: 1 }).toISO();
    const end = queryParamMap.get('end');
    const levels = queryParamMap.getAll('levels');
    const page = queryParamMap.get('page') ? parseInt(queryParamMap.get('page')!, 10) : 0;
    return { messageContent, scopeTypes, scopeIds, start, end, levels, page };
  }

  triggerSearch() {
    if (!this.searchForm.valid) {
      return;
    }
    const formValue = this.searchForm.value;
    const criteria: LogSearchParam = {
      start: formValue.start!,
      end: formValue.end!,
      messageContent: formValue.messageContent!,
      levels: formValue.levels!,
      scopeTypes: formValue.scopeTypes!,
      scopeIds: this.selectedScopes!.map(scope => scope.scopeId),
      page: 0
    };

    this.router.navigate(['.'], { queryParams: criteria, relativeTo: this.route });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  selectScope(event: NgbTypeaheadSelectItemEvent<Scope>) {
    this.selectedScopes.push(event.item);
    this.searchForm.controls.scopeIds.setValue('');
    event.preventDefault();
  }

  removeScope(scopeToRemove: Scope) {
    this.selectedScopes = this.selectedScopes.filter(scope => scope.scopeId !== scopeToRemove.scopeId);
  }
}
