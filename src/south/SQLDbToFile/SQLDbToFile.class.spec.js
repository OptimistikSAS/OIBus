const SQLDbToFile = require('./SQLDbToFile.class')

// Mock database service
jest.mock('../../services/database.service', () => {
})

// Mock nodejs fs api
jest.mock('fs')

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return { silly: () => jest.fn() }
}))

beforeEach(() => {
  jest.resetAllMocks()
})

describe('sql-db-to-file', () => {
  it('should format date properly', () => {
    const actual = SQLDbToFile.formatDateWithTimezone(
      new Date('2019-01-01 00:00:00Z'),
      'Europe/Paris',
      'YYYY-MM-DD HH:mm:ss',
    )
    const expected = '2019-01-01 00:00:00'
    expect(actual).toBe(expected)
  })
})
