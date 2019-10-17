const validation = {
  AmazonS3: {
    bucket: (val) => ((val && val.length > 0) ? null : 'Bucket should not be empty'),
    folder: (val) => ((val && val.length > 0) ? null : 'Folder should not be empty'),
    authentication: {
      accessKey: (val) => ((val && val.length > 0) ? null : 'Access Key should not be empty'),
      secretKey: (val) => ((val && val.length > 0) ? null : 'Secret Key should not be empty'),
    },
  },
}

export default validation
