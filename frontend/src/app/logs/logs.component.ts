import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbAccordionModule, NgbTooltip, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  filter,
  finalize,
  map,
  Observable,
  of,
  switchMap
} from 'rxjs';

import { LogDTO } from '@oibus/shared/api/logs.model';
import { Instant, Page } from '@oibus/shared/common/types';
import { Group, Item, LOG_LEVELS, LogLevel, LogSearchParam, Scope, SCOPE_TYPES, ScopeType } from '@oibus/shared/domain/logs.model';

import { LogService } from '../services/log.service';
import { DatetimePipe } from '../shared/datetime.pipe';
import { DatetimepickerComponent } from '../shared/datetimepicker/datetimepicker.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../shared/form/form-validation-directives';
import { TYPEAHEAD_DEBOUNCE_TIME } from '../shared/form/typeahead';
import { ascendingDates } from '../shared/form/validators';
import { LogLevelsEnumPipe } from '../shared/log-levels-enum.pipe';
import { PageLoader } from '../shared/page-loader.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { visibleTimer } from '../shared/polling';
import { ScopeTypesEnumPipe } from '../shared/scope-types-enum.pipe';
import { emptyPage } from '../shared/utils/page.utils';

@Component({
  selector: 'oib-logs',
  host: {
    '(document:keydown.escape)': 'closeContextMenu()'
  },
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PageLoader]
})
export class LogsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageLoader = inject(PageLoader);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly scopeId = input<string | null>(null);
  readonly scopeType = input<ScopeType | null>(null);
  readonly embedded = input(false);

  /** True on the standalone logs page, i.e. when the search is not locked to a connector or history query. */
  readonly standalone = computed(() => !this.scopeId() && !this.scopeType());

  // On the standalone logs page (no scope lock), items and groups from every connector are searchable.
  // Embedded on a south connector's page, both are searchable but restricted to that connector. Embedded
  // on a history query's page, only items apply (history queries have no group concept). Embedded on a
  // north connector's page, neither applies (north connectors have no items/groups at all).
  readonly showItemSearch = computed(
    () => this.scopeType() === null || this.scopeType() === 'south' || this.scopeType() === 'history-query'
  );
  readonly showGroupSearch = computed(() => this.scopeType() === null || this.scopeType() === 'south');

  readonly searchForm = this.formBuilder.group(
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
  readonly LEGEND: ReadonlyArray<{ label: LogLevel; class: string }> = [
    { label: 'error', class: 'fa-solid fa-times-circle level-red' },
    { label: 'warn', class: 'fa-solid fa-exclamation-triangle level-yellow' },
    { label: 'info', class: 'fa-solid fa-info-circle level-green' },
    { label: 'debug', class: 'fa-solid fa-bug level-blue' },
    { label: 'trace', class: 'fa-solid fa-search level-grey' }
  ];

  readonly levels = LOG_LEVELS.filter(level => level !== 'silent');
  readonly scopeTypes = SCOPE_TYPES;
  readonly selectedScopes = signal<Array<Scope>>([]);
  readonly selectedItems = signal<Array<Item>>([]);
  readonly selectedGroups = signal<Array<Group>>([]);
  readonly loading = signal(false);
  readonly logs = signal<Page<LogDTO>>(emptyPage());
  readonly paused = signal(false);

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

  readonly scopeTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestScopes(text))
    );
  // ngbTypeahead also calls this formatter with the raw (typed or reset-to-empty) input string, not
  // just with a selected Scope, so it must be able to pass that string straight through unchanged.
  readonly scopeFormatter = (scope: Scope | string) => (typeof scope === 'string' ? scope : scope.scopeName);

  readonly itemTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestItems(text, this.scopeId() ?? undefined))
    );
  // Show the owning connector/history query name alongside the item name, since the same item name
  // can appear under several connectors and the plain name alone does not disambiguate them — except
  // when the search is already locked to a single scope (embedded on that connector's own page), where
  // every suggestion shares the same scope and the suffix would just be noise. ngbTypeahead also calls
  // this formatter with the raw (typed or reset-to-empty) input string, not just a selected Item, so
  // that case must be passed through unchanged rather than interpolated as "undefined (undefined)".
  readonly itemFormatter = (item: Item | string) => {
    if (typeof item === 'string') return item;
    return this.scopeId() ? item.itemName : `${item.itemName} (${item.scopeName})`;
  };

  readonly groupTypeahead = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(TYPEAHEAD_DEBOUNCE_TIME),
      distinctUntilChanged(),
      switchMap(text => this.logService.suggestGroups(text, this.scopeId() ?? undefined))
    );
  // Same rationale and same raw-string caveat as itemFormatter above.
  readonly groupFormatter = (group: Group | string) => {
    if (typeof group === 'string') return group;
    return this.scopeId() ? group.groupName : `${group.groupName} (${group.scopeName})`;
  };

  /** Signal version of the current selected levels, kept in sync with the form control. */
  readonly activeLevels = toSignal(this.searchForm.controls.levels.valueChanges, {
    initialValue: this.searchForm.controls.levels.value
  });

  /** True when at least one level is selected (i.e. the filter is active). */
  readonly hasActiveLevels = computed(() => this.activeLevels().length > 0);

  /** Signal version of the current selected scope types, kept in sync with the form control. */
  readonly activeScopeTypes = toSignal(this.searchForm.controls.scopeTypes.valueChanges, {
    initialValue: this.searchForm.controls.scopeTypes.value
  });

  /** True when at least one scope type is selected (i.e. the filter is active). */
  readonly hasActiveScopeTypes = computed(() => this.activeScopeTypes().length > 0);

  /** Selected items grouped by their owning connector/history query, for the pills display. */
  readonly selectedItemsByScope = computed(() => groupByScope(this.selectedItems()));

  /** Selected groups grouped by their owning connector/history query, for the pills display. */
  readonly selectedGroupsByScope = computed(() => groupByScope(this.selectedGroups()));

  ngOnInit(): void {
    // The inputs (scope lock) are only available from here, hence the initialization in ngOnInit
    const searchParams = this.toSearchParams();
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
    const queryParamMap = this.route.snapshot.queryParamMap;
    loadSelection(queryParamMap.getAll('scopeIds'), id => this.logService.getScopeById(id), this.selectedScopes);
    loadSelection(queryParamMap.getAll('itemIds'), id => this.logService.getItemById(id), this.selectedItems);
    loadSelection(queryParamMap.getAll('groupIds'), id => this.logService.getGroupById(id), this.selectedGroups);

    this.pageLoader.pageLoads$
      .pipe(
        switchMap(page =>
          // Refresh while the page is visible only, so a forgotten tab does not keep querying OIBus
          visibleTimer(10_000).pipe(
            // Always fire the initial tick; subsequent ticks respect the paused state.
            filter((_, index) => index === 0 || !this.paused()),
            map(() => page)
          )
        ),
        exhaustMap(page => {
          this.loading.set(true);
          const criteria: LogSearchParam = { ...this.toSearchParams(), page };
          return this.logService.search(criteria).pipe(
            catchError(() => EMPTY),
            // also on error, so that a failed search does not leave the search button disabled
            finalize(() => this.loading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(logs => this.logs.set(logs));
  }

  private toSearchParams(): LogSearchParam {
    const now = DateTime.now().endOf('minute');
    const queryParamMap = this.route.snapshot.queryParamMap;
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
      scopeIds: scopeId ? [scopeId] : this.selectedScopes().map(scope => scope.scopeId),
      itemIds: this.selectedItems().map(item => item.itemId),
      groupIds: this.selectedGroups().map(group => group.groupId),
      page: 0
    };
    this.router.navigate([], { queryParams: criteria });
  }

  toggleAutoReload() {
    this.paused.update(paused => !paused);
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
    return 'fa-solid fa-times-circle level-red';
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

/**
 * Loads the entries (scopes, items or groups) whose ids are given (from the query params) into the given selection.
 * An entry that cannot be loaded (e.g. deleted since) is ignored.
 */
function loadSelection<T>(ids: Array<string>, load: (id: string) => Observable<T | null>, selection: WritableSignal<Array<T>>) {
  if (ids.length === 0) {
    return;
  }
  combineLatest(ids.map(id => load(id).pipe(catchError(() => of(null))))).subscribe(entries =>
    selection.set(entries.filter((entry): entry is T => !!entry))
  );
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
