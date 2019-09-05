const os = require('os')

/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
  const apisCacheStats = await ctx.app.engine.cache.getCacheStatsForApis()
  const protocolsCacheStats = await ctx.app.engine.cache.getCacheStatsForProtocols()

  const status = {
    Version: ctx.app.engine.getVersion(),
    'Configuration File': ctx.app.engine.configFile,
    Architecture: process.arch,
    CurrentDirectory: process.cwd(),
    'Node Version': process.version,
    Executable: process.execPath,
    'Free/Total Memory/': `${os.freemem()}/${os.totalmem()}`,
    'Process Id': process.pid,
    'Up time': process.uptime(),
    Hostname: os.hostname(),
    'OS release': os.release(),
    'OS type': os.type(),
    ...apisCacheStats,
    ...protocolsCacheStats,
  }
  ctx.ok(status)
}

module.exports = { getStatus }
