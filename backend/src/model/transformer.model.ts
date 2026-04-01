import { BaseEntity } from './types';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { DataSourceType, TransformerLanguage } from '../../shared/model/transformer.model';
import { SouthConnectorEntityLight, SouthConnectorItemEntityLight, SouthItemGroupEntity } from './south-connector.model';

export interface BaseTransformer {
  id: string;
  inputType: string;
  outputType: string;
  type: 'custom' | 'standard';
}

export interface CustomTransformer extends BaseEntity, BaseTransformer {
  type: 'custom';
  name: string;
  description: string;
  customCode: string;
  language: TransformerLanguage;
  customManifest: OIBusObjectAttribute;
  timeout: number;
}

export interface StandardTransformer extends BaseTransformer {
  functionName: string;
  type: 'standard';
}

export type Transformer = CustomTransformer | StandardTransformer;

interface BaseSourceOrigin {
  type: DataSourceType;
}

export interface SourceOriginSouth extends BaseSourceOrigin {
  type: 'south';

  /**
   * The south associated to the transformer
   */
  south: SouthConnectorEntityLight;

  /**
   * The group associated to the transformer (mutually exclusive with items)
   */
  group?: SouthItemGroupEntity;

  /**
   * The list of items associated to the transformer
   */
  items: Array<SouthConnectorItemEntityLight>;
}

export interface SourceOriginOIAnalytics extends BaseSourceOrigin {
  type: 'oianalytics-setpoint';
}

export interface SourceOriginAPI extends BaseSourceOrigin {
  type: 'oibus-api';
  dataSourceId: string;
}

export type TransformerSource = SourceOriginSouth | SourceOriginOIAnalytics | SourceOriginAPI;

export interface NorthTransformerWithOptions {
  id: string;
  transformer: Transformer;
  source: TransformerSource;
  options: Record<string, unknown>;
}

export interface HistoryTransformerWithOptions {
  id: string;
  transformer: Transformer;
  options: Record<string, unknown>;
  items: Array<SouthConnectorItemEntityLight>;
}
