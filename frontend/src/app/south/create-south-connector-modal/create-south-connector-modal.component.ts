import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { SouthConnectorService } from '../../services/south-connector.service';
import { SouthType } from '../../model/south-connector.model';
import { formDirectives } from '../../shared/form-directives';
import { NgForOf } from '@angular/common';

@Component({
  selector: 'oib-create-south-connector-modal',
  templateUrl: './create-south-connector-modal.component.html',
  styleUrls: ['./create-south-connector-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, NgForOf],
  standalone: true
})
export class CreateSouthConnectorModalComponent implements OnInit {
  southTypes: Array<SouthType> = [];

  constructor(private modal: NgbActiveModal, private southConnectorService: SouthConnectorService, private router: Router) {}

  ngOnInit() {
    this.southConnectorService.getSouthConnectorTypes().subscribe(types => {
      this.southTypes = types;
    });
  }

  selectType(type: string) {
    this.modal.close();
    this.router.navigate(['/south', 'create'], { queryParams: { type: type } });
  }

  cancel() {
    this.modal.dismiss();
  }
}
