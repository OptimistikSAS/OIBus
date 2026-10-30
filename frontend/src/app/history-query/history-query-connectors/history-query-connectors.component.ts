import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';

import { TranslateDirective } from '@ngx-translate/core';
import { combineLatest, map, tap } from 'rxjs';

import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ConnectorChoiceComponent, createConnectorChoiceForm } from '../../shared/connector-choice/connector-choice.component';

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

/**
 * The first step of a new history query: the connectors it is created from, for each side either an existing connector whose
 * settings it duplicates, or a type to start from new settings.
 */
@Component({
  selector: 'oib-history-query-connectors',
  templateUrl: './history-query-connectors.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ConnectorChoiceComponent]
})
export class HistoryQueryConnectorsComponent {
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly createForm = this.fb.group({
    south: createConnectorChoiceForm(this.fb, true),
    north: createConnectorChoiceForm(this.fb, true)
  });

  // loaded once the form is created, each side starting from new settings when there is no existing connector
  readonly connectors = toSignal(
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
          this.createForm.controls.south.controls.fromExisting.setValue(false);
        }
        if (northList.length === 0) {
          this.createForm.controls.north.controls.fromExisting.setValue(false);
        }
      })
    )
  );

  /** The chosen connectors, once the form is valid */
  choice(): ConnectorChoice {
    const { south, north } = this.createForm.value;
    return {
      northType: north?.type || null,
      southType: south?.type || null,
      northId: north?.id || null,
      southId: south?.id || null
    };
  }
}
