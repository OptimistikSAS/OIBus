---
sidebar_position: 3
---

# Folder Scanner

The Folder Scanner connector periodically checks the input folder for new files at an interval specified by the scan
mode. When a new file is detected, it is sent to any North capable of handling files and configured to accept files 
from this South.

## Settings
### Input folder
The folder path must be entered in the _Input folder_ field. The path can be absolute or relative. Be careful: 
**the path is case-sensitive**.

:::tip Relative path

The relative path is computed from the cache folder (mentioned in the About section, _configuration directory_ field).

:::

:::danger User access

The user running OIBus (logged user when OIBus run from a terminal, the service session when OIBus run from a service) 
must have read access to the input folder to be able to read the files.

:::

OIBus can also read folders from a remote location. To do so, remote path can be specified (example: 
`/remote.server/data` or `D:\\Remote disk\\DATA `). Be sure to have access to this folder (network and authentication).

#### Preserve File and modified date
When _Preserve File?_ is checked, retrieved files are kept in the folder. Otherwise, they are deleted once copied in
the OIBus cache.

:::info Important

When this field file is not preserved, OIBus moves it from the input folder to its cache, which in computer terms means it 
deletes the file from the input folder. For this reason, OIBus also needs write access. Otherwise, the file will be 
copied.

:::

When this field is checked, OIBus keeps track of the modification date of files already retrieved. It will only retrieve
a file if its modification date has changed.

If _Ignore modified date_ is checked, files will be resent each time the folder is scanned, regardless of when the file
was modified. This field is not used when _Preserve File?_ is not checked.

### Filtering
#### RegExp
A RegExp can be used to retrieve only certain files matching the regular expression. 
- `.*` retrieves all files of the input folder
- `.*.txt` retrieves all txt files of the input folder
- `.*.csv` retrieves all csv files of the input folder
- `.csv||.xlsx` retrieves all csv or xlsx files of the input folder

#### Minimum age
Writing large files to the input folder can take some time. To avoid retrieving a corrupted file (because it is
being written), the _Minimum Age_ field can be adjusted. By default, OIBus recovers files that has been written more 
than one second ago.

### Compression
By default, files are retrieved exactly as they are in the input folder. They can be compressed to reduce their size 
during transfer. If enabled, files stored in the OIBus cache are compressed too.

:::danger Important

When compression is enabled, OIBus writes the compressed file to the input folder. Therefore, OIBus also needs 
write access. Otherwise, the compression will be ignored and the raw file will be copied.

:::
