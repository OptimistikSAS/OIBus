import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthType } from '../../../../../shared/model/south-connector.model';
import { formDirectives } from '../../shared/form-directives';
import { NgForOf } from '@angular/common';

@Component({
  selector: 'oib-choose-south-connector-type-modal',
  templateUrl: './choose-south-connector-type-modal.component.html',
  styleUrls: ['./choose-south-connector-type-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, NgForOf],
  standalone: true
})
export class ChooseSouthConnectorTypeModalComponent implements OnInit {
  southTypes: Array<SouthType> = [];
  groupedSouthTypes: { category: string; types: SouthType[] }[] = [];

  constructor(private modal: NgbActiveModal, private southConnectorService: SouthConnectorService, private router: Router) {}

  ngOnInit() {
    this.southConnectorService.getAvailableTypes().subscribe(types => {
      this.southTypes = types;
      this.groupSouthTypes();
    });
  }

  groupSouthTypes() {
    const groupedTypes: { [key: string]: SouthType[] } = {};

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
