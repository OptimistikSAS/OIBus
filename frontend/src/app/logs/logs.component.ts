import { Component, inject, OnDestroy, OnInit, input, signal } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageLoader } from '../shared/page-loader.service';
import { NonNullableFormBuilder } from '@angular/forms';
import { LogDTO, LogSearchParam, Scope } from '../../../../backend/shared/model/logs.model';
import { DateTime } from 'luxon';
import { Instant, Page } from '../../../../backend/shared/model/types';
import { ascendingDates } from '../shared/validators';
import { LOG_LEVELS, LogLevel, SCOPE_TYPES, ScopeType } from '../../../../backend/shared/model/engine.model';
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

import { PaginationComponent } from '../shared/pagination/pagination.component';
import { MultiSelectComponent } from '../shared/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../shared/multi-select/multi-select-option.directive';
import { LogLevelsEnumPipe } from '../shared/log-levels-enum.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ScopeTypesEnumPipe } from '../shared/scope-types-enum.pipe';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/typeahead';
import { NgbAccordionModule, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { PillComponent } from '../shared/pill/pill.component';
import { LegendComponent } from '../shared/legend/legend.component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'oib-logs',
  imports: [
    TranslateDirective,
    ...formDirectives,
    PaginationComponent,
    MultiSelectComponent,
    MultiSelectOptionDirective,
    LogLevelsEnumPipe,
    DatetimepickerComponent,
    DatetimePipe,
    ScopeTypesEnumPipe,
    NgbTypeahead,
    PillComponent,
    LegendComponent,
    NgClass,
    NgbAccordionModule
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  providers: [PageLoader]
})
export class LogsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageLoader = inject(PageLoader);
  private logService = inject(LogService);

  readonly scopeId = input<string | null>(null);
  readonly scopeType = input<ScopeType | null>(null);
  readonly embedded = input(false);

  readonly searchForm = inject(NonNullableFormBuilder).group(
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

  readonly LEGEND = [
    { label: 'enums.log-levels.error', class: 'red-dot' },
    { label: 'enums.log-levels.warn', class: 'yellow-dot' },
    { label: 'enums.log-levels.info', class: 'green-dot' },
    { label: 'enums.log-levels.debug', class: 'blue-dot' },
    { label: 'enums.log-levels.trace', class: 'grey-dot' }
  ];

  readonly levels = LOG_LEVELS.filter(level => level !== 'silent');
  readonly scopeTypes = SCOPE_TYPES;
  selectedScopes = signal<Array<Scope>>([]);
  loading = signal(false);
  // subscription to reload the page periodically
  subscription = new Subscription();
  logs = signal<Page<LogDTO>>(emptyPage());
  noLogMatchingWarning = signal(false);

  scopeTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestByScopeName(text)),
      tap(scopes => {
        this.noLogMatchingWarning.set(scopes.length === 0);
      })
    );
  scopeFormatter = (scope: Scope) => scope.scopeName;

  ngOnInit(): void {
    const searchParams = this.toSearchParams(this.route);
    this.searchForm.setValue({
      messageContent: searchParams.messageContent,
      start: searchParams.start,
      end: searchParams.end,
      scopeTypes: searchParams.scopeTypes,
      scopeIds: '',
      levels: searchParams.levels,
      page: searchParams.page
    });
    if (this.scopeId() !== null && this.scopeType() !== null) {
      this.searchForm.controls.scopeTypes.disable();
      this.searchForm.controls.scopeIds.disable();
    }
    const queryScopeIds = this.route.snapshot.queryParamMap.getAll('scopeIds');
    if (queryScopeIds.length > 0) {
      combineLatest(queryScopeIds.map(scopeId => this.logService.getScopeById(scopeId))).subscribe(selectedScopes => {
        this.selectedScopes.set(selectedScopes.filter(scope => !!scope));
      });
    }
    this.subscription.add(
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page => {
            // only reload the page if the page is 0 and no end date is set
            if (page === 0 && !this.searchForm.value.end) {
              return timer(0, 10_000).pipe(map(() => page));
            }
            return [page];
          }),
          exhaustMap(page => {
            this.loading.set(true);
            const criteria: LogSearchParam = { ...this.toSearchParams(this.route), page };
            return this.logService.searchLogs(criteria).pipe(catchError(() => EMPTY));
          })
        )
        .subscribe(logs => {
          this.logs.set(logs);
          this.loading.set(false);
        })
    );
  }

  toSearchParams(route: ActivatedRoute): LogSearchParam {
    const now = DateTime.now().endOf('minute');
    const queryParamMap = route.snapshot.queryParamMap;
    const messageContent = queryParamMap.get('messageContent');
    let scopeTypes: Array<string>;
    let scopeIds: Array<string>;
    const scopeId = this.scopeId();
    const scopeType = this.scopeType();
    if (scopeId !== null && scopeType !== null) {
      scopeTypes = [scopeType];
      scopeIds = [scopeId];
    } else {
      scopeTypes = queryParamMap.getAll('scopeTypes');
      scopeIds = queryParamMap.getAll('scopeIds');
    }
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
    const scopeId = this.scopeId();
    const scopeType = this.scopeType();
    const criteria: LogSearchParam = {
      start: formValue.start!,
      end: formValue.end!,
      messageContent: formValue.messageContent!,
      levels: formValue.levels!,
      scopeTypes: scopeType ? [scopeType] : formValue.scopeTypes!,
      scopeIds: scopeId ? [scopeId] : this.selectedScopes()!.map(scope => scope.scopeId),
      page: 0
    };
    this.router.navigate([], { queryParams: criteria });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  selectScope(event: NgbTypeaheadSelectItemEvent<Scope>) {
    this.selectedScopes.update(scopes => [...scopes, event.item]);
    this.searchForm.controls.scopeIds.setValue('');
    event.preventDefault();
  }

  removeScope(scopeToRemove: Scope) {
    this.selectedScopes.update(scopes => scopes.filter(scope => scope.scopeId !== scopeToRemove.scopeId));
  }

  getLevelClass(logLevel: LogLevel): string {
    const foundElement = this.LEGEND.find(element => element.label === `enums.log-levels.${logLevel}`);
    if (foundElement) {
      return foundElement.class;
    }
    return 'red-dot';
  }
}
