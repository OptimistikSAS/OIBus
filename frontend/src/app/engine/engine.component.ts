import { Component, OnInit } from '@angular/core';
import { ProxyListComponent } from './proxy-list/proxy-list.component';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { EngineService } from '../services/engine.service';
import { EngineSettingsDTO } from '../model/engine.model';
import { NgIf } from '@angular/common';

@Component({
  selector: 'oib-engine',
  standalone: true,
  imports: [NgIf, TranslateModule, RouterLink, ProxyListComponent],
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
