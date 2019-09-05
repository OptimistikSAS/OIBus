import type from '../../client/helpers/validation'

const validation = {
  MQTT: {
    server: type.string,
    port: type.number,
    username: type.string,
    password: type.string,
    points: {
      pointId: type.string,
      topic: type.string,
    },
  },
}

export default validation
