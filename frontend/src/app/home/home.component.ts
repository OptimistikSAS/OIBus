import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NgForOf, NgIf, NgOptimizedImage } from '@angular/common';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { combineLatest } from 'rxjs';
import { EngineMetricsComponent } from '../engine/engine-metrics/engine-metrics.component';
import { NorthMetricsComponent } from '../north/north-metrics/north-metrics.component';
import { SouthMetricsComponent } from '../south/south-metrics/south-metrics.component';

const NUMBER_OF_COLUMN = 3;

@Component({
  selector: 'oib-home',
  standalone: true,
  imports: [TranslateModule, NgOptimizedImage, NgForOf, NgIf, EngineMetricsComponent, NorthMetricsComponent, SouthMetricsComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  readonly copyrightYear = new Date().getFullYear();
  southRows: Array<Array<SouthConnectorDTO>> = [];
  northRows: Array<Array<NorthConnectorDTO>> = [];

  constructor(private southService: SouthConnectorService, private northService: NorthConnectorService) {}

  ngOnInit(): void {
    const souths$ = this.southService.list();
    const norths$ = this.northService.list();
    combineLatest([souths$, norths$]).subscribe(([souths, norths]) => {
      const enabledSouth = souths.filter(south => south.enabled);
      for (let i = 0; i < enabledSouth.length; i++) {
        if (i % NUMBER_OF_COLUMN === 0) {
          this.southRows.push([enabledSouth[i]]);
        } else {
          this.southRows[this.southRows.length - 1].push(enabledSouth[i]);
        }
      }
      const enabledNorth = norths.filter(north => north.enabled);
      for (let i = 0; i < enabledNorth.length; i++) {
        if (i % NUMBER_OF_COLUMN === 0) {
          this.northRows.push([enabledNorth[i]]);
        } else {
          this.northRows[this.northRows.length - 1].push(enabledNorth[i]);
        }
      }
    });
  }
}
