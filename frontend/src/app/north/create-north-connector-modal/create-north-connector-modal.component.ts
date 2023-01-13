import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { formDirectives } from '../../shared/form-directives';
import { NgForOf } from '@angular/common';
import { NorthType } from '../../model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';

@Component({
  selector: 'oib-create-north-connector-modal',
  templateUrl: './create-north-connector-modal.component.html',
  styleUrls: ['./create-north-connector-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, NgForOf],
  standalone: true
})
export class CreateNorthConnectorModalComponent implements OnInit {
  northTypes: Array<NorthType> = [];

  constructor(private modal: NgbActiveModal, private northConnectorService: NorthConnectorService, private router: Router) {}

  ngOnInit() {
    this.northConnectorService.getNorthConnectorTypes().subscribe(types => {
      this.northTypes = types;
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
