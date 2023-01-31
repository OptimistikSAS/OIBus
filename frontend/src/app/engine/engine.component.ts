import { Component, OnInit } from '@angular/core';
import { ProxyListComponent } from './proxy-list/proxy-list.component';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { EngineSettingsDTO } from '../../../../shared/model/engine.model';
import { NgIf } from '@angular/common';
import { ScanModeListComponent } from './scan-mode-list/scan-mode-list.component';
import { ExternalSourceListComponent } from './external-source-list/external-source-list.component';
import { IpFilterListComponent } from './ip-filter-list/ip-filter-list.component';

@Component({
  selector: 'oib-engine',
  standalone: true,
  imports: [
    NgIf,
    TranslateModule,
    RouterLink,
    ProxyListComponent,
    ScanModeListComponent,
    ExternalSourceListComponent,
    IpFilterListComponent
  ],
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.scss']
})
export class EngineComponent implements OnInit {
  engineSettings: EngineSettingsDTO | null = null;
  constructor(private engineService: EngineService) {}

  ngOnInit() {
    this.engineService.getEngineSettings().subscribe(settings => {
      this.engineSettings = settings;
    });
  }
}
