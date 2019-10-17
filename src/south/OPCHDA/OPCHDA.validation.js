const validation = {
  OPCHDA: {
    agentFilename: (val) => ((val && val.length > 0) ? null : 'Agent Filename should not be empty'),
    tcpPort: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    serverName: (val) => ((val && val.length > 0) ? null : 'Server Name should not be empty'),
    retryInterval: (val) => (val > 0 ? null : 'Retry interval should be greater than 0'),
    points: { pointId: (val) => ((val && val.length > 0) ? null : 'Point Id should not be empty') },
  },
}

export default validation
