import { Component, OnInit, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { formDirectives } from '../../shared/form-directives';

import { NorthType } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';

@Component({
  selector: 'oib-choose-north-connector-type-modal',
  templateUrl: './choose-north-connector-type-modal.component.html',
  styleUrl: './choose-north-connector-type-modal.component.scss',
  imports: [...formDirectives, TranslateModule]
})
export class ChooseNorthConnectorTypeModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private northConnectorService = inject(NorthConnectorService);
  private router = inject(Router);

  northTypes: Array<NorthType> = [];
  groupedNorthTypes: Array<{ category: string; types: Array<NorthType> }> = [];

  ngOnInit() {
    this.northConnectorService.getNorthConnectorTypes().subscribe(types => {
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
