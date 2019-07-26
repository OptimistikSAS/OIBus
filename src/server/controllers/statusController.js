const process = require('process')
const os = require('os')

/**
 * Get status info for the dashboard
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getStatus = async (ctx) => {
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
  }
  ctx.ok(status)
}

module.exports = { getStatus }
