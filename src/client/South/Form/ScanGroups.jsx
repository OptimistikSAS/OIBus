import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../../components/table/Table.jsx'
import { OIbText, OIbTitle, OIbScanMode } from '../../components/OIbForm'
import { ConfigContext } from '../../context/configContext.jsx'

const ScanGroups = ({ scanGroups, dataSourceIndex }) => {
  const { dispatchNewConfig } = React.useContext(ConfigContext)
  const handleDelete = (rowIndex) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${dataSourceIndex}.scanGroups.${rowIndex}` })
  }
  const handleAdd = () => {
    const defaultValue = { scanMode: '', aggregate: '', resampling: '' }
    dispatchNewConfig({ type: 'addRow', name: `south.dataSources.${dataSourceIndex}.scanGroups`, value: defaultValue })
  }
  const onChange = (name, value) => {
    dispatchNewConfig({ type: 'update', name: `south.dataSources.${dataSourceIndex}.${name}`, value })
  }
  return (
    scanGroups && (
      <>
        <OIbTitle title="Scan Groups">
          <p> </p>
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
                      option={dataSource.scanMode}
                      onChange={onChange}
                    />
                  ),
                },
                {
                  name: `scanGroups.${i}.aggregate`,
                  value: (
                    <OIbText
                      onChange={onChange}
                      value={dataSource.aggregate}
                      name={`scanGroups.${i}.aggregate`}
                    />
                  ),
                },
                {
                  name: `scanGroups.${i}.resampling`,
                  value: (
                    <OIbText
                      onChange={onChange}
                      value={dataSource.resampling}
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
