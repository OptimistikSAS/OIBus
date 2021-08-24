/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import PointsButton from './PointsButton.jsx'

const mockHistoryPush = jest.fn()
jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
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
      ReactDOM.render(
        <PointsButton
          dataSource={dataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check PointsButton enabled', () => {
    dataSource.enabled = true
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={dataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check points button click', () => {
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={dataSource}
        />, container,
      )
    })
    Simulate.click(document.querySelector('button.oi-points-button'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/south/${dataSource.id}/points` })
    expect(container).toMatchSnapshot()
  })
  test('check if points array is empty', () => {
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={emptyPointsDataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check no points', () => {
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={nullPointsDataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check if enabled with no points', () => {
    nullPointsDataSource.enabled = true
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={nullPointsDataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
