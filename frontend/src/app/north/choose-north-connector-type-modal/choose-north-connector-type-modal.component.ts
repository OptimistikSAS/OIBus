import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { NorthType } from '@oibus/shared/connector/north-manifest.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { OIBusNorthCategoryEnumPipe } from '../../shared/oibus-north-category-enum.pipe';
import { OIBusNorthTypeDescriptionEnumPipe } from '../../shared/oibus-north-type-description-enum.pipe';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';

@Component({
  selector: 'oib-choose-north-connector-type-modal',
  templateUrl: './choose-north-connector-type-modal.component.html',
  styleUrl: './choose-north-connector-type-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OIBusNorthTypeEnumPipe, OIBusNorthTypeDescriptionEnumPipe, OIBusNorthCategoryEnumPipe]
})
export class ChooseNorthConnectorTypeModalComponent {
  private modal = inject(NgbActiveModal);
  private northConnectorService = inject(NorthConnectorService);
  private router = inject(Router);

  readonly northTypes = signal<Array<NorthType>>([]);
  readonly groupedNorthTypes = computed<Array<{ category: string; types: Array<NorthType> }>>(() => {
    const groupedTypes: Record<string, Array<NorthType>> = {};

    for (const northType of this.northTypes()) {
      if (groupedTypes[northType.category]) {
        groupedTypes[northType.category].push(northType);
      } else {
        groupedTypes[northType.category] = [northType];
      }
    }

    return Object.keys(groupedTypes).map(category => ({
      category,
      types: groupedTypes[category]
    }));
  });

  constructor() {
    this.northConnectorService.getNorthTypes().subscribe(types => {
      this.northTypes.set(types);
    });
  }

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/north', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}
