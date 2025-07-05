export interface OIBusMQTTValue {
  topic: string;
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
