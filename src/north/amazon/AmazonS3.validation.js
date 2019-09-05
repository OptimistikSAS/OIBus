import type from '../../client/helpers/validation'

const validation = {
  AmazonS3: {
    bucket: type.string,
    folder: type.string,
    authentication: {
      accessKey: type.string,
      secretKey: type.string,
    },
    proxy: type.string,
  },
}

export default validation
