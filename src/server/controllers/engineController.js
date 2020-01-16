const os = require('os')
const moment = require('moment-timezone')

/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const apisCacheStats = await ctx.app.engine.cache.getCacheStatsForApis()
  const protocolsCacheStats = await ctx.app.engine.cache.getCacheStatsForProtocols()
  const memoryUsage = ctx.app.engine.getMemoryUsage()

  const freeMemory = Number(os.freemem() / 1024 / 1024).toFixed(2)
  const totalMemory = Number(os.totalmem() / 1024 / 1024).toFixed(2)
  const percentMemory = Number((freeMemory / totalMemory) * 100).toFixed(2)

  const status = {
    Version: ctx.app.engine.getVersion(),
    'Configuration File': ctx.app.engine.configFile,
    Architecture: process.arch,
    CurrentDirectory: process.cwd(),
    'Node Version': process.version,
    Executable: process.execPath,
    ConfigFile: ctx.app.engine.configService.getConfigurationFileLocation(),
    'Free/Total Memory/%': `${freeMemory}/${totalMemory}/${percentMemory} MB/%`,
    ...memoryUsage,
    'Process Id': process.pid,
    'Up time': moment.duration(process.uptime(), 'seconds').humanize(),
    Hostname: os.hostname(),
    'OS release': os.release(),
    'OS type': os.type(),
    Copyright: '(c) Copyright 2019 Optimistik, all rights reserved.',
    ...apisCacheStats,
    ...protocolsCacheStats,
  }
  ctx.ok(status)
}

/**
 * Get North list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorthList = (ctx) => {
  ctx.ok(ctx.app.engine.getNorthList())
}

/**
 * Get South list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getSouthList = (ctx) => {
  ctx.ok(ctx.app.engine.getSouthList())
}

/**
 * Reload OIBus.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const reload = async (ctx) => {
  await ctx.app.engine.reload(10000)

  ctx.ok('Reloading...')
}

/**
 * Add Values to the Engine
 * @param {Object} ctx - The KOA context
 * @param {Object} ctx.body contains the dataSourceId and the array of values
 * @return {void}
 */
const addValues = async (ctx) => {
  const { dataSourceId, values } = ctx.request.body
  try {
    await ctx.app.engine.addValues(dataSourceId, values)
    ctx.ok()
  } catch (error) {
    ctx.throw(500, `Unable to add ${values ? values.length : '...'} from ${dataSourceId}`)
  }
}

module.exports = {
  getStatus,
  getNorthList,
  getSouthList,
  reload,
  addValues,
}
