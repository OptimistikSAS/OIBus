const validation = {
  FolderScanner: {
    inputFolder: (val) => ((val && val.length > 0) ? null : 'Input Folder should not be empty'),
    minAge: (val) => (val > 0 ? null : 'Minimum Age should be greater than 0'),
    regex: (val) => ((val && val.length > 0) ? null : 'RegEx should not be empty'),
  },
}

export default validation
