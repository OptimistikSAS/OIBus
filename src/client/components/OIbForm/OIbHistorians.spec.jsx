import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbHistorians from './OIbHistorians.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})
const lastCompletedAt = {
  name: 'OPCUA-HA',
  lastCompletedAt: {
    every10Seconds: 1615379954419,
    every1Min: 1615379954419,
  },
}

describe('OIbInteger', () => {
  test('check OIbInteger with value="a text"', () => {
    act(() => {
      ReactDOM.render(<OIbHistorians
        lastCompletedAt={lastCompletedAt}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
