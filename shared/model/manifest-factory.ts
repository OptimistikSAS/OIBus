import { OibArrayFormControl, OibFormControl } from './form.model';
import { DateTimeType, SerializationType } from './types';

export function buildDateTimeFieldsFormControl(dataTypes: Array<DateTimeType>): OibArrayFormControl {
  return {
    key: 'dateTimeFields',
    type: 'OibArray',
    label: 'Date time fields',
    content: [
      {
        key: 'fieldName',
        label: 'Field name',
        type: 'OibText',
        defaultValue: '',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'useAsReference',
        label: 'Reference field',
        type: 'OibCheckbox',
        defaultValue: false,
        displayInViewMode: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'type',
        label: 'Type',
        type: 'OibSelect',
        defaultValue: 'string',
        options: dataTypes,
        pipe: 'dateTimeType',
        displayInViewMode: true,
        validators: [{ key: 'required' }]
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'OibTimezone',
        defaultValue: 'UTC',
        newRow: true,
        validators: [{ key: 'required' }],
        displayInViewMode: true,
        conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
      },
      {
        key: 'format',
        label: 'Format',
        type: 'OibText',
        defaultValue: 'yyyy-MM-dd HH:mm:ss',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['string'] }
      },
      {
        key: 'locale',
        label: 'Locale',
        defaultValue: 'en-En',
        type: 'OibText',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['string'] }
      }
    ],
    class: 'col',
    newRow: true,
    displayInViewMode: false
  };
}

export const proxy: Array<OibFormControl> = [
  {
    key: 'useProxy',
    label: 'Use proxy',
    type: 'OibCheckbox',
    newRow: true,
    defaultValue: false,
    displayInViewMode: true,
    validators: [{ key: 'required' }]
  },
  {
    key: 'proxyUrl',
    label: 'Proxy URL',
    type: 'OibText',
    validators: [{ key: 'required' }],
    conditionalDisplay: { field: 'useProxy', values: [true] }
  },
  {
    key: 'proxyUsername',
    label: 'Proxy username',
    type: 'OibText',
    conditionalDisplay: { field: 'useProxy', values: [true] }
  },
  {
    key: 'proxyPassword',
    label: 'Proxy password',
    type: 'OibSecret',
    conditionalDisplay: { field: 'useProxy', values: [true] }
  }
];

export function buildSerializationFormControl(serializationTypes: Array<SerializationType>): OibFormControl {
  return {
    key: 'serialization',
    type: 'OibFormGroup',
    label: 'Serialization',
    newRow: true,
    displayInViewMode: false,
    validators: [{ key: 'required' }],
    content: [
      {
        key: 'type',
        type: 'OibSelect',
        label: 'Type',
        options: serializationTypes,
        defaultValue: serializationTypes[0],
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'filename',
        type: 'OibText',
        label: 'Filename',
        defaultValue: '@ConnectorName-@CurrentDate.csv',
        newRow: false,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'delimiter',
        type: 'OibSelect',
        label: 'Delimiter',
        pipe: 'character',
        options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        defaultValue: 'COMMA',
        newRow: false,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'compression',
        type: 'OibCheckbox',
        label: 'Compression',
        defaultValue: false,
        newRow: false,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'outputTimestampFormat',
        type: 'OibText',
        label: 'Output date time format',
        defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
        newRow: true,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      },
      {
        key: 'outputTimezone',
        type: 'OibTimezone',
        label: 'Output timezone',
        defaultValue: 'Europe/Paris',
        newRow: false,
        displayInViewMode: false,
        validators: [{ key: 'required' }]
      }
    ]
  };
}
