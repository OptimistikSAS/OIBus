import type from '../../client/helpers/validation'

const validation = {
  CSV: {
    inputFolder: type.string,
    archiveFolder: type.string,
    errorFolder: type.string,
    separator: type.string,
    timeColumn: type.number,
    points: {
      pointId: type.string,
      value: type.stringOrNumber,
      quality: type.stringOrNumber,
    },
  },
}

export default validation
