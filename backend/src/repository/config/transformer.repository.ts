import { Database } from 'better-sqlite3';

import { Page } from '../../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../../shared/model/connector/form.model';
import { InputType, OutputType } from '../../../shared/model/connector/transformer-manifest.model';
import { TransformerLanguage, TransformerSearchParam } from '../../../shared/model/domain/transformer.model';

import { CustomTransformer, StandardTransformer, Transformer } from '../../model/transformer.model';
import { NotFoundError } from '../../model/types';
import AuditService from '../../service/audit.service';
import { generateRandomId } from '../../service/utils';
import CSVToMQTTTransformer from '../../transformers/any/csv-to-mqtt/csv-to-mqtt-transformer';
import CSVToRecordListTransformer from '../../transformers/any/csv-to-record-list/csv-to-record-list-transformer';
import JSONToCSVTransformer from '../../transformers/any/json-to-csv/json-to-csv-transformer';
import JSONToOIAnalyticsTransformer from '../../transformers/any/json-to-oianalytics/json-to-oianalytics-transformer';
import IgnoreTransformer from '../../transformers/ignore-transformer';
import IsoTransformer from '../../transformers/iso-transformer';
import RecordListToCsvTransformer from '../../transformers/record-list/record-list-to-csv/record-list-to-csv-transformer';
import RecordListToJSONTransformer from '../../transformers/record-list/record-list-to-json/record-list-to-json-transformer';
import RecordListToModbusTransformer from '../../transformers/record-list/record-list-to-modbus/record-list-to-modbus-transformer';
import RecordListToMQTTTransformer from '../../transformers/record-list/record-list-to-mqtt/record-list-to-mqtt-transformer';
import RecordListToOIAnalyticsTransformer from '../../transformers/record-list/record-list-to-oianalytics/record-list-to-oianalytics-transformer';
import RecordListToOPCUATransformer from '../../transformers/record-list/record-list-to-opcua/record-list-to-opcua-transformer';
import OIBusSetpointToModbusTransformer from '../../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from '../../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from '../../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';

const TRANSFORMERS_TABLE = 'transformers';
const PAGE_SIZE = 10;

