import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { map } from 'rxjs';

import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { SouthConnectorService } from '../../services/south-connector.service';
import { OIBusSouthCategoryEnumPipe } from '../../shared/oibus-south-category-enum.pipe';
import { OIBusSouthTypeDescriptionEnumPipe } from '../../shared/oibus-south-type-description-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';

@Component({
  selector: 'oib-choose-south-connector-type-modal',
  templateUrl: './choose-south-connector-type-modal.component.html',
  styleUrl: './choose-south-connector-type-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, OIBusSouthCategoryEnumPipe, OIBusSouthTypeEnumPipe, OIBusSouthTypeDescriptionEnumPipe]
})
export class ChooseSouthConnectorTypeModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly router = inject(Router);

  readonly groupedSouthTypes = toSignal(this.southConnectorService.getSouthTypes().pipe(map(types => groupSouthTypes(types))), {
    initialValue: []
  });

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/south', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}

function groupSouthTypes(southTypes: Array<SouthType>): Array<{ category: string; types: Array<SouthType> }> {
  const groupedTypes: Record<string, Array<SouthType>> = {};
  for (const southType of southTypes) {
    if (groupedTypes[southType.category]) {
      groupedTypes[southType.category].push(southType);
    } else {
      groupedTypes[southType.category] = [southType];
    }
  }
  return Object.keys(groupedTypes).map(category => ({ category, types: groupedTypes[category] }));
}
