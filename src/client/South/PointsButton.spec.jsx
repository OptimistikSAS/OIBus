/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import testConfig from '../../../tests/testConfig'
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

const dataSource = testConfig.south.dataSources[0]
const emptyPointsDataSource = testConfig.south.dataSources[1]
const nullPointsDataSource = testConfig.south.dataSources[2]
emptyPointsDataSource.points = []
nullPointsDataSource.points = null

describe('PointsButton', () => {
  test('check PointsButton disabled', () => {
    dataSource.enabled = false
    act(() => {
      root.render(<PointsButton
        dataSource={dataSource}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check PointsButton enabled', () => {
    dataSource.enabled = true
    act(() => {
      root.render(<PointsButton
        dataSource={dataSource}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check points button click', () => {
    act(() => {
      root.render(<PointsButton
        dataSource={dataSource}
      />)
    })
    Simulate.click(document.querySelector('button.oi-points-button'))
    expect(mockNavigate).toBeCalledWith(`/south/${dataSource.id}/points`)
    expect(container).toMatchSnapshot()
  })
  test('check if points array is empty', () => {
    act(() => {
      root.render(<PointsButton
        dataSource={emptyPointsDataSource}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check no points', () => {
    act(() => {
      root.render(<PointsButton
        dataSource={nullPointsDataSource}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check if enabled with no points', () => {
    nullPointsDataSource.enabled = true
    act(() => {
      root.render(<PointsButton
        dataSource={nullPointsDataSource}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
