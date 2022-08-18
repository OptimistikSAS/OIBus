import { jest } from '@jest/globals'

import Queue from './queue.class.js'

// Mock logger
jest.mock('../engine/logger/Logger.class.js')

const functionWithDelay = async (cb) => new Promise((resolve) => {
  setTimeout(() => {
    cb()
    resolve()
  }, 1000)
})

let queue = null
beforeEach(() => {
  jest.useFakeTimers()
  queue = new Queue()
})

describe('Queue services', () => {
  it('should run appropriately when using queue', async () => {
    const callback = jest.fn()
    queue.add(functionWithDelay, callback)
    queue.add(functionWithDelay, callback)
    expect(callback).toHaveBeenCalledTimes(0)

    // Fast-forward until all timers have been executed
    jest.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(1)

    queue.clear()
    queue.add(functionWithDelay, callback)
    jest.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
