const DELAY_RELOAD = 1000
const DELAY_SHUTDOWN = 1000

/**
 * Reload OIBus.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const reload = async (ctx) => {
  setTimeout(() => {
    // Ask the Master Cluster to reload
    process.send({ type: 'reload' })
  }, DELAY_RELOAD)

  ctx.ok('Reloading...')
}

/**
 * Shutdown OIBus.
 * @param {Object} ctx  - The KOA context
 * @returns {void}
 */
const shutdown = async (ctx) => {
  setTimeout(() => {
    // Ask the Master Cluster to shut down
    process.send({ type: 'shutdown' })
  }, DELAY_SHUTDOWN)

  ctx.ok('Shutting down...')
}

export default {
  reload,
  shutdown,
}
