import { Database } from 'better-sqlite3';
import { TransformerSearchParam } from '../../../shared/model/transformer.model';
import { generateRandomId } from '../../service/utils';
import { CustomTransformer, StandardTransformer, Transformer } from '../../model/transformer.model';
import { Page } from '../../../shared/model/types';
import OIBusTimeValuesToCsvTransformer from '../../service/transformers/time-values/oibus-time-values-to-csv-transformer';
import IsoTransformer from '../../service/transformers/iso-transformer';
import { OIBusDataType } from '../../../shared/model/engine.model';
import OIBusTimeValuesToJSONTransformer from '../../service/transformers/time-values/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from '../../service/transformers/time-values/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from '../../service/transformers/time-values/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from '../../service/transformers/time-values/oibus-time-values-to-modbus-transformer';
import IgnoreTransformer from '../../service/transformers/ignore-transformer';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import OIBusSetpointToModbusTransformer from '../../service/transformers/setpoint/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToOPCUATransformer from '../../service/transformers/setpoint/oibus-setpoint-to-opcua-transformer';
import OIBusSetpointToMQTTTransformer from '../../service/transformers/setpoint/oibus-setpoint-to-mqtt-transformer';

const TRANSFORMERS_TABLE = 'transformers';
const PAGE_SIZE = 10;

export default class TransformerRepository {
  constructor(private readonly database: Database) {
    this.createStandardTransformers();
  }

  findAll(): Array<Transformer> {
    const query = `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code FROM ${TRANSFORMERS_TABLE};`;
    const result = this.database.prepare(query).all();
    return result.map(element => toTransformer(element as Record<string, string>));
  }

  save(transformer: CustomTransformer): void {
    if (!transformer.id) {
      transformer.id = generateRandomId(6);
      this.database
        .prepare(
          `INSERT INTO ${TRANSFORMERS_TABLE} (id, type, input_type, output_type, name, description, custom_manifest, custom_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          transformer.id,
          transformer.type,
          transformer.inputType,
          transformer.outputType,
          transformer.name,
          transformer.description,
          JSON.stringify(transformer.customManifest),
          transformer.customCode
        );
    } else {
      this.database
        .prepare(`UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, custom_manifest = ?, custom_code = ? WHERE id = ?`)
        .run(transformer.name, transformer.description, JSON.stringify(transformer.customManifest), transformer.customCode, transformer.id);
    }
  }

  delete(id: string): void {
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
  }

  findById(id: string): Transformer | null {
    const query = `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;

    return toTransformer(result as Record<string, string>);
  }

  findByFunctionName(functionName: string): StandardTransformer | null {
    const query = `SELECT id, type, input_type, output_type, function_name, custom_manifest, custom_code FROM ${TRANSFORMERS_TABLE} WHERE function_name = ?;`;
    const result = this.database.prepare(query).get(functionName);
    if (!result) return null;

    return toTransformer(result as Record<string, string>) as StandardTransformer;
  }

  createStandardTransformer(transformer: StandardTransformer): void {
    this.database
      .prepare(`INSERT INTO ${TRANSFORMERS_TABLE} (id, type, input_type, output_type, function_name) VALUES (?, ?, ?, ?, ?)`)
      .run(transformer.id, transformer.type, transformer.inputType, transformer.outputType, transformer.functionName);
  }

  search(searchParams: TransformerSearchParam): Page<Transformer> {
    let whereClause = `WHERE id IS NOT NULL`;
    const queryParams = [];

    const page = searchParams.page ?? 0;

    if (searchParams.type !== undefined) {
      queryParams.push(searchParams.type);
      whereClause += ` AND type = ?`;
    }
    if (searchParams.inputType !== undefined) {
      queryParams.push(searchParams.inputType);
      whereClause += ` AND input_type = ?`;
    }
    if (searchParams.outputType !== undefined) {
      queryParams.push(searchParams.outputType);
      whereClause += ` AND output_type = ?`;
    }

    const query =
      `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code FROM ${TRANSFORMERS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;

    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => toTransformer(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${TRANSFORMERS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);
    return {
      content: results,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  private createStandardTransformers() {
    if (!this.findByFunctionName(IgnoreTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: IgnoreTransformer.transformerName,
        inputType: 'any',
        outputType: 'any'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(IsoTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: IsoTransformer.transformerName,
        inputType: 'any',
        outputType: 'any'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusTimeValuesToCsvTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusTimeValuesToCsvTransformer.transformerName,
        inputType: 'time-values',
        outputType: 'any'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusTimeValuesToJSONTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusTimeValuesToJSONTransformer.transformerName,
        inputType: 'time-values',
        outputType: 'any'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusTimeValuesToMQTTTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusTimeValuesToMQTTTransformer.transformerName,
        inputType: 'time-values',
        outputType: 'mqtt'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusTimeValuesToOPCUATransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusTimeValuesToOPCUATransformer.transformerName,
        inputType: 'time-values',
        outputType: 'opcua'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusTimeValuesToModbusTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusTimeValuesToModbusTransformer.transformerName,
        inputType: 'time-values',
        outputType: 'modbus'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusSetpointToModbusTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusSetpointToModbusTransformer.transformerName,
        inputType: 'setpoint',
        outputType: 'modbus'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusSetpointToOPCUATransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusSetpointToOPCUATransformer.transformerName,
        inputType: 'setpoint',
        outputType: 'opcua'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findByFunctionName(OIBusSetpointToMQTTTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: generateRandomId(6),
        type: 'standard',
        functionName: OIBusSetpointToMQTTTransformer.transformerName,
        inputType: 'setpoint',
        outputType: 'mqtt'
      };
      this.createStandardTransformer(standardTransformer);
    }
  }
}

export const toTransformer = (result: Record<string, string>): Transformer => {
  if (result.type === 'standard') {
    return {
      id: result.id as string,
      type: 'standard',
      inputType: result.input_type as OIBusDataType,
      outputType: result.output_type as OIBusDataType,
      functionName: result.function_name as string
    };
  } else {
    return {
      id: result.id as string,
      type: 'custom',
      inputType: result.input_type as OIBusDataType,
      outputType: result.output_type as OIBusDataType,
      name: result.name as string,
      description: result.description as string,
      customCode: result.custom_code as string,
      customManifest: JSON.parse(result.custom_manifest as string) as OIBusObjectAttribute
    };
  }
};
