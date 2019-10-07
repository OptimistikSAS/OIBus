import type from '../../client/helpers/validation'

const validation = {
  OPCHDA: {
    agentFilename: type.string,
    tcpPort: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    serverName: type.string,
    retryInterval: type.number,
    points: { pointId: type.string },
  },
}

export default validation
