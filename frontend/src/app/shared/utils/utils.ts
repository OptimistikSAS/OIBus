import { TransformerDTO, TransformerSourceCommandDTO, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

/**
 * The type of the data a south sends to the norths at runtime: point records (OPC UA, Modbus...) and query rows (SQL...)
 * are record lists, the others send files or payloads (e.g. OIAnalytics serializes its results into CSV files).
 */
export const getAssociatedInputType = (southType: OIBusSouthType): InputType => {
  switch (southType) {
    case 'ads':
    case 'bacnet':
    case 'modbus':
    case 'opc':
    case 'opcua':
    case 'osisoft-pi':
    case 's7':
    case 'influxdb':
    case 'mongodb':
    case 'mssql':
    case 'mysql':
    case 'odbc':
    case 'oledb':
    case 'oracle':
    case 'postgresql':
    case 'sqlite':
      return 'record-list';
    default:
      return 'any';
  }
};

/**
 * Whether a transformer can be applied to data of `dataType` (`null` when no source is selected yet) sent to a north
 * accepting `northTypes`.
 */
export const isTransformerApplicable = (transformer: TransformerDTO, dataType: InputType | null, northTypes: Array<string>): boolean =>
  northTypes.includes(transformer.outputType) && (!dataType || transformer.inputType === dataType);

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
