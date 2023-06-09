---
sidebar_position: 4
---

# File Writer
The File Writer connector simply writes what is received from the South on the specified folder:
- **Output folder**: the folder to store the files into
- **Prefix file name**: add a prefix to the file name
- **Suffix file name**: add a suffix to the filename (before the file extension)

For JSON payload, the JSON is stored in a JSON file. For example: 

````json
[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]
````
