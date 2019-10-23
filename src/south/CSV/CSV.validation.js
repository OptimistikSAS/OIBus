const validation = {
  CSV: {
    inputFolder: (val) => ((val && val.length > 0) ? null : 'Input Folder should not be empty'),
    archiveFolder: (val) => ((val && val.length > 0) ? null : 'Archive Folder should not be empty'),
    errorFolder: (val) => ((val && val.length > 0) ? null : 'Error Folder should not be empty'),
    separator: (val) => ((val && val.length === 1) ? null : 'Length should be 1'),
    timeColumn: (val) => (((val && val.length > 0) || val === 0 || val >= 1) ? null : 'Value should not be empty'),
    points: {
      pointId: (val) => ((val && val.length > 0) ? null : 'Point Id should not be empty'),
      value: (val) => (((val && val.length > 0) || val === 0 || val >= 1) ? null : 'Value should not be empty'),
      quality: (val) => (((val && val.length > 0) || val === 0 || val >= 1) ? null : 'Value should not be empty'),
    },
  },
}

export default validation
