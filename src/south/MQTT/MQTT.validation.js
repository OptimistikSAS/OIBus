import type from '../../client/helpers/validation'

const validation = {
  MQTT: {
    server: type.string,
    port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    points: {
      pointId: type.string,
      topic: type.string,
    },
  },
}

export default validation
