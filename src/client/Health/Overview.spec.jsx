import React from 'react'
import Enzyme, { shallow } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

// need BrowserRouter so Link component is not complaining
import { BrowserRouter } from 'react-router-dom'

import Overview from './Overview.jsx'

import newConfig from '../../../tests/testConfig.js'

Enzyme.configure({ adapter: new Adapter() })

React.useContext = jest.fn().mockReturnValue({ newConfig })

describe('Overview', () => {
  test('display overview based on config', () => {
    const wrapper = shallow(<BrowserRouter><Overview /></BrowserRouter>)
    expect(wrapper.html()).toMatchSnapshot()
  })
})
