import { TestBed } from '@angular/core/testing';

import { describe, expect, test } from 'vitest';

import { ALL_CSV_CHARACTERS } from '@oibus/shared/common/types';
import { OIBUS_NORTH_CATEGORIES, OIBUS_NORTH_TYPES } from '@oibus/shared/connector/north-manifest.model';
import { OIBUS_SOUTH_CATEGORIES, OIBUS_SOUTH_TYPES } from '@oibus/shared/connector/south-manifest.model';
import { INPUT_TYPES, OUTPUT_TYPES } from '@oibus/shared/connector/transformer-manifest.model';
import { AUDIT_ENTITY_TYPES } from '@oibus/shared/domain/audit.model';
import { LOG_LEVELS, SCOPE_TYPES } from '@oibus/shared/domain/logs.model';
import { CUSTOM_TRANSFORMER_LANGUAGES } from '@oibus/shared/domain/transformer.model';
import { OIBUS_COMMAND_STATUS, OIBUS_COMMAND_TYPES } from '@oibus/shared/oia/command.model';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import { AuditEntityTypesEnumPipe } from './audit-entity-types-enum.pipe';
import { BaseEnumPipe } from './base-enum-pipe';
import { BooleanEnumPipe } from './boolean-enum.pipe';
import { CsvCharacterEnumPipe } from './csv-character-enum.pipe';
import { EnabledEnumPipe } from './enabled-enum.pipe';
import { LogLevelsEnumPipe } from './log-levels-enum.pipe';
import { OibusCommandStatusEnumPipe } from './oibus-command-status-enum.pipe';
import { OibusCommandTypeEnumPipe } from './oibus-command-type-enum.pipe';
import { OibusInputDataTypeEnumPipe } from './oibus-input-data-type-enum.pipe';
import { OIBusNorthCategoryEnumPipe } from './oibus-north-category-enum.pipe';
import { OIBusNorthTypeDescriptionEnumPipe } from './oibus-north-type-description-enum.pipe';
import { OIBusNorthTypeEnumPipe } from './oibus-north-type-enum.pipe';
import { OibusOutputDataTypeEnumPipe } from './oibus-output-data-type-enum.pipe';
import { OIBusSouthCategoryEnumPipe } from './oibus-south-category-enum.pipe';
import { OIBusSouthTypeDescriptionEnumPipe } from './oibus-south-type-description-enum.pipe';
import { OIBusSouthTypeEnumPipe } from './oibus-south-type-enum.pipe';
import { OIBusTransformerLanguageEnumPipe } from './oibus-transformer-language-enum.pipe';
import { ScopeTypesEnumPipe } from './scope-types-enum.pipe';

interface EnumPipeCase {
  name: string;
  /** translates every value of the enum */
  translateAll: () => Array<unknown>;
  /** translates the values of the examples */
  translateExamples: () => Array<unknown>;
  expectedLabels: Array<string>;
}

function enumPipeCase<E extends string | boolean>(
  pipeType: new () => BaseEnumPipe<E>,
  values: ReadonlyArray<E>,
  examples: ReadonlyArray<[E, string]>
): EnumPipeCase {
  const createPipe = () => TestBed.runInInjectionContext(() => new pipeType());
  return {
    name: pipeType.name,
    translateAll: () => {
      const pipe = createPipe();
      return values.map(value => pipe.transform(value));
    },
    translateExamples: () => {
      const pipe = createPipe();
      return examples.map(([value]) => pipe.transform(value));
    },
    expectedLabels: examples.map(([, label]) => label)
  };
}

const ENUM_PIPES: Array<EnumPipeCase> = [
  enumPipeCase(AuditEntityTypesEnumPipe, AUDIT_ENTITY_TYPES, [['south_connector', 'South connector']]),
  enumPipeCase(
    BooleanEnumPipe,
    [true, false],
    [
      [true, 'Yes'],
      [false, 'No']
    ]
  ),
  enumPipeCase(CsvCharacterEnumPipe, ALL_CSV_CHARACTERS, [
    ['TAB', 'Tab'],
    ['NON_BREAKING_SPACE', 'Space']
  ]),
  enumPipeCase(LogLevelsEnumPipe, LOG_LEVELS, [
    ['silent', 'Silent'],
    ['error', 'Error']
  ]),
  enumPipeCase(OibusCommandStatusEnumPipe, OIBUS_COMMAND_STATUS, [
    ['RETRIEVED', 'Pending'],
    ['ERRORED', 'Errored']
  ]),
  enumPipeCase(OibusCommandTypeEnumPipe, OIBUS_COMMAND_TYPES, [
    ['update-version', 'Upgrade version'],
    ['create-or-update-south-items-from-csv', 'Load south items from CSV']
  ]),
  enumPipeCase(OibusInputDataTypeEnumPipe, INPUT_TYPES, [
    ['any', 'Files (for all sources)'],
    ['time-values', 'OIBus Time Values (for all sources)']
  ]),
  enumPipeCase(OibusOutputDataTypeEnumPipe, OUTPUT_TYPES, [
    ['oianalytics', 'OIAnalytics optimized time values'],
    ['opcua', 'OPCUA']
  ]),
  enumPipeCase(OIBusNorthCategoryEnumPipe, OIBUS_NORTH_CATEGORIES, [['debug', 'Debug']]),
  enumPipeCase(OIBusNorthTypeEnumPipe, OIBUS_NORTH_TYPES, [['aws-s3', 'Amazon S3™']]),
  enumPipeCase(OIBusNorthTypeDescriptionEnumPipe, OIBUS_NORTH_TYPES, [['azure-blob', 'Store files in Microsoft Azure Blob Storage™']]),
  enumPipeCase(OIBusSouthCategoryEnumPipe, OIBUS_SOUTH_CATEGORIES, [['iot', 'IoT']]),
  enumPipeCase(OIBusSouthTypeEnumPipe, OIBUS_SOUTH_TYPES, [
    ['ads', 'ADS - TwinCAT®'],
    ['mysql', 'MySQL® / MariaDB™']
  ]),
  enumPipeCase(OIBusSouthTypeDescriptionEnumPipe, OIBUS_SOUTH_TYPES, [['folder-scanner', 'Read files from a local or remote folder']]),
  enumPipeCase(OIBusTransformerLanguageEnumPipe, CUSTOM_TRANSFORMER_LANGUAGES, [
    ['javascript', 'JavaScript'],
    ['typescript', 'TypeScript']
  ]),
  enumPipeCase(ScopeTypesEnumPipe, SCOPE_TYPES, [['history-query', 'History query']])
];

describe('enum pipes', () => {
  describe.each(ENUM_PIPES)('$name', ({ translateAll, translateExamples, expectedLabels }) => {
    test('should translate every value of the enum', () => {
      TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
      // a missing translation key throws (see provideI18nTesting)
      const labels = translateAll();

      for (const label of labels) {
        expect(label).toEqual(expect.any(String));
        expect(label).not.toMatch(/^enums\./);
      }
    });

    test('should translate values to their label', () => {
      TestBed.configureTestingModule({ providers: [provideI18nTesting()] });

      expect(translateExamples()).toEqual(expectedLabels);
    });
  });

  test('BaseEnumPipe should translate null to an empty string', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new LogLevelsEnumPipe());

    expect(pipe.transform(null)).toBe('');
  });

  test('EnabledEnumPipe should translate the enabled state', () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    const pipe = TestBed.runInInjectionContext(() => new EnabledEnumPipe());

    expect(pipe.transform(true)).toBe('active');
    expect(pipe.transform(false)).toBe('paused');
  });
});
