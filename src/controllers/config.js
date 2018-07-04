import { CronJob } from 'cron'

const fs = require('fs')
const configService = require('../services/config.service')

/**
 * Gets the configuration file
 * @param {Object} ctx : koa context
 * @return {void}
 */
const getConfig = (_ctx) => {
  const args = configService.parseArgs()

  // Check if the arguments are not null or undefined
  if (!args) {
    console.error('Args validity check failed!')
    return false
  }

  const { config } = args // Get the configuration file path

  // Check if the provided file is json
  if (!config.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return false
  }

  // Read configuration file synchronously
  const configFile = JSON.parse(fs.readFileSync(config, 'utf8'))

  if (!configFile) {
    console.error(`The file ${config} could not be loaded!`)
    return false
  }

  // Browse elements of the file
  configFile.forEach((element, index) => {
    const { nodeId, protocol, mode } = element
    console.log(`Element n°${index}: `, nodeId, protocol, mode)
    if (mode === 'poll') {
      const { freq } = element // Get the frequence if mode is poll
      if (!freq) {
        console.error(`Frequence was not defined for poll mode in the element ${index}!`)
        return false
      }

      /**
       * Cron time format
          * * * * * *
          | | | | | |
          | | | | | +-- Year              (range: 1900-3000)
          | | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
          | | | +------ Month of the Year (range: 1-12)
          | | +-------- Day of the Month  (range: 1-31)
          | +---------- Hour              (range: 0-23)
          +------------ Minute            (range: 0-59)
      */
      try {
        const job = new CronJob({
          cronTime: freq,
          onTick: () => {
            console.log('Poll mode job for nodeId: ', nodeId)
          },
          start: true,
        })
        console.info('Job status: ', job.running)
      } catch (error) {
        console.error(`Cron pattern is not valid for ${freq}. `, error)
      }
    }
    return element
  })

  return true
}

module.exports = { getConfig }
