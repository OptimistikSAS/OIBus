---
sidebar_position: 3
---

# File Writer
The File Writer connector performs a straightforward task of writing the data received from the South connector to a 
designated folder.

## Specific settings
- **Output folder**: This is the directory where files will be stored. Relative paths are calculated based on the data 
folder set during installation (e.g., `C:\OIBusData`).
- **Prefix filename**: You can include a prefix to be added to the filename.
- **Suffix filename**: You have the option to append a suffix to the filename, which appears just before the file extension.

## JSON payloads
In the case of JSON payloads, the JSON data is stored in a JSON file. For instance:
```json title="JSON file"
[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]
```
