import BaseTransformer from './base-transformer';
import { OIBusTimeValueContent } from '../../../shared/model/engine.model';

export default class OIBusTimeValuesToJSONTransformer extends BaseTransformer {
  public static transformerName = 'time-values-to-json';

  async transform(data: OIBusTimeValueContent): Promise<string> {
    return JSON.stringify(data.content);
  }
}
