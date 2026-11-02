import { SouthDiscoveryTemplate } from '../../../shared/model/connector/south-manifest.model';

/**
 * The analog, discrete and string tags of a Wonderware (AVEVA) Historian, read from its `Runtime` database, with their
 * description, engineering range and unit, discrete messages, and where they are acquired from. The Historian's own system
 * tags (`Sys...`) are left out, and the codes (acquisition, storage, raw type...) are kept as the Historian stores them.
 */
export const WONDERWARE_HISTORIAN_TAGS: SouthDiscoveryTemplate = {
  id: 'wonderware-historian-tags',
  query: `SELECT
  t.TagName AS tagName,
  t.Description AS description,
  t.TagType AS tagTypeCode,
  CASE t.TagType WHEN 1 THEN 'analog' WHEN 2 THEN 'discrete' WHEN 3 THEN 'string' ELSE 'other' END AS tagType,
  eu.Unit AS unit,
  a.MinEU AS minEU,
  a.MaxEU AS maxEU,
  a.MinRaw AS minRaw,
  a.MaxRaw AS maxRaw,
  a.Scaling AS scaling,
  a.RawType AS rawType,
  a.IntegerSize AS integerSize,
  a.Sign AS sign,
  a.ValueDeadband AS valueDeadband,
  a.RateDeadband AS rateDeadband,
  a.InterpolationType AS interpolationType,
  a.RolloverValue AS rolloverValue,
  m.Message0 AS offMessage,
  m.Message1 AS onMessage,
  s.MaxLength AS maxLength,
  t.AcquisitionType AS acquisitionType,
  t.AcquisitionRate AS acquisitionRate,
  t.StorageType AS storageType,
  t.StorageRate AS storageRate,
  t.TimeDeadband AS timeDeadband,
  t.ItemName AS ioItem,
  tp.Name AS ioTopic,
  io.ApplicationName AS ioApplication,
  io.ComputerName AS ioComputer,
  t.CreatedBy AS createdBy,
  CONVERT(varchar(33), t.DateCreated, 126) AS createdAt
FROM Tag t
LEFT JOIN AnalogTag a ON a.TagName = t.TagName
LEFT JOIN EngineeringUnit eu ON eu.EUKey = a.EUKey
LEFT JOIN DiscreteTag d ON d.TagName = t.TagName
LEFT JOIN Message m ON m.MessageKey = d.MessageKey
LEFT JOIN StringTag s ON s.TagName = t.TagName
LEFT JOIN Topic tp ON tp.TopicKey = t.TopicKey
LEFT JOIN IOServer io ON io.IOServerKey = t.IOServerKey
WHERE t.TagType IN (1, 2, 3)
  AND t.TagName NOT LIKE 'Sys%'
ORDER BY t.TagName`
};
