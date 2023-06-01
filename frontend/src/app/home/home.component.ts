import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { NgForOf, NgIf, NgOptimizedImage } from '@angular/common';
import { BoxComponent } from '../shared/box/box.component';
import { EnabledEnumPipe } from '../shared/enabled-enum.pipe';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../../shared/model/history-query.model';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { HistoryQueryService } from '../services/history-query.service';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'oib-home',
  standalone: true,
  imports: [TranslateModule, RouterLink, NgOptimizedImage, BoxComponent, EnabledEnumPipe, NgForOf, NgIf],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  readonly copyrightYear = new Date().getFullYear();
  souths: Array<SouthConnectorDTO> | null = null;
  norths: Array<NorthConnectorDTO> | null = null;
  historyQueries: Array<HistoryQueryDTO> | null = null;

  constructor(
    private southService: SouthConnectorService,
    private northService: NorthConnectorService,
    private historyQueryService: HistoryQueryService
  ) {}

  ngOnInit(): void {
    const souths$ = this.southService.list();
    const norths$ = this.northService.list();
    const historyQueries$ = this.historyQueryService.list();
    combineLatest([souths$, norths$, historyQueries$]).subscribe(([souths, norths, historyQueries]) => {
      this.souths = souths;
      this.norths = norths;
      this.historyQueries = historyQueries;
    });
  }
}
