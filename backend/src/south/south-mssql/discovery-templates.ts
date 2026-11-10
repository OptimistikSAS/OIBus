import { SouthDiscoveryTemplate } from '../../../shared/model/connector/south-manifest.model';

/**
 * The analog, discrete and string tags of a Wonderware (AVEVA) Historian, read from its `Runtime` database, with their
 * description, engineering range and unit, discrete messages, and where they are acquired from. The Historian's own system
 * tags (`Sys...`) are left out, and the codes (acquisition, storage, raw type...) are kept as the Historian stores them.
 *
 * The tags historized by an Application Server (System Platform) also get where they are in its model view, which the
 * Historian keeps a copy of in `aaObjectData` (areas and objects, each with its parent) and `aaAttributeData` (the tag of
 * each historized attribute of an object): the area of the tag, its equipment - the top object under that area - and
 * its sub-equipment - the object contained in that equipment, the tag belongs to or is under - with its full
 * hierarchical name (e.g. `Reactor_001.Inlet.Level`). They are null for the tags of other sources (I/O servers...).
 *
 * The same for Historian 2020, 2023 and 2026, whose `Runtime` database have the same tables and views for these: `Tag`,
 * `AnalogTag`, `DiscreteTag`, `StringTag`, `Topic` and `IOServer` are views kept for backward compatibility since 2020.
 */
export const WONDERWARE_HISTORIAN_TAGS: SouthDiscoveryTemplate = {
  id: 'wonderware-historian-tags',
  query: `WITH Ancestor AS (
  -- The object of each historized attribute, then its parents up to its area (Type 0)
  SELECT ad.AttributeName AS TagName, ad.HierarchicalAttributeName AS HierarchicalName, o.Type, o.aaTagName, o.ParentKey, 0 AS Depth
  FROM aaAttributeData ad
  INNER JOIN aaObjectData o ON o.ObjectKey = ad.ObjectKey
  UNION ALL
  SELECT an.TagName, an.HierarchicalName, p.Type, p.aaTagName, p.ParentKey, an.Depth + 1
  FROM Ancestor an
  INNER JOIN aaObjectData p ON p.ObjectKey = an.ParentKey
  WHERE an.Type <> 0
),
AncestorPath AS (
  SELECT an.*, MAX(CASE WHEN an.Type <> 0 THEN an.Depth END) OVER (PARTITION BY an.TagName) AS EquipmentDepth
  FROM Ancestor an
),
Hierarchy AS (
  SELECT
    TagName,
    MAX(HierarchicalName) AS HierarchicalName,
    MAX(CASE WHEN Type = 0 THEN aaTagName END) AS Area,
    MAX(CASE WHEN Type <> 0 AND Depth = EquipmentDepth THEN aaTagName END) AS Equipment,
    MAX(CASE WHEN Type <> 0 AND Depth = EquipmentDepth - 1 THEN aaTagName END) AS SubEquipment
  FROM AncestorPath
  GROUP BY TagName
)
SELECT
  t.TagName AS tagName,
  t.Description AS description,
  t.TagType AS tagTypeCode,
  CASE t.TagType WHEN 1 THEN 'analog' WHEN 2 THEN 'discrete' WHEN 3 THEN 'string' ELSE 'other' END AS tagType,
  h.Area AS area,
  h.Equipment AS equipment,
  h.SubEquipment AS subEquipment,
  h.HierarchicalName AS hierarchicalName,
  eu.Unit AS unit,
  a.MinEU AS minEU,
  a.MaxEU AS maxEU,
  a.MinRaw AS minRaw,
  a.MaxRaw AS maxRaw,
  a.Scaling AS scaling,
  a.RawType AS rawType,
  a.IntegerSize AS integerSize,
  a.SignedInteger AS signedInteger,
  a.ValueDeadband AS valueDeadband,
  a.RateDeadband AS rateDeadband,
  a.InterpolationType AS interpolationType,
  a.RolloverValue AS rolloverValue,
  m.Message0 AS offMessage,
  m.Message1 AS onMessage,
  s.MaxLength AS maxLength,
  t.AcquisitionType AS acquisitionType,
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
LEFT JOIN Hierarchy h ON h.TagName = t.TagName
WHERE t.TagType IN (1, 2, 3)
  AND t.TagName NOT LIKE 'Sys%'
ORDER BY t.TagName`
};
