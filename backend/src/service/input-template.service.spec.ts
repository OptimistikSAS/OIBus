import InputTemplateService from './input-template.service';
import { InputType } from '../../shared/model/transformer.model';

describe('InputTemplateService', () => {
  let service: InputTemplateService;

  beforeEach(() => {
    service = new InputTemplateService();
  });

  describe('generateTimeValuesTemplate', () => {
    it('should generate time-values template with sample data', () => {
      const template = service.generateTimeValuesTemplate();

      expect(template.type).toBe('time-values');
      expect(template.description).toBe('Sample time-series data with multiple sensor readings');

      const data = JSON.parse(template.data);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);

      // Check first time value
      expect(data[0]).toHaveProperty('pointId', 'temperature_sensor_01');
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('data');
      expect(data[0].data).toHaveProperty('value', 23.5);
      expect(data[0].data).toHaveProperty('unit', '°C');
      expect(data[0].data).toHaveProperty('quality', 'good');
    });
  });

  describe('generateSetpointTemplate', () => {
    it('should generate setpoint template with sample data', () => {
      const template = service.generateSetpointTemplate();

      expect(template.type).toBe('setpoint');
      expect(template.description).toBe('Sample setpoint commands for various parameters');

      const data = JSON.parse(template.data);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(4);

      // Check first setpoint
      expect(data[0]).toHaveProperty('reference', 'setpoint_temperature');
      expect(data[0]).toHaveProperty('value', 22.0);

      // Check boolean setpoint
      expect(data[2]).toHaveProperty('reference', 'setpoint_enabled');
      expect(data[2]).toHaveProperty('value', true);
    });
  });

  describe('generateFileTemplate', () => {
    it('should generate file template with sample data', () => {
      const template = service.generateFileTemplate();

      expect(template.type).toBe('any');
      expect(template.description).toBe('Sample file content with structured data');

      const data = JSON.parse(template.data);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('source', 'test_device');
      expect(data).toHaveProperty('measurements');
      expect(data).toHaveProperty('metadata');

      expect(data.measurements).toHaveProperty('temperature', 23.5);
      expect(data.measurements).toHaveProperty('humidity', 65.2);
      expect(data.measurements).toHaveProperty('pressure', 1013.25);

      expect(data.metadata).toHaveProperty('device_id', 'sensor_001');
      expect(data.metadata).toHaveProperty('location', 'building_a_floor_2');
      expect(data.metadata).toHaveProperty('firmware_version', '1.2.3');
    });
  });

  describe('generateTemplate', () => {
    it('should generate time-values template when input type is time-values', () => {
      const template = service.generateTemplate('time-values' as InputType);

      expect(template.type).toBe('time-values');
      expect(template.description).toBe('Sample time-series data with multiple sensor readings');
    });

    it('should generate setpoint template when input type is setpoint', () => {
      const template = service.generateTemplate('setpoint' as InputType);

      expect(template.type).toBe('setpoint');
      expect(template.description).toBe('Sample setpoint commands for various parameters');
    });

    it('should generate file template when input type is any', () => {
      const template = service.generateTemplate('any' as InputType);

      expect(template.type).toBe('any');
      expect(template.description).toBe('Sample file content with structured data');
    });

    it('should throw error for unsupported input type', () => {
      expect(() => {
        service.generateTemplate('unsupported' as InputType);
      }).toThrow('Unsupported input type: unsupported');
    });
  });
});
