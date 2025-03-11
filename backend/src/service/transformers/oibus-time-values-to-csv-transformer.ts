import BaseTransformer from './base-transformer';
import csv from 'papaparse';
import { OIBusTimeValueContent } from '../../../shared/model/engine.model';

export default class OIBusTimeValuesToCsvTransformer extends BaseTransformer {
  public static transformerName = 'time-values-to-csv';

  async transform(data: OIBusTimeValueContent): Promise<string> {
    return csv.unparse(
      data.content.map(value => ({
        pointId: value.pointId,
        timestamp: value.timestamp,
        value: value.data.value
      })),
      {
        header: true,
        delimiter: ';'
      }
    );
  }
}
