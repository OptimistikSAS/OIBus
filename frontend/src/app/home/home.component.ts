import { Component, DestroyRef, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { NorthConnectorLightDTO } from '../../../../backend/shared/model/north-connector.model';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { EngineMetricsComponent } from '../engine/engine-metrics/engine-metrics.component';
import { NorthMetricsComponent } from '../north/north-metrics/north-metrics.component';
import { SouthMetricsComponent } from '../south/south-detail/south-metrics/south-metrics.component';
import { HomeMetrics } from '../../../../backend/shared/model/engine.model';
import { WindowService } from '../shared/window.service';

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
  readonly homeMetrics = signal<HomeMetrics | null>(null);
  readonly copyrightYear = new Date().getFullYear();

  constructor() {
    const token = inject(WindowService).getStorageItem('oibus-token');
    const stream = new EventSource(`/sse/home?token=${token}`, { withCredentials: true });
    stream.onmessage = (event: MessageEvent) => {
      if (event?.data) this.homeMetrics.set(JSON.parse(event.data) as HomeMetrics);
    };
    inject(DestroyRef).onDestroy(() => stream.close());
  }
}
