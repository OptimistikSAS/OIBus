const Logger = require('../engine/logger/Logger.class')

/**
 * Create a Queue with auto
 * @class Queue
 */
class Queue {
  constructor() {
    this.queue = []
    this.run = false
    this.logger = Logger.getDefaultLogger()
    this.prevWarningLevel = 0
  }

  clear() {
    this.queue = []
    return this.queue
  }

  async add(fn, ...args) {
    this.queue.push({ fn, args })

    const { length } = this.queue
    if (((length % 10) === 0) && (length > this.prevWarningLevel)) {
      this.logger.warn(`Queue length reached ${this.queue.length}`)
      this.prevWarningLevel = length
    }

    await this.next()
  }

  async next() {
    if (this.queue.length < 1) {
      if (this.prevWarningLevel > 0) {
        this.logger.warn('Queue emptied')
        this.prevWarningLevel = 0
      }
      return
    }
    if (this.run) return
    const { fn, args } = this.queue.shift()
    this.run = true
    try {
      await fn(...args)
    } catch (error) {
      this.logger.error(error)
    }
    this.run = false
    await this.next()
  }
}

module.exports = Queue
