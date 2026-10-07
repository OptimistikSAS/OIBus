import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { SouthConnectorService } from '../../services/south-connector.service';
import { OIBusSouthCategoryEnumPipe } from '../../shared/oibus-south-category-enum.pipe';
import { OIBusSouthTypeDescriptionEnumPipe } from '../../shared/oibus-south-type-description-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';

@Component({
  selector: 'oib-choose-south-connector-type-modal',
  templateUrl: './choose-south-connector-type-modal.component.html',
  styleUrl: './choose-south-connector-type-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OIBusSouthCategoryEnumPipe, OIBusSouthTypeEnumPipe, OIBusSouthTypeDescriptionEnumPipe]
})
export class ChooseSouthConnectorTypeModalComponent {
  private modal = inject(NgbActiveModal);
  private southConnectorService = inject(SouthConnectorService);
  private router = inject(Router);

  southTypes: Array<SouthType> = [];
  readonly groupedSouthTypes = signal<Array<{ category: string; types: Array<SouthType> }>>([]);

  constructor() {
    this.southConnectorService.getSouthTypes().subscribe(types => {
      this.southTypes = types;
      this.groupSouthTypes();
    });
  }

  groupSouthTypes() {
    const groupedTypes: Record<string, Array<SouthType>> = {};

    for (const southType of this.southTypes) {
      if (groupedTypes[southType.category]) {
        groupedTypes[southType.category].push(southType);
      } else {
        groupedTypes[southType.category] = [southType];
      }
    }

    this.groupedSouthTypes.set(
      Object.keys(groupedTypes).map(category => ({
        category,
        types: groupedTypes[category]
      }))
    );
  }

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/south', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}
