import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../../client/components/table/Table.jsx'
import { OIbTitle, OIbSelect, OIbScanMode } from '../../client/components/OIbForm'
import { ConfigContext } from '../../client/context/configContext.jsx'

const ScanGroups = ({ scanGroups, dataSourceIndex }) => {
  const { dispatchNewConfig, newConfig } = React.useContext(ConfigContext)
  const { scanModes } = newConfig.engine // scan modes defined in engine

  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${dataSourceIndex}.scanGroups.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = { scanMode: scanModes[0].scanMode, aggregate: 'Raw', resampling: 'None' }
    dispatchNewConfig({ type: 'addRow', name: `south.dataSources.${dataSourceIndex}.scanGroups`, value: defaultValue })
  }
  const onChange = (name, value) => {
    dispatchNewConfig({ type: 'update', name: `south.dataSources.${dataSourceIndex}.${name}`, value })
  }
  return (
    scanGroups && (
      <>
        <OIbTitle label="Scan Groups">
          <p>
            OPCHDA application will request all points in the same scanMode.
            OPCHDA can query raw values but can also aggregate points on a given period.
            if an aggregate is chosen, the resampling period must also be selected.
            <b>Important</b>
            a point with a scanMode without the corresponding scangroup will not be requested
          </p>
        </OIbTitle>
        <Row>
          <Col md={4}>
            <Table
              headers={['Scan Mode', 'Aggregate', 'Resampling']}
              rows={scanGroups.map((dataSource, i) => [
                {
                  name: `scanGroups.${i}.scanMode`,
                  value: (
                    <OIbScanMode
                      name={`scanGroups.${i}.scanMode`}
                      value={dataSource.scanMode}
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `scanGroups.${i}.aggregate`,
                  value: (
                    <OIbSelect
                      onChange={onChange}
                      options={['Raw', 'Average', 'Minimum', 'Maximum', 'Start', 'End']}
                      value={dataSource.aggregate}
                      defaultValue="Raw"
                      name={`scanGroups.${i}.aggregate`}
                    />
                  ),
                },
                {
                  name: `scanGroups.${i}.resampling`,
                  value: (
                    <OIbSelect
                      onChange={onChange}
                      options={['None', 'Minute', 'Hour', 'Day']}
                      value={dataSource.resampling}
                      defaultValue="None"
                      name={`scanGroups.${i}.resampling`}
                    />
                  ),
                },
              ])}
              handleDelete={handleDelete}
              handleAdd={handleAdd}
            />
          </Col>
        </Row>
      </>
    )
  )
}

ScanGroups.propTypes = { scanGroups: PropTypes.arrayOf(Object).isRequired }

ScanGroups.defaultProps = { scanGroups: [] }

export default ScanGroups
