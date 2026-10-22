import { OIBusRecord } from '../../shared/model/common/content.model';

/**
 * The OIBus remote agent (ODBC, OLEDB) returns the query result as a CSV text: a header line, then one line per record.
 * It joins the values with the delimiter it is asked for, without quoting them, so the delimiter is a control character
 * (the ASCII unit separator) that does not appear in the data.
 */
export const REMOTE_AGENT_DELIMITER = '\u001F';

/**
 * The agent formats the values of the reference field (`timeColumn`) with these NodaTime pattern and timezone: an ISO
 * 8601 string in UTC with milliseconds. The other fields are sent as the database driver renders them.
 */
export const REMOTE_AGENT_TIMESTAMP_FORMAT = "uuuu'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'";
export const REMOTE_AGENT_TIMEZONE = 'UTC';

/**
 * Parse the result of the remote agent into records. Values are kept as strings, except the empty ones, which the
 * agent sends for database nulls (and for values it fails to convert), parsed as null.
 */
export const parseRemoteAgentRecords = (content: string): Array<OIBusRecord> => {
  const [headerLine, ...lines] = content.split(/\r?\n/);
  if (!headerLine) return [];
  const fieldNames = headerLine.split(REMOTE_AGENT_DELIMITER);
  return lines
    .filter(line => line !== '')
    .map(line => {
      const values = line.split(REMOTE_AGENT_DELIMITER);
      const record: OIBusRecord = {};
      fieldNames.forEach((fieldName, index) => {
        const value = values[index];
        record[fieldName] = value === undefined || value === '' ? null : value;
      });
      return record;
    });
};
