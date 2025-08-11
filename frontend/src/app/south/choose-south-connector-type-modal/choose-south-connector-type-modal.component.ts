import { Component, OnInit, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthType } from '../../../../../backend/shared/model/south-connector.model';
import { OIBusSouthCategoryEnumPipe } from '../../shared/oibus-south-category-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { OIBusSouthTypeDescriptionEnumPipe } from '../../shared/oibus-south-type-description-enum.pipe';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'oib-choose-south-connector-type-modal',
  templateUrl: './choose-south-connector-type-modal.component.html',
  styleUrl: './choose-south-connector-type-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, OIBusSouthCategoryEnumPipe, OIBusSouthTypeEnumPipe, OIBusSouthTypeDescriptionEnumPipe]
})
export class ChooseSouthConnectorTypeModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private southConnectorService = inject(SouthConnectorService);
  private router = inject(Router);

  southTypes: Array<SouthType> = [];
  groupedSouthTypes: Array<{ category: string; types: Array<SouthType> }> = [];

  ngOnInit() {
    this.southConnectorService.getAvailableTypes().subscribe(types => {
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

    this.groupedSouthTypes = Object.keys(groupedTypes).map(category => ({
      category,
      types: groupedTypes[category]
    }));
  }

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/south', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}
