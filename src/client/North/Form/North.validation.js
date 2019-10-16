const validation = {
  caching: {
    sendInterval: (val) => (val >= 1000 ? null : 'Send interval should be greater or equal to 1000'),
    retryInterval: (val) => (val >= 1000 ? null : 'Retry interval should be greater or equal to 1000'),
    groupCount: (val) => (val > 0 ? null : 'Group count should be greater than 0'),
    maxSendCount: (val) => (val > 0 ? null : 'Max group count should be greater than 0'),
  },
}

export default validation
