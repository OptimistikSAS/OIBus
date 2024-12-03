import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { TranslateModule } from '@ngx-translate/core';
import { JsonPipe } from '@angular/common';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import { OibusCommandTypeEnumPipe } from '../../../shared/oibus-command-type-enum.pipe';
import { BooleanEnumPipe } from '../../../shared/boolean-enum.pipe';
import { OIBusCommandDTO } from '../../../../../../backend/shared/model/command.model';

@Component({
  selector: 'oib-oia-command-details-modal',
  templateUrl: './oia-command-details-modal.component.html',
  styleUrl: './oia-command-details-modal.component.scss',
  imports: [TranslateModule, OibusCommandTypeEnumPipe, DatetimePipe, JsonPipe, BooleanEnumPipe]
})
export class OiaCommandDetailsModalComponent {
  private activeModal = inject(NgbActiveModal);

  command: OIBusCommandDTO | null = null;

  prepare(command: OIBusCommandDTO) {
    this.command = command;
  }

  close() {
    this.activeModal.dismiss();
  }
}
