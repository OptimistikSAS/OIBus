---
sidebar_position: 1
---

# Folder Scanner

The Folder Scanner connector periodically checks the input folder for new files, according to Regexp specified in its items.
When a new file is detected, it is sent to North caches.

## Specific settings
- **Input folder**: Path of the folder scan. The path can be absolute or relative (the relative path is computed from 
the Data folder, mentioned in the About section). Remote path can be specified (example:
  `/remote.server/data` or `Z:\\Remote disk\\DATA `). Be careful:**the path is case-sensitive**. 

- **Preserve file**: When enabled, retrieved files are kept in the folder. Useful when another application needs to access the files.
Preserve file list all the file retrieved in the cache, with their last modification time. If the modification time does 
not change, the file is ignored, otherwise, the file is retrieved again. 

- **Ignored modified date** (_preserve file must be enabled_): Retrieve the file again, even if its modification time has not changed 
since the last retrieval.

- **Compress file**: Compress file with gzip locally before sending it into the north caches.

- **Minimum age**: Writing large files to the input folder can take some time. To avoid retrieving a corrupted file 
(because it is being written), the _Minimum age_ field can be adjusted. By default, OIBus recovers files that has been 
written more than one second ago.

:::danger User access
The user running OIBus (the logged user when OIBus run from a terminal or the service session when OIBus run from a service)
must have read access to the input folder to be able to read the files. If **Preserve file** is not enable, the files will
be removed, so the write access may be needed.
:::

## Item settings 
- RegExp: A Regular Expression can be used to retrieve only certain files matching the regular expression. 
  - `.*` retrieves all files of the input folder
  - `.*.txt` retrieves all txt files of the input folder
  - `.*.csv` retrieves all csv files of the input folder
  - `.csv||.xlsx` retrieves all csv or xlsx files of the input folder


:::info Regex testing
To test your regular expressions, you can use https://regex101.com/
:::