import { Database } from 'better-sqlite3';
import { TransformerSearchParam } from '../../../shared/model/transformer.model';
import { generateRandomId } from '../../service/utils';
import { CustomTransformer, StandardTransformer, Transformer } from '../../model/transformer.model';
import { Page } from '../../../shared/model/types';
import IsoTimeValuesTransformer from '../../service/transformers/iso-time-values-transformer';
import OIBusTimeValuesToCsvTransformer from '../../service/transformers/oibus-time-values-to-csv-transformer';
import IsoRawTransformer from '../../service/transformers/iso-raw-transformer';
import { OIBusDataType } from '../../../shared/model/engine.model';
import OIBusTimeValuesToJSONTransformer from '../../service/transformers/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from '../../service/transformers/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToModbusTransformer from '../../service/transformers/oibus-time-values-to-modbus-transformer';
import OIBusTimeValuesToOPCUATransformer from '../../service/transformers/oibus-time-values-to-opcua-transformer';

const TRANSFORMERS_TABLE = 'transformers';
const PAGE_SIZE = 10;

export default class TransformerRepository {
  constructor(private readonly database: Database) {
    this.createStandardTransformers();
  }

  findAll(): Array<Transformer> {
    const query = `SELECT id, name, description, type, input_type, output_type, standard_code, custom_code FROM ${TRANSFORMERS_TABLE};`;
    const result = this.database.prepare(query).all();
    return result.map(element => toTransformer(element as Record<string, string>));
  }

  save(transformer: CustomTransformer): void {
    if (!transformer.id) {
      transformer.id = generateRandomId(6);
      this.database
        .prepare(
          `INSERT INTO ${TRANSFORMERS_TABLE} (id, name, description, type, input_type, output_type, custom_code) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          transformer.id,
          transformer.name,
          transformer.description,
          transformer.type,
          transformer.inputType,
          transformer.outputType,
          transformer.customCode
        );
    } else {
      this.database
        .prepare(`UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, custom_code = ? WHERE id = ?`)
        .run(transformer.name, transformer.description, transformer.customCode, transformer.id);
    }
  }

  delete(id: string): void {
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
  }

  findById(id: string): Transformer | null {
    const query = `SELECT id, name, description, type, input_type, output_type, standard_code, custom_code FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;

    return toTransformer(result as Record<string, string>);
  }

  createStandardTransformer(transformer: StandardTransformer): void {
    this.database
      .prepare(
        `INSERT INTO ${TRANSFORMERS_TABLE} (id, name, description, type, input_type, output_type, standard_code) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        transformer.id,
        transformer.name,
        transformer.description,
        transformer.type,
        transformer.inputType,
        transformer.outputType,
        transformer.standardCode
      );
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
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }

    const query =
      `SELECT id, name, description, type, input_type, output_type, standard_code, custom_code FROM ${TRANSFORMERS_TABLE} ${whereClause}` +
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
    if (!this.findById(IsoRawTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: IsoRawTransformer.transformerName,
        type: 'standard',
        name: IsoRawTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'raw',
        outputType: 'raw'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(IsoTimeValuesTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: IsoTimeValuesTransformer.transformerName,
        type: 'standard',
        name: IsoTimeValuesTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'time-values'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(OIBusTimeValuesToCsvTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: OIBusTimeValuesToCsvTransformer.transformerName,
        type: 'standard',
        name: OIBusTimeValuesToCsvTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'raw'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(OIBusTimeValuesToJSONTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: OIBusTimeValuesToJSONTransformer.transformerName,
        type: 'standard',
        name: OIBusTimeValuesToJSONTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'raw'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(OIBusTimeValuesToMQTTTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: OIBusTimeValuesToMQTTTransformer.transformerName,
        type: 'standard',
        name: OIBusTimeValuesToMQTTTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'mqtt'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(OIBusTimeValuesToOPCUATransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: OIBusTimeValuesToOPCUATransformer.transformerName,
        type: 'standard',
        name: OIBusTimeValuesToOPCUATransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'opcua'
      };
      this.createStandardTransformer(standardTransformer);
    }
    if (!this.findById(OIBusTimeValuesToModbusTransformer.transformerName)) {
      const standardTransformer: StandardTransformer = {
        id: OIBusTimeValuesToModbusTransformer.transformerName,
        type: 'standard',
        name: OIBusTimeValuesToModbusTransformer.transformerName,
        description: '',
        standardCode: '',
        inputType: 'time-values',
        outputType: 'modbus'
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
      name: result.name as string,
      description: result.description as string,
      inputType: result.input_type as OIBusDataType,
      outputType: result.output_type as OIBusDataType,
      standardCode: result.standard_code as string
    };
  } else {
    return {
      id: result.id as string,
      type: 'custom',
      name: result.name as string,
      description: result.description as string,
      inputType: result.input_type as OIBusDataType,
      outputType: result.output_type as OIBusDataType,
      customCode: result.custom_code as string
    };
  }
};
