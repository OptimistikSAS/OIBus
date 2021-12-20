import React from 'react'
import PropTypes from 'prop-types'
import { ConfigProvider } from './ConfigContext.jsx'
import { HistoryConfigProvider } from './HistoryContext.jsx'

const ConfigProviders = ({ children }) => (
  <ConfigProvider>
    <HistoryConfigProvider>
      {children}
    </HistoryConfigProvider>
  </ConfigProvider>
)

ConfigProviders.propTypes = { children: PropTypes.element.isRequired }
export default ConfigProviders
