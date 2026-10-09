import { Directive, input } from '@angular/core';

/** Context of the templates rendered for each item: the item itself. */
export interface ItemTableRowContext<T> {
  $implicit: T;
}

/** Context of the header template: the sort helpers, so that the page's columns can be sortable too. */
export interface ItemTableHeaderContext {
  /** The Font Awesome icon class of the sort state of the column */
  sortIcon: (column: string) => string;
  /** Cycles the sort of the column (ascending, descending, none) */
  toggleSort: (column: string) => void;
}

/**
 * Additional filters of the page, rendered after the name filter (e.g. a select). The page applies them through the
 * `extraFilter` input of the table.
 */
@Directive({ selector: 'ng-template[oibItemTableFilters]' })
export class ItemTableFiltersDirective {}

/** Additional header cells (`<th>`) of the page, rendered after the name column. */
@Directive({ selector: 'ng-template[oibItemTableHeaders]' })
export class ItemTableHeadersDirective {
  static ngTemplateContextGuard(_directive: ItemTableHeadersDirective, _context: unknown): _context is ItemTableHeaderContext {
    return true;
  }
}

/**
 * Additional cells (`<td>`) of the page for an item, rendered after the name column.
 * The items given to the directive type the template variable: `<ng-template [oibItemTableCells]="items" let-item>`.
 */
@Directive({ selector: 'ng-template[oibItemTableCells]' })
export class ItemTableCellsDirective<T> {
  readonly oibItemTableCells = input.required<ReadonlyArray<T>>();

  static ngTemplateContextGuard<T>(_directive: ItemTableCellsDirective<T>, _context: unknown): _context is ItemTableRowContext<T> {
    return true;
  }
}

/**
 * The action buttons of an item (edit, duplicate, delete...), rendered in the last column.
 * The items given to the directive type the template variable: `<ng-template [oibItemTableActions]="items" let-item>`.
 */
@Directive({ selector: 'ng-template[oibItemTableActions]' })
export class ItemTableActionsDirective<T> {
  readonly oibItemTableActions = input.required<ReadonlyArray<T>>();

  static ngTemplateContextGuard<T>(_directive: ItemTableActionsDirective<T>, _context: unknown): _context is ItemTableRowContext<T> {
    return true;
  }
}

/** Additional actions on the selected items (`ngbDropdownItem` buttons), rendered after enable/disable. */
@Directive({ selector: 'ng-template[oibItemTableMassActions]' })
export class ItemTableMassActionsDirective {}

export const ITEM_TABLE_TEMPLATES = [
  ItemTableFiltersDirective,
  ItemTableHeadersDirective,
  ItemTableCellsDirective,
  ItemTableActionsDirective,
  ItemTableMassActionsDirective
] as const;
