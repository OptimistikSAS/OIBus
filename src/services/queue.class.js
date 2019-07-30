
/**
 * Create a Queue with auto
 * @class Queue
 */
class Queue {
  constructor() {
    this.queue = []
    this.run = false
  }

  clear() {
    this.queue = []
    return this.queue
  }

  async add(fn, ...args) {
    this.queue.push({ fn, args })
    await this.next()
  }

  async next() {
    if (this.queue.length < 1) return
    if (this.run) return
    const { fn, args } = this.queue.shift()
    this.run = true
    await fn(...args)
    this.run = false
    await this.next()
  }
}

module.exports = Queue
