import IsoRawTransformer from './iso-raw-transformer';
import IsoTimeValuesTransformer from './iso-time-values-transformer';
import OIBusTimeValuesToCsvTransformer from './oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToJSONTransformer from './oibus-time-values-to-json-transformer';
import { Transformer } from '../../model/transformer.model';
import pino from 'pino';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import OibusTransformer from './oibus-transformer';

export const createTransformer = (
  transformer: Transformer,
  northConnector: NorthConnectorEntity<NorthSettings>,
  logger: pino.Logger
): OibusTransformer => {
  switch (transformer.id) {
    case IsoRawTransformer.transformerName: {
      return new IsoRawTransformer(logger, transformer, northConnector);
    }
    case IsoTimeValuesTransformer.transformerName: {
      return new IsoTimeValuesTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToCsvTransformer.transformerName: {
      return new OIBusTimeValuesToCsvTransformer(logger, transformer, northConnector);
    }
    case OIBusTimeValuesToJSONTransformer.transformerName: {
      return new OIBusTimeValuesToJSONTransformer(logger, transformer, northConnector);
    }
    default:
      throw new Error(`Could not create ${transformer.id} transformer`);
  }
};
