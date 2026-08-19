import { Component, computed, HostListener, inject, input, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
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
  filter,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { emptyPage } from '../shared/test-utils';
import { LogService } from '../services/log.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { LogLevelsEnumPipe } from '../shared/log-levels-enum.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { DatetimePipe } from '../shared/datetime.pipe';
import { ScopeTypesEnumPipe } from '../shared/scope-types-enum.pipe';
import { NgbAccordionModule, NgbTooltip, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { NgOptimizedImage } from '@angular/common';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'oib-logs',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    PaginationComponent,
    LogLevelsEnumPipe,
    DatetimepickerComponent,
    DatetimePipe,
    ScopeTypesEnumPipe,
    NgbTypeahead,
    NgbAccordionModule,
    OI_FORM_VALIDATION_DIRECTIVES,
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

  // Each level pairs a distinct icon shape with its color, so meaning does not rely on color alone
  // (e.g. colorblind users can still tell ERROR from INFO even when red and green look the same).
  readonly LEGEND: Array<{ label: LogLevel; class: string }> = [
    { label: 'error', class: 'fa fa-times-circle level-red' },
    { label: 'warn', class: 'fa fa-exclamation-triangle level-yellow' },
    { label: 'info', class: 'fa fa-info-circle level-green' },
    { label: 'debug', class: 'fa fa-bug level-blue' },
    { label: 'trace', class: 'fa fa-search level-grey' }
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
  paused = signal(false);

  /** Windows offered in the log row context menu, as minutes before/after the clicked timestamp. */
  readonly CONTEXT_MENU_WINDOWS: ReadonlyArray<{ minutes: number; labelKey: string }> = [
    { minutes: 1, labelKey: 'logs.context-menu.1-minute' },
    { minutes: 5, labelKey: 'logs.context-menu.5-minutes' },
    { minutes: 15, labelKey: 'logs.context-menu.15-minutes' },
    { minutes: 30, labelKey: 'logs.context-menu.30-minutes' },
    { minutes: 60, labelKey: 'logs.context-menu.1-hour' }
  ];

  /** Position and target timestamp of the currently open log row context menu, or null when closed. */
  readonly contextMenu = signal<{ x: number; y: number; timestamp: Instant } | null>(null);

  scopeTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestScopes(text)),
      tap(scopes => {
        this.noLogMatchingWarning.set(scopes.length === 0);
      })
    );
  // ngbTypeahead also calls this formatter with the raw (typed or reset-to-empty) input string, not
  // just with a selected Scope, so it must be able to pass that string straight through unchanged.
  scopeFormatter = (scope: Scope | string) => (typeof scope === 'string' ? scope : scope.scopeName);

  itemTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestItems(text))
    );
  // Show the owning connector/history query name alongside the item name, since the same item name
  // can appear under several connectors and the plain name alone does not disambiguate them. ngbTypeahead
  // also calls this formatter with the raw (typed or reset-to-empty) input string, not just a selected
  // Item, so that case must be passed through unchanged rather than interpolated as "undefined (undefined)".
  itemFormatter = (item: Item | string) => (typeof item === 'string' ? item : `${item.itemName} (${item.scopeName})`);

  groupTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestGroups(text))
    );
  // Same rationale and same raw-string caveat as itemFormatter above.
  groupFormatter = (group: Group | string) => (typeof group === 'string' ? group : `${group.groupName} (${group.scopeName})`);

  /** Signal version of the current selected levels, kept in sync with the form control. */
  readonly activeLevels = toSignal(this.searchForm.controls.levels.valueChanges, {
    initialValue: this.searchForm.controls.levels.value
  });

  /** True when at least one level is selected (i.e. the filter is active). */
  readonly hasActiveLevels = computed(() => this.activeLevels()!.length > 0);

  /** Signal version of the current selected scope types, kept in sync with the form control. */
  readonly activeScopeTypes = toSignal(this.searchForm.controls.scopeTypes.valueChanges, {
    initialValue: this.searchForm.controls.scopeTypes.value
  });

  /** True when at least one scope type is selected (i.e. the filter is active). */
  readonly hasActiveScopeTypes = computed(() => this.activeScopeTypes()!.length > 0);

  /** Selected items grouped by their owning connector/history query, for the pills display. */
  readonly selectedItemsByScope = computed(() => groupByScope(this.selectedItems()));

  /** Selected groups grouped by their owning connector/history query, for the pills display. */
  readonly selectedGroupsByScope = computed(() => groupByScope(this.selectedGroups()));

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
      this.pageLoader.pageLoads$
        .pipe(
          switchMap(page =>
            timer(0, 10_000).pipe(
              // Always fire the initial tick (0); subsequent ticks respect the paused state.
              filter(tick => tick === 0 || !this.paused()),
              map(() => page)
            )
          ),
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
    this.triggerSearch();
  }

  removeScope(scopeToRemove: Scope) {
    this.selectedScopes.update(scopes => scopes.filter(scope => scope.scopeId !== scopeToRemove.scopeId));
    this.triggerSearch();
  }

  selectItem(event: NgbTypeaheadSelectItemEvent<Item>) {
    this.selectedItems.update(items => [...items, event.item]);
    this.searchForm.controls.itemIds.setValue('');
    event.preventDefault();
    this.triggerSearch();
  }

  removeItem(itemToRemove: Item) {
    this.selectedItems.update(items => items.filter(item => item.itemId !== itemToRemove.itemId));
    this.triggerSearch();
  }

  selectGroup(event: NgbTypeaheadSelectItemEvent<Group>) {
    this.selectedGroups.update(groups => [...groups, event.item]);
    this.searchForm.controls.groupIds.setValue('');
    event.preventDefault();
    this.triggerSearch();
  }

  removeGroup(groupToRemove: Group) {
    this.selectedGroups.update(groups => groups.filter(group => group.groupId !== groupToRemove.groupId));
    this.triggerSearch();
  }

  getLevelClass(logLevel: LogLevel): string {
    const foundElement = this.LEGEND.find(element => element.label === logLevel);
    if (foundElement) {
      return foundElement.class;
    }
    return 'fa fa-times-circle level-red';
  }

  /**
   * Toggles a log level in/out of the active level filter and immediately applies the search.
   * Clicking the same level twice clears the filter for that level.
   */
  toggleLevel(level: LogLevel) {
    const current = this.searchForm.controls.levels.value;
    const next = current.includes(level) ? current.filter(l => l !== level) : [...current, level];
    this.searchForm.controls.levels.setValue(next);
    this.triggerSearch();
  }

  /** Clears all active level filters and immediately applies the search. */
  clearLevels() {
    this.searchForm.controls.levels.setValue([]);
    this.triggerSearch();
  }

  /** Toggles a scope type in/out of the active scope-type filter and immediately applies the search. */
  toggleScopeType(scopeType: ScopeType) {
    const current = this.searchForm.controls.scopeTypes.value;
    const next = current.includes(scopeType) ? current.filter(t => t !== scopeType) : [...current, scopeType];
    this.searchForm.controls.scopeTypes.setValue(next);
    this.triggerSearch();
  }

  /** Clears all active scope-type filters and immediately applies the search. */
  clearScopeTypes() {
    this.searchForm.controls.scopeTypes.setValue([]);
    this.triggerSearch();
  }

  /** Opens the context menu for a log row at the click position, targeting that row's timestamp. */
  openContextMenu(event: MouseEvent, timestamp: Instant) {
    event.preventDefault();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, timestamp });
  }

  @HostListener('document:keydown.escape')
  closeContextMenu() {
    this.contextMenu.set(null);
  }

  /**
   * Clears every filter and searches the given number of minutes before and after the timestamp
   * that was right-clicked, then closes the context menu.
   */
  searchAroundTimestamp(timestamp: Instant, minutes: number) {
    const center = DateTime.fromISO(timestamp, { zone: 'utc' });
    this.selectedScopes.set([]);
    this.selectedItems.set([]);
    this.selectedGroups.set([]);
    this.searchForm.patchValue({
      start: center.minus({ minutes }).toISO(),
      end: center.plus({ minutes }).toISO(),
      messageContent: null,
      scopeTypes: [],
      scopeIds: '',
      itemIds: '',
      groupIds: '',
      levels: []
    });
    this.closeContextMenu();
    this.triggerSearch();
  }
}

/** A group of scope-owned entries (items or groups) sharing the same owning connector/history query. */
interface ScopeGroup<T> {
  scopeId: string;
  scopeName: string;
  entries: Array<T>;
}

/** Groups items/groups that carry a `scopeId`/`scopeName` by their owning connector/history query, preserving first-seen order. */
function groupByScope<T extends { scopeId: string; scopeName: string }>(entries: Array<T>): Array<ScopeGroup<T>> {
  const groups = new Map<string, ScopeGroup<T>>();
  for (const entry of entries) {
    const existing = groups.get(entry.scopeId);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(entry.scopeId, { scopeId: entry.scopeId, scopeName: entry.scopeName, entries: [entry] });
    }
  }
  return Array.from(groups.values());
}