export default class TransformerRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {
    this.createStandardTransformers();
  }

  list(): Array<Transformer> {
    const query = `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code, language, timeout, created_by, updated_by, created_at, updated_at FROM ${TRANSFORMERS_TABLE};`;
    const result = this.database.prepare(query).all();
    return result.map(element => toTransformer(element as Record<string, string>));
  }

  /**
   * Inserts or updates a custom transformer. Whether `transformer.id` is treated as "create" or
   * "update" is decided by the explicit `isNew` the caller passes — never inferred from whether a
   * row for that id happens to exist. This matters in two directions: an update whose target was
   * deleted by another request in the meantime fails loudly (`NotFoundError`) instead of being
   * silently reinterpreted as a create that resurrects it; and a create under a preserved id (config
   * import) always INSERTs rather than falling into the UPDATE branch on a collision — standard and
   * custom transformers share one id space (see `createStandardTransformers`), so treating a
   * collision as "must be an update" would silently overwrite an unrelated standard transformer's
   * columns instead of failing with a constraint error the caller can react to.
   */
  save(transformer: CustomTransformer, isNew: boolean): void {
    if (isNew) {
      if (!transformer.id) {
        transformer.id = generateRandomId(6);
      }
      this.database
        .prepare(
          `INSERT INTO ${TRANSFORMERS_TABLE} (id, type, input_type, output_type, name, description, custom_manifest, custom_code, language, timeout, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`
        )
        .run(
          transformer.id,
          transformer.type,
          transformer.inputType,
          transformer.outputType,
          transformer.name,
          transformer.description,
          JSON.stringify(transformer.customManifest),
          transformer.customCode,
          transformer.language,
          transformer.timeout,
          transformer.createdBy,
          transformer.updatedBy
        );
      const created = this.findById(transformer.id);
      this.auditService.record(
        'transformer',
        transformer.id,
        'CREATE',
        null,
        created as unknown as Record<string, unknown>,
        transformer.createdBy
      );
    } else {
      const before = this.findById(transformer.id);
      if (!before) {
        // The caller believes this is an update of an existing transformer, but it's gone —
        // most likely deleted by another request during this request's own (awaited) validation.
        throw new NotFoundError(`Transformer "${transformer.id}" not found`);
      }
      this.database
        .prepare(
          `UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, custom_manifest = ?, custom_code = ?, language = ?, timeout = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
        )
        .run(
          transformer.name,
          transformer.description,
          JSON.stringify(transformer.customManifest),
          transformer.customCode,
          transformer.language,
          transformer.timeout,
          transformer.updatedBy,
          transformer.id
        );
      const after = this.findById(transformer.id);
      this.auditService.record(
        'transformer',
        transformer.id,
        'UPDATE',
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        transformer.updatedBy
      );
    }
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
    if (before) {
      this.auditService.record('transformer', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
    }
  }

  findById(id: string): Transformer | null {
    const query = `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code, language, timeout, created_by, updated_by, created_at, updated_at FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;

    return toTransformer(result as Record<string, string>);
  }

  findByFunctionName(functionName: string): StandardTransformer | null {
    const query = `SELECT id, type, input_type, output_type, function_name, custom_manifest, custom_code, language, timeout FROM ${TRANSFORMERS_TABLE} WHERE function_name = ?;`;
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

    const page = searchParams.page;

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
      `SELECT id, type, input_type, output_type, function_name, name, description, custom_manifest, custom_code, language, timeout, created_by, updated_by, created_at, updated_at FROM ${TRANSFORMERS_TABLE} ${whereClause}` +
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

  protected createStandardTransformers() {
    const standardTransformers: Array<Pick<StandardTransformer, 'functionName' | 'inputType' | 'outputType'>> = [
      { functionName: CSVToMQTTTransformer.transformerName, inputType: 'any', outputType: 'mqtt' },
      { functionName: CSVToRecordListTransformer.transformerName, inputType: 'any', outputType: 'record-list' },
      { functionName: IgnoreTransformer.transformerName, inputType: 'any', outputType: 'any' },
      { functionName: IsoTransformer.transformerName, inputType: 'any', outputType: 'any' },
      { functionName: JSONToCSVTransformer.transformerName, inputType: 'any', outputType: 'any' },
      { functionName: JSONToOIAnalyticsTransformer.transformerName, inputType: 'any', outputType: 'oianalytics' },
      { functionName: RecordListToCsvTransformer.transformerName, inputType: 'record-list', outputType: 'any' },
      { functionName: RecordListToJSONTransformer.transformerName, inputType: 'record-list', outputType: 'any' },
      { functionName: RecordListToModbusTransformer.transformerName, inputType: 'record-list', outputType: 'modbus' },
      { functionName: RecordListToMQTTTransformer.transformerName, inputType: 'record-list', outputType: 'mqtt' },
      { functionName: RecordListToOIAnalyticsTransformer.transformerName, inputType: 'record-list', outputType: 'oianalytics' },
      { functionName: RecordListToOPCUATransformer.transformerName, inputType: 'record-list', outputType: 'opcua' },
      { functionName: OIBusSetpointToModbusTransformer.transformerName, inputType: 'setpoint', outputType: 'modbus' },
      { functionName: OIBusSetpointToMQTTTransformer.transformerName, inputType: 'setpoint', outputType: 'mqtt' },
      { functionName: OIBusSetpointToOPCUATransformer.transformerName, inputType: 'setpoint', outputType: 'opcua' }
    ];
    for (const { functionName, inputType, outputType } of standardTransformers) {
      if (!this.findByFunctionName(functionName)) {
        this.createStandardTransformer({ id: generateRandomId(6), type: 'standard', functionName, inputType, outputType });
      }
    }
  }
}

export const toTransformer = (result: Record<string, string>): Transformer => {
  if (result.type === 'standard') {
    return {
      id: result.id as string,
      type: 'standard',
      inputType: result.input_type as InputType,
      outputType: result.output_type as OutputType,
      functionName: result.function_name as string
    };
  } else {
    return {
      id: result.id as string,
      type: 'custom',
      inputType: result.input_type as InputType,
      outputType: result.output_type as OutputType,
      name: result.name as string,
      description: result.description as string,
      customCode: result.custom_code as string,
      language: result.language as TransformerLanguage,
      customManifest: JSON.parse(result.custom_manifest as string) as OIBusObjectAttribute,
      timeout: Number(result.timeout),
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
};
