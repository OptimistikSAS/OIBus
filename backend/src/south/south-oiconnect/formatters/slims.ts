import { Instant } from '../../../../../shared/model/types';
import { DateTime } from 'luxon';

interface SlimsColumn {
  name: string;
  value: any;
  unit?: string;
}

interface SlimsEntity {
  columns: Array<SlimsColumn>;
}

interface SlimsResults {
  entities: Array<SlimsEntity>;
}

/**
 * Parse data from SLIMS Result table
 * Return the formatted results flattened for easier access
 * (into csv files for example) and the latestDateRetrieved in ISO String format
 */
const format = (httpResult: SlimsResults): { httpResults: Array<any>; latestDateRetrieved: Instant } => {
  if (!httpResult?.entities || !Array.isArray(httpResult.entities)) {
    throw new Error('Bad data: expect SLIMS values to be an array.');
  }
  const formattedData: Array<any> = [];
  let latestDateRetrieved = DateTime.fromMillis(0).toUTC().toISO();
  httpResult.entities.forEach(element => {
    const rsltCfPid = element.columns.find(column => column.name === 'rslt_cf_pid');
    if (!rsltCfPid?.value) {
      throw new Error('Bad data: expect rslt_cf_pid to have a value.');
    }
    const testName = element.columns.find(column => column.name === 'test_name');
    if (!testName?.value) {
      throw Error('Bad data: expect test_name to have a value.');
    }
    const rsltValue = element.columns.find(column => column.name === 'rslt_value');
    if (!rsltValue || (rsltValue && rsltValue.value === null)) {
      throw new Error('Bad data: expect rslt_value to have a unit and a value.');
    }
    const rsltCfSamplingDateAndTime = element.columns.find(column => column.name === 'rslt_cf_samplingDateAndTime');
    if (!rsltCfSamplingDateAndTime?.value) {
      throw new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value.');
    }
    formattedData.push({
      pointId: `${rsltCfPid.value}-${testName.value}`,
      unit: rsltValue.unit || 'Ø',
      timestamp: DateTime.fromMillis(rsltCfSamplingDateAndTime.value).toUTC().toISO(),
      value: rsltValue.value
    });
    if (DateTime.fromMillis(rsltCfSamplingDateAndTime.value).toUTC().toISO() > latestDateRetrieved) {
      latestDateRetrieved = DateTime.fromMillis(rsltCfSamplingDateAndTime.value).toUTC().toISO();
    }
  });
  // increment the latest date retrieved to avoid loop in history query from slims
  return { httpResults: formattedData, latestDateRetrieved: DateTime.fromISO(latestDateRetrieved).plus(1).toUTC().toISO() };
};

export default format;
