import { OIBusSouthType } from '../../../../../backend/shared/model/south-connector.model';
import { InputType } from '../../../../../backend/shared/model/transformer.model';

export const getAssociatedInputType = (southType: OIBusSouthType): InputType => {
  switch (southType) {
    case 'ads':
    case 'modbus':
    case 'mqtt':
    case 'oianalytics':
    case 'opc':
    case 'opcua':
    case 'osisoft-pi':
      return 'time-values';
    default:
      return 'any';
  }
};
