import { InputType } from '../../shared/model/transformer.model';
import { OIBusTimeValue, OIBusSetpoint } from '../../shared/model/engine.model';
import { DateTime } from 'luxon';

export interface InputTemplate {
  type: InputType;
  data: string;
  description: string;
}

export default class InputTemplateService {
  /**
   * Generate input template for time-values input type
   */
  generateTimeValuesTemplate(): InputTemplate {
    const now = DateTime.now().toUTC().toISO()!;
    const timeValues: Array<OIBusTimeValue> = [
      {
        pointId: 'temperature_sensor_01',
        timestamp: now,
        data: {
          value: 23.5,
          unit: '°C',
          quality: 'good'
        }
      },
      {
        pointId: 'pressure_sensor_01',
        timestamp: now,
        data: {
          value: 1013.25,
          unit: 'hPa',
          quality: 'good'
        }
      },
      {
        pointId: 'humidity_sensor_01',
        timestamp: now,
        data: {
          value: 65.2,
          unit: '%',
          quality: 'good'
        }
      }
    ];

    return {
      type: 'time-values',
      data: JSON.stringify(timeValues, null, 2),
      description: 'Sample time-series data with multiple sensor readings'
    };
  }

  /**
   * Generate input template for setpoint input type
   */
  generateSetpointTemplate(): InputTemplate {
    const setpoints: Array<OIBusSetpoint> = [
      {
        reference: 'setpoint_temperature',
        value: 22.0
      },
      {
        reference: 'setpoint_pressure',
        value: 1000.0
      },
      {
        reference: 'setpoint_enabled',
        value: true
      },
      {
        reference: 'setpoint_mode',
        value: 'auto'
      }
    ];

    return {
      type: 'setpoint',
      data: JSON.stringify(setpoints, null, 2),
      description: 'Sample setpoint commands for various parameters'
    };
  }

  /**
   * Generate input template for any (file) input type
   */
  generateFileTemplate(): InputTemplate {
    const fileContent = {
      timestamp: DateTime.now().toUTC().toISO(),
      source: 'test_device',
      measurements: {
        temperature: 23.5,
        humidity: 65.2,
        pressure: 1013.25
      },
      metadata: {
        device_id: 'sensor_001',
        location: 'building_a_floor_2',
        firmware_version: '1.2.3'
      }
    };

    return {
      type: 'any',
      data: JSON.stringify(fileContent, null, 2),
      description: 'Sample file content with structured data'
    };
  }

  /**
   * Generate input template based on input type
   */
  generateTemplate(inputType: InputType): InputTemplate {
    switch (inputType) {
      case 'time-values':
        return this.generateTimeValuesTemplate();
      case 'setpoint':
        return this.generateSetpointTemplate();
      case 'any':
        return this.generateFileTemplate();
      default:
        throw new Error(`Unsupported input type: ${inputType}`);
    }
  }
}
