import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'

import newConfig from '../../../../tests/testConfig'
import NorthForm from './NorthForm.jsx'

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

newConfig.north.applications.forEach((application) => {
  describe('NorthForm', () => {
    test(`check NorthForm with application: ${application.applicationId}`, () => {
      act(() => {
        ReactDOM.render(
          <BrowserRouter>
            <NorthForm
              application={application}
              applicationIndex={0}
              onChange={() => (1)}
            />
          </BrowserRouter>, container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
})
