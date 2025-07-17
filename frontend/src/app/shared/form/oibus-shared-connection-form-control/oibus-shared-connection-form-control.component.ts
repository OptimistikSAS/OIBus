import { Component, computed, input } from '@angular/core';
import { ControlContainer, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../form-validation-directives';
import { OIBusSharableConnectorAttribute } from '../../../../../../backend/shared/model/form.model';
import { SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { NorthConnectorLightDTO } from '../../../../../../backend/shared/model/north-connector.model';

@Component({
  selector: 'oib-oibus-shared-connection-form-control',
  templateUrl: './oibus-shared-connection-form-control.component.html',
  styleUrl: './oibus-shared-connection-form-control.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, TranslatePipe]
})
export class OibusSharedConnectionFormControlComponent {
  sharedConnectionAttribute = input.required<OIBusSharableConnectorAttribute>();
  southConnectors = input.required<Array<SouthConnectorLightDTO>>();
  northConnectors = input.required<Array<NorthConnectorLightDTO>>();
  currentConnector = input<{ connectorType: 'north' | 'south'; id: string | undefined; type: string }>();

  byConnectorIdComparisonFn(o1: { connectorId: string } | null, o2: { connectorId: string } | null): boolean {
    return (!o1 && !o2) || (o1 != null && o2 != null && o1.connectorId === o2.connectorId);
  }

  selectableConnectors = computed(() => {
    const connectors: Array<{ connectorType: 'north' | 'south'; connectorId: string; connectorName: string }> = [];
    const filteredSouth = this.southConnectors().filter(
      south => south.type === this.currentConnector()?.type && south.id !== this.currentConnector()?.id
    );
    const filteredNorth = this.northConnectors().filter(
      north => north.type === this.currentConnector()?.type && north.id !== this.currentConnector()?.id
    );
    for (const connector of filteredSouth) {
      connectors.push({ connectorType: 'south', connectorId: connector.id, connectorName: connector.name });
    }
    for (const connector of filteredNorth) {
      connectors.push({ connectorType: 'north', connectorId: connector.id, connectorName: connector.name });
    }
    return connectors;
  });
}
