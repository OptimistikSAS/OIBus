import { SouthMQTTItemSettingsQos } from '../../../shared/model/south-settings.model';

export interface OIBusMQTTValue {
  topic: string;
  qos: SouthMQTTItemSettingsQos;
  payload: string;
}

export interface OIBusOPCUAValue {
  nodeId: string;
  value: string | number | boolean;
}

export interface OIBusModbusValue {
  address: string;
  value: number | boolean;
  modbusType: 'coil' | 'register';
}
