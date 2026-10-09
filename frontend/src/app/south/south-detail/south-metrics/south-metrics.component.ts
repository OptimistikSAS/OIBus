import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, JsonPipe, NgbTooltip, TranslatePipe]
})
export class SouthMetricsComponent {
  private readonly router = inject(Router);
  private readonly southService = inject(SouthConnectorService);
  private readonly notificationService = inject(NotificationService);

  readonly southConnector = input.required<SouthConnectorLightDTO>();
  readonly manifest = input<SouthConnectorManifest | null>(null);
  readonly displayButton = input(false);
  readonly connectorMetrics = input.required<SouthConnectorMetrics>();
  /** The type manifest, fetched only when the parent does not give it. */
  private readonly typeManifest = rxResource({
    params: () => (this.manifest() ? undefined : this.southConnector().type),
    stream: ({ params }) => this.southService.getSouthManifest(params)
  });
  readonly manifestOrSouthConnectorTypeManifest = computed(
    () => this.manifest() ?? (this.typeManifest.hasValue() ? this.typeManifest.value() : null)
  );

  resetMetrics() {
    this.southService.resetMetrics(this.southConnector().id).subscribe(() => {
      this.notificationService.success('south.monitoring.metrics-reset');
    });
  }

  navigateToDisplay() {
    this.router.navigate(['/south', this.southConnector().id]);
  }
}
