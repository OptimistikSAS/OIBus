import { OIBusDataValue } from '../../../shared/model/engine.model';

export interface HandlesFile {
  handleFile(filePath: string): Promise<void>;
}

export interface HandlesValues {
  handleValues(values: Array<OIBusDataValue>): Promise<void>;
}

export interface HandlesItemValues {
  handleItemValues(values: Array<OIBusDataValue>): Promise<void>;
}
