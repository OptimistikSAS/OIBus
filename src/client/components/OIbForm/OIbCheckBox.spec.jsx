import React from 'react'
import Enzyme, { shallow } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

import OIbCheckBox from './OIbCheckBox.jsx'

Enzyme.configure({ adapter: new Adapter() })

describe('OIbCheckBox', () => {
  test('check CheckBox with value(=true)', () => {
    const wrapper = shallow(
      <OIbCheckBox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
  test('check CheckBox with value(=true) and switch mode', () => {
    const wrapper = shallow(
      <OIbCheckBox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
        switchButton
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
  test('check CheckBox with value(=false)', () => {
    const wrapper = shallow(
      <OIbCheckBox
        label="label"
        value={false}
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />,
    )
    expect(wrapper.html()).toMatchSnapshot()
  })
})
