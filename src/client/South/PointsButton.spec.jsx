import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import PointsButton from './PointsButton.jsx'

jest.mock('react-router-dom', () => (
  { useHistory: jest.fn().mockReturnValue([]) }
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

describe('PointsButton', () => {
  test('check PointsButton', () => {
    act(() => {
      ReactDOM.render(
        <PointsButton
          dataSource={dataSource}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
