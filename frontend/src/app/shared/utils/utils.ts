import { OIBusSouthType } from '../../../../../backend/shared/model/south-connector.model';
import { InputType, TransformerSourceCommandDTO, TransformerSourceDTO } from '../../../../../backend/shared/model/transformer.model';

export const getAssociatedInputType = (southType: OIBusSouthType): InputType => {
  switch (southType) {
    case 'ads':
    case 'modbus':
    case 'oianalytics':
    case 'opc':
    case 'opcua':
    case 'osisoft-pi':
      return 'time-values';
    default:
      return 'any';
  }
};

export const toSourceCommand = (source: TransformerSourceDTO): TransformerSourceCommandDTO => {
  switch (source.type) {
    case 'south':
      return {
        type: 'south',
        southId: source.south.id,
        groupId: source.group?.id,
        items: source.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled
        }))
      };
    case 'oianalytics-setpoint':
      return source;
    case 'oibus-api':
      return source;
  }
};
