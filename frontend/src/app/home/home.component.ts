import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgForOf, NgIf } from '@angular/common';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { combineLatest } from 'rxjs';
import { EngineMetricsComponent } from '../engine/engine-metrics/engine-metrics.component';
import { NorthMetricsComponent } from '../north/north-metrics/north-metrics.component';
import { SouthMetricsComponent } from '../south/south-metrics/south-metrics.component';
import { HomeMetrics } from '../../../../shared/model/engine.model';
import { RouterLink } from '@angular/router';
import { WindowService } from '../shared/window.service';

const NUMBER_OF_COLUMN = 3;

@Component({
  selector: 'oib-home',
  standalone: true,
  imports: [TranslateModule, NgForOf, NgIf, EngineMetricsComponent, NorthMetricsComponent, SouthMetricsComponent, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly copyrightYear = new Date().getFullYear();
  southRows: Array<Array<SouthConnectorDTO>> = [];
  northRows: Array<Array<NorthConnectorDTO>> = [];
  stream: EventSource | null = null;
  homeMetrics: HomeMetrics | null = null;

  constructor(
    private windowService: WindowService,
    private southService: SouthConnectorService,
    private northService: NorthConnectorService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([this.southService.list(), this.northService.list()]).subscribe(([souths, norths]) => {
      this.southRows = [];
      const enabledSouth = souths.filter(south => south.enabled);
      for (let i = 0; i < enabledSouth.length; i++) {
        if (i % NUMBER_OF_COLUMN === 0) {
          this.southRows.push([enabledSouth[i]]);
        } else {
          this.southRows[this.southRows.length - 1].push(enabledSouth[i]);
        }
      }
      this.northRows = [];
      const enabledNorth = norths.filter(north => north.enabled);
      for (let i = 0; i < enabledNorth.length; i++) {
        if (i % NUMBER_OF_COLUMN === 0) {
          this.northRows.push([enabledNorth[i]]);
        } else {
          this.northRows[this.northRows.length - 1].push(enabledNorth[i]);
        }
      }
      this.connectToEventSource();
    });
  }

  connectToEventSource(): void {
    const token = this.windowService.getStorageItem('oibus-token');
    this.stream = new EventSource(`/sse/home?token=${token}`, { withCredentials: true });
    this.stream.onmessage = (event: MessageEvent) => {
      if (event && event.data) {
        this.homeMetrics = JSON.parse(event.data);
        this.cd.detectChanges();
      }
    };
  }

  ngOnDestroy() {
    this.stream?.close();
  }
}
