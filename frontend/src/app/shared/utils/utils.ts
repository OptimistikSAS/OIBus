import { TransformerSourceCommandDTO, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

export const getAssociatedInputType = (southType: OIBusSouthType): InputType => {
  switch (southType) {
    case 'ads':
    case 'modbus':
    case 'oianalytics':
    case 'opc':
    case 'opcua':
    case 'osisoft-pi':
    case 's7':
      return 'time-values';
    case 'mysql':
    case 'postgresql':
    case 'mssql':
    case 'oracle':
    case 'sqlite':
    case 'mongodb':
      return 'record-list';
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
