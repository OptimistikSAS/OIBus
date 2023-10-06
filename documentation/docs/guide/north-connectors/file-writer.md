---
sidebar_position: 3
---

# File Writer
The File Writer connector performs a straightforward task of writing the data received from the South connector to a 
designated folder.

## Specific settings
- **Output folder**: This is the directory where files will be stored. In the case of a relative path, it is computed based 
on the **Data folder** mentioned in the _About_ section.
- **Prefix filename**: You can include a prefix to be added to the filename.
- **Suffix filename**: You have the option to append a suffix to the filename, which appears just before the file extension.

:::tip
Prefix and suffix options can incorporate the internal variables `@ConnectorName` and `@CurrentDate`. For instance, 
when using `@ConnectorName-` as a prefix and `-@CurrentDate` as a suffix, a filename like _example.file_ will result 
in an output format of `<ConnectorName>-example-<CurrentDate>.file`, where `<CurrentDate>` will be replaced with the 
current date and time in the **yyyy_MM_dd_HH_mm_ss_SSS** format.
:::

## JSON payloads
In the case of JSON payloads, the JSON data is stored in a JSON file. For instance:
```json title="JSON file"
[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]
```
