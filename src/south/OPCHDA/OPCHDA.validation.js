import type from '../../client/helpers/validation'

const validation = {
  OPCHDA: {
    agentFilename: type.string,
    tcpPort: type.number,
    host: type.string,
    serverName: type.string,
    retryInterval: type.number,
    points: { pointId: type.string },
  },
}

export default validation
