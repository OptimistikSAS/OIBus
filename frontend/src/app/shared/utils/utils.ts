import { TransformerDTO, TransformerSourceCommandDTO, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { OIBusSouthType } from '@oibus/shared/connector/south-manifest.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';

/**
 * The type of the data a south sends to the norths at runtime (e.g. OIAnalytics and ODBC serialize their results into
 * CSV files, so they send files, not time-values).
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

/**
 * Whether a transformer can be applied to data of `dataType` (`null` when no source is selected yet) sent to a north
 * accepting `northTypes`. `iso` caches the data unchanged, so the north must accept the data type itself.
 */
export const isTransformerApplicable = (transformer: TransformerDTO, dataType: InputType | null, northTypes: Array<string>): boolean => {
  const isStandard = (functionName: string) => transformer.type === 'standard' && transformer.functionName === functionName;
  if (dataType && isStandard('iso')) {
    return northTypes.includes(dataType);
  }
  if (!northTypes.includes(transformer.outputType)) {
    return false;
  }
  return !dataType || isStandard('ignore') || transformer.inputType === dataType;
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
