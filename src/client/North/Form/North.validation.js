import type from '../../helpers/validation'

const validation = {
  caching: {
    sendInterval: type.number,
    retryInterval: type.number,
    groupCount: type.number,
    maxSendCount: type.number,
  },
}

export default validation
