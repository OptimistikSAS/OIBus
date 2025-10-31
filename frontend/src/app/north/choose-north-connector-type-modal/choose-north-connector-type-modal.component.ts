import { Component, inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { NorthType } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusNorthTypeDescriptionEnumPipe } from '../../shared/oibus-north-type-description-enum.pipe';
import { OIBusNorthCategoryEnumPipe } from '../../shared/oibus-north-category-enum.pipe';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'oib-choose-north-connector-type-modal',
  templateUrl: './choose-north-connector-type-modal.component.html',
  styleUrl: './choose-north-connector-type-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, OIBusNorthTypeEnumPipe, OIBusNorthTypeDescriptionEnumPipe, OIBusNorthCategoryEnumPipe]
})
export class ChooseNorthConnectorTypeModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private northConnectorService = inject(NorthConnectorService);
  private router = inject(Router);

  northTypes: Array<NorthType> = [];
  groupedNorthTypes: Array<{ category: string; types: Array<NorthType> }> = [];

  ngOnInit() {
    this.northConnectorService.getNorthTypes().subscribe(types => {
      this.northTypes = types;
      this.groupNorthTypes();
    });
  }

  groupNorthTypes() {
    const groupedTypes: Record<string, Array<NorthType>> = {};

    for (const northType of this.northTypes) {
      if (groupedTypes[northType.category]) {
        groupedTypes[northType.category].push(northType);
      } else {
        groupedTypes[northType.category] = [northType];
      }
    }

    this.groupedNorthTypes = Object.keys(groupedTypes).map(category => ({
      category,
      types: groupedTypes[category]
    }));
  }

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/north', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}
