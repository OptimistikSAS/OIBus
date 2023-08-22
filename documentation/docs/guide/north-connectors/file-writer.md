---
sidebar_position: 3
---

# File Writer
The File Writer connector simply writes what is received from the South on the specified folder.

## Specific settings
- **Output folder**: The folder to store the files into
- **Prefix file name**: Add a prefix to the file name
- **Suffix file name**: Add a suffix to the filename (before the file extension)

## JSON payloads
For JSON payload, the JSON is stored in a JSON file. For example:
````json
[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]
````
