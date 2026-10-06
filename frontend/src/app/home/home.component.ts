import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslateDirective } from '@ngx-translate/core';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';

import { EngineMetricsComponent } from '../engine/engine-metrics/engine-metrics.component';
import { NorthMetricsComponent } from '../north/north-metrics/north-metrics.component';
import { EngineService } from '../services/engine.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { SouthConnectorService } from '../services/south-connector.service';
import { pollMetrics } from '../shared/polling';
import { SouthMetricsComponent } from '../south/south-detail/south-metrics/south-metrics.component';

const NUMBER_OF_COLUMN = 3;

function toRows<T>(items: Array<T>): Array<Array<T>> {
  return items.reduce<Array<Array<T>>>((rows, item, i) => {
    if (i % NUMBER_OF_COLUMN === 0) rows.push([item]);
    else rows[rows.length - 1].push(item);
    return rows;
  }, []);
}

@Component({
  selector: 'oib-home',
  imports: [TranslateDirective, EngineMetricsComponent, NorthMetricsComponent, SouthMetricsComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly souths = toSignal(inject(SouthConnectorService).list(), { initialValue: [] as Array<SouthConnectorLightDTO> });
  private readonly norths = toSignal(inject(NorthConnectorService).list(), { initialValue: [] as Array<NorthConnectorLightDTO> });

  readonly southRows = computed(() => toRows(this.souths().filter(s => s.enabled)));
  readonly northRows = computed(() => toRows(this.norths().filter(n => n.enabled)));
  private readonly engineService = inject(EngineService);
  readonly homeMetrics = toSignal(
    pollMetrics(() => this.engineService.getHomeMetrics()),
    { initialValue: null }
  );
  readonly copyrightYear = new Date().getFullYear();
}
