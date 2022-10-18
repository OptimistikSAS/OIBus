const DeferredPromise = require('./deferred-promise')

describe('DeferredPromise', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  it('it should resolve', async () => {
    const callback = jest.fn()
    const deferredPromise$ = new DeferredPromise()

    setTimeout(() => {
      deferredPromise$.resolve()
    }, 1000)

    deferredPromise$.promise.then(() => {
      callback()
    })

    jest.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(500)

    await deferredPromise$.promise
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('it should reject', async () => {
    const callback = jest.fn()
    const deferredPromise$ = new DeferredPromise()

    setTimeout(() => {
      deferredPromise$.reject(new Error('promise error'))
    }, 1000)

    deferredPromise$.promise.then(() => {
      callback()
    }).catch((err) => {
      expect(err).toEqual(new Error('promise error'))
    })

    jest.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
  })
})

module.exports = DeferredPromise
