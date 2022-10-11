/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import PointsButton from './PointsButton.jsx'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => (
  { useNavigate: () => mockNavigate }
))

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

const south = {
  id: 'south-uuid-1',
  points: [
    { pointId: 'A13518/AI1/PV.CV', scanMode: 'everySecond' },
    { pointId: '_FC42404/PID1/OUT.CV', scanMode: 'everySecond' },
    { pointId: '_FC42404/PID1/PV.CV', scanMode: 'every10Second' },
  ],
}
const emptyPointsSouth = { id: 'south-uuid-1', points: [] }
const nullPointsSouth = { id: 'south-uuid-1', points: null }

describe('PointsButton', () => {
  test('check PointsButton disabled', () => {
    south.enabled = false
    act(() => {
      root.render(<PointsButton
        south={south}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check PointsButton enabled', () => {
    south.enabled = true
    act(() => {
      root.render(<PointsButton
        south={south}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check points button click', () => {
    act(() => {
      root.render(<PointsButton
        south={south}
      />)
    })
    Simulate.click(document.querySelector('button.oi-points-button'))
    expect(mockNavigate).toBeCalledWith(`/south/${south.id}/points`)
    expect(container).toMatchSnapshot()
  })
  test('check if points array is empty', () => {
    act(() => {
      root.render(<PointsButton
        south={emptyPointsSouth}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check no points', () => {
    act(() => {
      root.render(<PointsButton
        south={nullPointsSouth}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check if enabled with no points', () => {
    nullPointsSouth.enabled = true
    act(() => {
      root.render(<PointsButton
        south={nullPointsSouth}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
