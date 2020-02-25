import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'

import newConfig from '../../../../tests/testConfig'
import SouthForm from './SouthForm.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

newConfig.south.dataSources.forEach((dataSource) => {
  describe('SouthForm', () => {
    test(`check SouthForm with dataSource: ${dataSource.dataSourceId}`, () => {
      act(() => {
        ReactDOM.render(
          <BrowserRouter>
            <SouthForm
              dataSource={dataSource}
              dataSourceIndex={0}
              onChange={() => (1)}
            />
          </BrowserRouter>, container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
})
