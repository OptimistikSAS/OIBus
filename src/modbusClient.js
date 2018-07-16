const modbus = require('jsmodbus')
const net = require('net')
const { CronJob } = require('cron')
const fs = require('fs')

const socket = new net.Socket()
const client = new modbus.client.TCP(socket)
const options = {
  host: 'localhost',
  port: 502,
}

socket.on('connect', () => {
  const frequences = JSON.parse(fs.readFileSync('./config/frequences.json', 'utf8')) // Read the cron frequences file
  const optimizedConfig = JSON.parse(fs.readFileSync('./config/optimizedConfig.json', 'utf8')) // Read configuration file synchronously

  if (!optimizedConfig) {
    console.log('Optimized config file not found. Make sure you generated it correctly.')
    return false
  }
  if (!frequences) {
    console.log('Frequences file not found.')
    return false
  }

  optimizedConfig.forEach((equipment) => {
    const { equipmentId, protocol, variableGroups } = equipment
    Object.keys(variableGroups).forEach((frequence) => {
      const typesForFrequence = variableGroups[frequence]
      const cronTime = frequences.find(({ name }) => name === frequence)
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.keys(typesForFrequence).forEach((type) => {
            const addressesForType = typesForFrequence[type]
            let modbusFunction
            switch (type) {
              case 'holdingRegister':
                modbusFunction = client.readHoldingRegisters
                break
              case 'inputRegister':
                modbusFunction = client.readInputRegisters
                break
              case 'discreteInput':
                modbusFunction = client.readDiscreteInputs
                break
              default:
                modbusFunction = client.readCoils
                break
            }
            Object.keys(addressesForType).forEach((range) => {
              const addresses = addressesForType[range]
              console.log(addresses)
              const rangeAddresses = range.split('-')
              const { 0: startAddress, 1: endAddress } = rangeAddresses
              modbusFunction(startAddress, endAddress).then((resp) => {
                console.log('Response: ', JSON.stringify(resp.response))
                socket.end()
              }).catch((error) => {
                console.error(error)
                socket.end()
              })
            })
          })
        },
      })
      job.start()
    })
  })
})
socket.connect(options)

