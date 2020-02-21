import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../../tests/testConfig'
import SubscribedTo from './SubscribedTo.jsx'

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
  describe('SubscribedTo', () => {
    test(`check SubscribedTo with application: ${application.applicationId}`, () => {
      act(() => {
        ReactDOM.render(
          <SubscribedTo
            subscribedTo={application.subscribedTo}
            applicationIndex={0}
          />, container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })
})
