import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorDTO } from '../../model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

@Component({
  selector: 'oib-south-display',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink],
  templateUrl: './south-display.component.html',
  styleUrls: ['./south-display.component.scss']
})
export class SouthDisplayComponent implements OnInit {
  southConnector: SouthConnectorDTO | null = null;

  constructor(private southConnectorService: SouthConnectorService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const paramSouthId = params.get('southId');

          if (paramSouthId) {
            return this.southConnectorService.getSouthConnector(paramSouthId);
          }
          return of(null);
        })
      )
      .subscribe(southConnector => {
        this.southConnector = southConnector;
      });
  }
}
