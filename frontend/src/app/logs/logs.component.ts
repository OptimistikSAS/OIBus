import { Component, inject, input, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PageLoader } from '../shared/page-loader.service';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  Group,
  Item,
  LOG_LEVELS,
  LogDTO,
  LogLevel,
  LogSearchParam,
  Scope,
  SCOPE_TYPES,
  ScopeType
} from '../../../../backend/shared/model/logs.model';
import { DateTime } from 'luxon';
import { Instant, Page } from '../../../../backend/shared/model/types';
import { ascendingDates } from '../shared/form/validators';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  map,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { emptyPage } from '../shared/test-utils';
import { LogService } from '../services/log.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { MultiSelectComponent } from '../shared/form/multi-select/multi-select.component';
import { MultiSelectOptionDirective } from '../shared/form/multi-select/multi-select-option.directive';
import { LogLevelsEnumPipe } from '../shared/log-levels-enum.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ScopeTypesEnumPipe } from '../shared/scope-types-enum.pipe';
import { NgbAccordionModule, NgbTooltip, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { PillComponent } from '../shared/pill/pill.component';
import { LegendComponent } from '../shared/legend/legend.component';
import { NgOptimizedImage } from '@angular/common';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'oib-logs',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
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
    NgbAccordionModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    NgbAccordionModule,
    NgbTooltip,
    NgOptimizedImage
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
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
      itemIds: null as string | null,
      groupIds: null as string | null,
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
  selectedItems = signal<Array<Item>>([]);
  selectedGroups = signal<Array<Group>>([]);
  loading = signal(false);
  // subscription to reload the page periodically
  subscription = new Subscription();
  logs = signal<Page<LogDTO>>(emptyPage());
  noLogMatchingWarning = signal(false);
  autoReloadPaused = signal(false);

  scopeTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestScopes(text)),
      tap(scopes => {
        this.noLogMatchingWarning.set(scopes.length === 0);
      })
    );
  scopeFormatter = (scope: Scope) => scope.scopeName;

  itemTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestItems(text))
    );
  itemFormatter = (item: Item) => item.itemName;

  groupTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestGroups(text))
    );
  groupFormatter = (group: Group) => group.groupName;

  private autoReloadPaused$ = toObservable(this.autoReloadPaused);

  ngOnInit(): void {
    const searchParams = this.toSearchParams(this.route);
    this.searchForm.setValue({
      messageContent: searchParams.messageContent || null,
      start: searchParams.start || null,
      end: searchParams.end || null,
      scopeTypes: searchParams.scopeTypes,
      scopeIds: '',
      itemIds: '',
      groupIds: '',
      levels: searchParams.levels,
      page: searchParams.page
    });
    if (this.scopeId() !== null && this.scopeType() !== null) {
      this.searchForm.controls.scopeTypes.disable();
      this.searchForm.controls.scopeIds.disable();
    }
    const queryScopeIds = this.route.snapshot.queryParamMap.getAll('scopeIds');
    if (queryScopeIds.length > 0) {
      combineLatest(queryScopeIds.map(scopeId => this.logService.getScopeById(scopeId).pipe(catchError(() => of(null))))).subscribe(
        selectedScopes => {
          this.selectedScopes.set(selectedScopes.filter(scope => !!scope) as Array<Scope>);
        }
      );
    }
    const queryItemIds = this.route.snapshot.queryParamMap.getAll('itemIds');
    if (queryItemIds.length > 0) {
      combineLatest(queryItemIds.map(itemId => this.logService.getItemById(itemId).pipe(catchError(() => of(null))))).subscribe(
        selectedItems => {
          this.selectedItems.set(selectedItems.filter(item => !!item) as Array<Item>);
        }
      );
    }
    const queryGroupIds = this.route.snapshot.queryParamMap.getAll('groupIds');
    if (queryGroupIds.length > 0) {
      combineLatest(queryGroupIds.map(groupId => this.logService.getGroupById(groupId).pipe(catchError(() => of(null))))).subscribe(
        selectedGroups => {
          this.selectedGroups.set(selectedGroups.filter(group => !!group) as Array<Group>);
        }
      );
    }
    this.subscription.add(
      combineLatest([this.pageLoader.pageLoads$, this.autoReloadPaused$.pipe(startWith(this.autoReloadPaused()))])
        .pipe(
          switchMap(([page, autoReloadPaused]) => {
            // only reload the page if the page is 0, no end date is set and auto-reload is not paused
            if (page === 0 && !this.searchForm.value.end && !autoReloadPaused) {
              return timer(0, 10_000).pipe(map(() => page));
            }
            return [page];
          }),
          exhaustMap(page => {
            this.loading.set(true);
            const criteria: LogSearchParam = { ...this.toSearchParams(this.route), page };
            return this.logService.search(criteria).pipe(catchError(() => EMPTY));
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
    const messageContent = queryParamMap.get('messageContent') || undefined;
    let scopeTypes: Array<ScopeType>;
    let scopeIds: Array<string>;
    const scopeId = this.scopeId();
    const scopeType = this.scopeType();
    if (scopeId !== null && scopeType !== null) {
      scopeTypes = [scopeType];
      scopeIds = [scopeId];
    } else {
      scopeTypes = queryParamMap.getAll('scopeTypes') as Array<ScopeType>;
      scopeIds = queryParamMap.getAll('scopeIds');
    }
    const start = queryParamMap.get('start') ?? now.minus({ days: 1 }).toISO();
    const end = queryParamMap.get('end') || undefined;
    const levels = queryParamMap.getAll('levels') as Array<LogLevel>;
    const itemIds = queryParamMap.getAll('itemIds');
    const groupIds = queryParamMap.getAll('groupIds');
    const page = queryParamMap.get('page') ? parseInt(queryParamMap.get('page')!, 10) : 0;
    return { messageContent, scopeTypes, scopeIds, itemIds, groupIds, start, end, levels, page };
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
      itemIds: this.selectedItems().map(item => item.itemId),
      groupIds: this.selectedGroups().map(group => group.groupId),
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

  selectItem(event: NgbTypeaheadSelectItemEvent<Item>) {
    this.selectedItems.update(items => [...items, event.item]);
    this.searchForm.controls.itemIds.setValue('');
    event.preventDefault();
  }

  removeItem(itemToRemove: Item) {
    this.selectedItems.update(items => items.filter(item => item.itemId !== itemToRemove.itemId));
  }

  selectGroup(event: NgbTypeaheadSelectItemEvent<Group>) {
    this.selectedGroups.update(groups => [...groups, event.item]);
    this.searchForm.controls.groupIds.setValue('');
    event.preventDefault();
  }

  removeGroup(groupToRemove: Group) {
    this.selectedGroups.update(groups => groups.filter(group => group.groupId !== groupToRemove.groupId));
  }

  getLevelClass(logLevel: LogLevel): string {
    const foundElement = this.LEGEND.find(element => element.label === `enums.log-levels.${logLevel}`);
    if (foundElement) {
      return foundElement.class;
    }
    return 'red-dot';
  }

  toggleAutoReload() {
    const isPaused = this.autoReloadPaused();

    if (!isPaused) {
      if (!this.searchForm.value.end) {
        this.searchForm.controls.end.setValue(DateTime.now().toISO());
      }
    } else {
      this.searchForm.controls.end.setValue(null);
      this.pageLoader.loadPage(this.logs(), 0);
    }

    this.autoReloadPaused.set(!isPaused);
  }
}
