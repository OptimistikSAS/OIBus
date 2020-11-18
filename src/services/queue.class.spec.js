import Queue from './queue.class'
// Mock logger
jest.mock('../engine/Logger.class')

describe('Queue services', () => {
  jest.useFakeTimers()
  const functionWithDelay = async (cb) => new Promise((resolve) => setTimeout(() => {
    cb()
    resolve()
  }, 1000))

  const queue = new Queue()
  it('should run appropriately when using queue', async () => {
    const callback = jest.fn()
    queue.add(functionWithDelay, callback)
    queue.add(functionWithDelay, callback)
    /** @todo should below be 1? */
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
