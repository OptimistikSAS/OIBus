import { describe, expect, test } from 'vitest';

import { TransformerDTO } from '@oibus/shared/api/transformer.model';
import { InputType, OutputType } from '@oibus/shared/connector/transformer-manifest.model';

import testData from '../../../test/test-data';
import { getAssociatedInputType, isTransformerApplicable } from './utils';

const standard = (functionName: string, inputType: InputType, outputType: OutputType): TransformerDTO => ({
  id: functionName,
  type: 'standard',
  functionName,
  inputType,
  outputType,
  manifest: testData.north.list[0].transformers[0].transformer.manifest
});

describe('utils', () => {
  describe('getAssociatedInputType', () => {
    test('should get the type of the data sent by a south', () => {
      expect(getAssociatedInputType('ads')).toBe('record-list');
      expect(getAssociatedInputType('s7')).toBe('record-list');
      expect(getAssociatedInputType('bacnet')).toBe('record-list');
      expect(getAssociatedInputType('sqlite')).toBe('record-list');
      expect(getAssociatedInputType('mysql')).toBe('record-list');
      expect(getAssociatedInputType('odbc')).toBe('record-list');
      expect(getAssociatedInputType('oledb')).toBe('record-list');
      expect(getAssociatedInputType('influxdb')).toBe('record-list');
      expect(getAssociatedInputType('folder-scanner')).toBe('any');
      // OIAnalytics values are serialized into CSV files
      expect(getAssociatedInputType('oianalytics')).toBe('any');
    });
  });

  describe('isTransformerApplicable', () => {
    const iso = standard('iso', 'any', 'any');
    const ignore = standard('ignore', 'any', 'any');
    const recordListToMqtt = standard('record-list-to-mqtt', 'record-list', 'mqtt');
    const csvToMqtt = standard('csv-to-mqtt', 'any', 'mqtt');

    test('should offer iso only when the north accepts the source data type', () => {
      expect(isTransformerApplicable(iso, 'record-list', ['any', 'record-list'])).toBe(true);
      expect(isTransformerApplicable(iso, 'record-list', ['any'])).toBe(false);
      expect(isTransformerApplicable(iso, 'setpoint', ['any'])).toBe(false);
      expect(isTransformerApplicable(iso, 'any', ['any'])).toBe(true);
    });

    test('should offer ignore for any source data type', () => {
      expect(isTransformerApplicable(ignore, 'record-list', ['any'])).toBe(true);
      expect(isTransformerApplicable(ignore, 'record-list', ['mqtt'])).toBe(false);
    });

    test('should offer a transformer matching the source data type and producing a type the north accepts', () => {
      expect(isTransformerApplicable(recordListToMqtt, 'record-list', ['mqtt'])).toBe(true);
      expect(isTransformerApplicable(recordListToMqtt, 'record-list', ['any'])).toBe(false);
      expect(isTransformerApplicable(csvToMqtt, 'record-list', ['mqtt'])).toBe(false);
      expect(isTransformerApplicable(csvToMqtt, 'any', ['mqtt'])).toBe(true);
    });

    test('should only check the output type when no source is selected', () => {
      expect(isTransformerApplicable(iso, null, ['any'])).toBe(true);
      expect(isTransformerApplicable(csvToMqtt, null, ['mqtt'])).toBe(true);
      expect(isTransformerApplicable(csvToMqtt, null, ['any'])).toBe(false);
    });
  });
});
