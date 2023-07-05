import { OibArrayFormControl, OibFormControl } from './form.model';
import { DateTimeType } from './types';

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

export const serialization: OibFormControl = {
  key: 'serialization',
  type: 'OibFormGroup',
  label: 'Serialization',
  class: 'col',
  newRow: true,
  displayInViewMode: false,
  content: [
    {
      key: 'type',
      type: 'OibSelect',
      label: 'Type',
      options: ['csv', 'json'],
      defaultValue: 'csv',
      newRow: true,
      displayInViewMode: false
    },
    {
      key: 'filename',
      type: 'OibText',
      label: 'Filename',
      defaultValue: 'sql.csv',
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'delimiter',
      type: 'OibSelect',
      label: 'Delimiter',
      pipe: 'character',
      options: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
      defaultValue: 'COMMA',
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      label: 'Compression',
      defaultValue: false,
      newRow: false,
      displayInViewMode: false
    },
    {
      key: 'outputTimestampFormat',
      type: 'OibText',
      label: 'Output date time format',
      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
      newRow: true,
      displayInViewMode: false
    },
    {
      key: 'outputTimezone',
      type: 'OibTimezone',
      label: 'Output timezone',
      defaultValue: 'Europe/Paris',
      newRow: false,
      displayInViewMode: false
    }
  ]
};
