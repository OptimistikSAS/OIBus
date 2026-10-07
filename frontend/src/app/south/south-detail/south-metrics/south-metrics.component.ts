import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthConnectorMetrics } from '@oibus/shared/domain/engine.model';

import { SouthConnectorService } from '../../../services/south-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../../shared/box/box.component';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { DurationPipe } from '../../../shared/duration.pipe';
import { NotificationService } from '../../../shared/notification.service';

@Component({
  selector: 'oib-south-metrics',
  templateUrl: './south-metrics.component.html',
  styleUrl: './south-metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, NgbTooltip, TranslatePipe]
})
export class SouthMetricsComponent {
  private router = inject(Router);
  private southService = inject(SouthConnectorService);
  private notificationService = inject(NotificationService);

  readonly southConnector = input.required<SouthConnectorLightDTO>();
  readonly manifest = input<SouthConnectorManifest | null>(null);
  readonly manifestOrSouthConnectorTypeManifest = linkedSignal(() => this.manifest());
  readonly displayButton = input(false);
  readonly connectorMetrics = input.required<SouthConnectorMetrics>();

  constructor() {
    effect(() => {
      if (!this.manifest()) {
        this.southService.getSouthManifest(this.southConnector().type).subscribe(manifest => {
          this.manifestOrSouthConnectorTypeManifest.set(manifest);
        });
      }
    });
  }

  resetMetrics() {
    this.southService.resetMetrics(this.southConnector().id).subscribe(() => {
      this.notificationService.success('south.monitoring.metrics-reset');
    });
  }

  navigateToDisplay() {
    this.router.navigate(['/south', this.southConnector().id]);
  }
}
