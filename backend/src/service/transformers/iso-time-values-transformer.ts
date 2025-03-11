import BaseTransformer from './base-transformer';

export default class IsoTimeValuesTransformer extends BaseTransformer {
  public static transformerName = 'iso-time-values';
  async transform(data: unknown): Promise<unknown> {
    return data;
  }
}
