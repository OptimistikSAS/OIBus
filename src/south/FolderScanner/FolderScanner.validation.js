import type from '../../client/helpers/validation'

const validation = {
  FolderScanner: {
    inputFolder: type.string,
    minAge: type.number,
    regex: type.string,
  },
}

export default validation
