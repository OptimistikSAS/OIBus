import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbCron from './OIbCron.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbCron', () => {
  test('check Cron with value="* * * /10"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="listen"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="listen"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="* * w1-5 /3"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * w1-5 /3"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
