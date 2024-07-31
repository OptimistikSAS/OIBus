import { OIBusCommandStatus } from '../../../../shared/model/command.model';

export interface OIBusCommandUpdateStatusCommandDTO {
  id: string;
  status: OIBusCommandStatus;
  result: string;
}
