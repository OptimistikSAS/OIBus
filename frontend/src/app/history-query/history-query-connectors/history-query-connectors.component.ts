import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map, tap } from 'rxjs';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';

/** The connectors a new history query is created from: existing connectors, whose settings it starts with, or connector types */
export interface ConnectorChoice {
  southId: string | null;
  northId: string | null;
  southType: string | null;
  northType: string | null;
}

/** Whether two choices of connectors are the same */
export function sameConnectorChoice(choice: ConnectorChoice, other: ConnectorChoice | null): boolean {
  return (
    !!other &&
    choice.southId === other.southId &&
    choice.northId === other.northId &&
    choice.southType === other.southType &&
    choice.northType === other.northType
  );
}

/** A side of the history query (South or North), as offered in the step: its existing connectors, and its types by category */
interface ConnectorSide {
  side: 'south' | 'north';
  existing: Array<{ id: string; name: string; type: string }>;
  categories: Array<{ category: string; types: Array<{ id: string; beta: boolean }> }>;
}

/** The connector types, grouped by category in their order */
function groupByCategory(types: Array<SouthType | NorthType>): ConnectorSide['categories'] {
  const categories: ConnectorSide['categories'] = [];
  for (const type of types) {
    let group = categories.find(element => element.category === type.category);
    if (!group) {
      group = { category: type.category, types: [] };
      categories.push(group);
    }
    group.types.push({ id: type.id, beta: !!type.beta });
  }
  return categories;
}

/**
 * The first step of a new history query: the connectors it is created from, for each side either an existing connector whose
 * settings it duplicates, or a type to start from new settings.
 */
@Component({
  selector: 'oib-history-query-connectors',
  templateUrl: './history-query-connectors.component.html',
  styleUrl: './history-query-connectors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule, TranslateDirective, TranslatePipe, OI_FORM_VALIDATION_DIRECTIVES]
})
export class HistoryQueryConnectorsComponent {
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly createForm = this.fb.group({
    fromExistingSouth: true,
    fromExistingNorth: true,
    southType: [{ value: null as string | null, disabled: true }, Validators.required],
    northType: [{ value: null as string | null, disabled: true }, Validators.required],
    southId: [null as string | null, Validators.required],
    northId: [null as string | null, Validators.required]
  });
  /**
   * The value of the form, disabled controls included: what is chosen on each side. Updated on every event of the form, its errors
   * being shown once touched (e.g. by the Next button of the page).
   */
  readonly selection = toSignal(this.createForm.events.pipe(map(() => this.createForm.getRawValue())), {
    initialValue: this.createForm.getRawValue()
  });

  private readonly connectors: Signal<
    | {
        northTypes: Array<NorthType>;
        northList: Array<NorthConnectorLightDTO>;
        southTypes: Array<SouthType>;
        southList: Array<SouthConnectorLightDTO>;
      }
    | undefined
  >;
  readonly south = computed<ConnectorSide>(() => ({
    side: 'south',
    existing: this.connectors()?.southList ?? [],
    categories: groupByCategory(this.connectors()?.southTypes ?? [])
  }));
  readonly north = computed<ConnectorSide>(() => ({
    side: 'north',
    existing: this.connectors()?.northList ?? [],
    categories: groupByCategory(this.connectors()?.northTypes ?? [])
  }));

  constructor() {
    this.createForm.controls.fromExistingNorth.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (value) {
        this.createForm.controls.northId.enable();
        this.createForm.controls.northType.disable();
      } else {
        this.createForm.controls.northId.disable();
        this.createForm.controls.northType.enable();
      }
    });
    this.createForm.controls.fromExistingSouth.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (value) {
        this.createForm.controls.southId.enable();
        this.createForm.controls.southType.disable();
      } else {
        this.createForm.controls.southId.disable();
        this.createForm.controls.southType.enable();
      }
    });

    // loaded once the form reacts to the modes, which start from new settings when there is no existing connector
    this.connectors = toSignal(
      combineLatest([
        this.northConnectorService.getNorthTypes(),
        this.northConnectorService.list(),
        this.southConnectorService.getSouthTypes(),
        this.southConnectorService.list()
      ]).pipe(
        map(([northTypes, northList, southTypes, southList]) => ({
          northTypes,
          northList,
          // Keep only South with history mode supported
          southTypes: southTypes.filter(southManifest => southManifest.modes.history),
          southList: southList.filter(south => southTypes.find(manifest => manifest.id === south.type)?.modes.history)
        })),
        tap(({ northList, southList }) => {
          if (southList.length === 0) {
            this.createForm.controls.fromExistingSouth.setValue(false);
          }
          if (northList.length === 0) {
            this.createForm.controls.fromExistingNorth.setValue(false);
          }
        })
      )
    );
  }

  /** The controls of a side */
  controls(side: ConnectorSide['side']): {
    fromExisting: FormControl<boolean>;
    id: FormControl<string | null>;
    type: FormControl<string | null>;
  } {
    const controls = this.createForm.controls;
    return side === 'south'
      ? { fromExisting: controls.fromExistingSouth, id: controls.southId, type: controls.southType }
      : { fromExisting: controls.fromExistingNorth, id: controls.northId, type: controls.northType };
  }

  /** Whether a side duplicates an existing connector, or starts from new settings */
  fromExisting(side: ConnectorSide['side']): boolean {
    const selection = this.selection();
    return side === 'south' ? selection.fromExistingSouth : selection.fromExistingNorth;
  }

  /** The existing connector or the type chosen on a side */
  chosen(side: ConnectorSide['side']): string | null {
    const selection = this.selection();
    if (side === 'south') {
      return selection.fromExistingSouth ? selection.southId : selection.southType;
    }
    return selection.fromExistingNorth ? selection.northId : selection.northType;
  }

  setFromExisting(side: ConnectorSide['side'], fromExisting: boolean) {
    this.controls(side).fromExisting.setValue(fromExisting);
  }

  /** Chooses an existing connector, or a type, depending on the mode of the side */
  choose(side: ConnectorSide['side'], value: string) {
    const controls = this.controls(side);
    const control = controls.fromExisting.value ? controls.id : controls.type;
    control.setValue(value);
    control.markAsDirty();
  }

  /** The context of the side template, typed */
  protected asSide(side: ConnectorSide): ConnectorSide {
    return side;
  }

  /** The chosen connectors, once the form is valid */
  choice(): ConnectorChoice {
    const formValues = this.createForm.value;
    return {
      northType: formValues.northType || null,
      southType: formValues.southType || null,
      northId: formValues.northId || null,
      southId: formValues.southId || null
    };
  }
}
