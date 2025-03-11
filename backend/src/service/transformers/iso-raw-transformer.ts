import BaseTransformer from './base-transformer';

export default class IsoRawTransformer extends BaseTransformer {
  public static transformerName = 'iso-raw';
  async transform(data: unknown): Promise<unknown> {
    return data;
  }
}
