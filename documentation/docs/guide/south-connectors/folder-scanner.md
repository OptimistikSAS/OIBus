---
sidebar_position: 1
---

# Folder Scanner
The Folder Scanner South connector operates by periodically scanning the specified input folder for new files. It 
utilizes regular expressions (Regexp) defined in its items to determine which files to monitor. When a new file matching 
the defined criteria is detected, it is then transmitted to North caches.

## Specific settings
- **Input folder**: This field specifies the path of the folder to be scanned. The path can be either absolute or relative. 
In the case of a relative path, it is computed based on the **Data folder** mentioned in the _About_ section. Remote paths 
can also be specified, such as `/remote.server/data` or `Z:\Remote disk\DATA`. Note that the path is case-sensitive.
- **Compress file**: If enabled, files are compressed using gzip locally before being sent into the North caches.

## Item settings 
- **RegExp**: You can use a Regular Expression to selectively retrieve files that match a specific pattern. Here are some 
examples:
  - `.*` retrieves all files in the input folder.
  - `.*.txt` retrieves all text files (with a .txt extension) in the input folder.
  - `.*.csv` retrieves all CSV files in the input folder.
  - `.csv||.xlsx` retrieves all files with either a .csv or .xlsx extension in the input folder.
- **Minimum age**: This field is used to set a minimum age for retrieved files. It helps avoid retrieving potentially
  corrupted files that are still being written. By default, OIBus retrieves files that have been written for at least one
  second.
- **Preserve file**: When enabled, retrieved files are kept in the folder. This can be useful when another application
  needs access to these files. The **Preserve file** feature lists all retrieved files in the cache, along with their
  last modification time. If the modification time remains unchanged, the file is ignored. Otherwise, the file is retrieved
  again.
- **Ignored modified date** (_Preserve file_ must be enabled): This option forces the retrieval of a file, even if its
  modification time hasn't changed since the last retrieval. It is useful in situations where you want to ensure that the
  file is always retrieved.

:::info Regex testing
To test your regular expressions, you can utilize a tool like https://regex101.com/.
:::

:::danger User access
The user who runs OIBus (the logged-in user when OIBus is executed from a terminal or the service session when OIBus is
run as a service) must have read access to the input folder in order to read the files. If **Preserve file** is not enabled,
the files are set to be removed and write access may also be needed to delete the files.
:::