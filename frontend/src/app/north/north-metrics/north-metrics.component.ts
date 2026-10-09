import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { NorthConnectorManifest } from '@oibus/shared/connector/north-manifest.model';
import { NorthConnectorMetrics } from '@oibus/shared/domain/engine.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { DatetimePipe } from '../../shared/datetime.pipe';
import { DurationPipe } from '../../shared/duration.pipe';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'oib-north-metrics',
  templateUrl: './north-metrics.component.html',
  styleUrl: './north-metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, DatetimePipe, DurationPipe, BoxComponent, BoxTitleDirective, FileSizePipe, NgbTooltip, TranslatePipe]
})
export class NorthMetricsComponent {
  private readonly router = inject(Router);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly notificationService = inject(NotificationService);

  readonly northConnector = input.required<NorthConnectorLightDTO>();
  readonly manifest = input<NorthConnectorManifest | null>(null);
  readonly displayButton = input(false);
  readonly connectorMetrics = input.required<NorthConnectorMetrics>();

  // the manifest of the connector type is only fetched when no manifest is given as input
  private readonly typeManifest = rxResource({
    params: () => (this.manifest() ? undefined : this.northConnector().type),
    stream: ({ params: type }) => this.northConnectorService.getNorthManifest(type)
  });
  readonly manifestOrNorthConnectorTypeManifest = computed(
    () => this.manifest() ?? (this.typeManifest.hasValue() ? this.typeManifest.value() : null)
  );

  resetMetrics() {
    this.northConnectorService.resetMetrics(this.northConnector().id).subscribe(() => {
      this.notificationService.success('north.monitoring.metrics-reset');
    });
  }

  navigateToDisplay() {
    this.router.navigate(['/north', this.northConnector().id]);
  }
}
