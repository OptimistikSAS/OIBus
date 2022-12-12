import React from 'react'
import PropTypes from 'prop-types'
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap'

const TablePagination = ({ maxToDisplay, selected, total, onPagePressed }) => {
  const distance = Math.floor(maxToDisplay / 2)
  let from = selected - distance > 1 ? selected - distance : 1
  let to = selected + distance < total ? selected + distance : total
  if (to < maxToDisplay && total > to) {
    to = total < maxToDisplay ? total : maxToDisplay
  }
  if (from - to < maxToDisplay && from !== 1) {
    const newFrom = to - maxToDisplay + 1
    from = newFrom
  }

  const createItems = () => {
    const items = []
    for (let i = from; i <= to; i += 1) {
      items.push(
        <PaginationItem key={i} active={i === selected}>
          <PaginationLink className="pagination-cell" onClick={() => onPagePressed(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>,
      )
    }
    return items
  }

  return (
    <Pagination>
      <PaginationItem>
        <PaginationLink className="pagination-cell" first onClick={() => onPagePressed(1)} />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink className="pagination-cell" previous onClick={() => onPagePressed(selected - 1 >= 1 ? selected - 1 : 1)} />
      </PaginationItem>
      {createItems()}
      <PaginationItem>
        <PaginationLink className="pagination-cell" next onClick={() => onPagePressed(selected + 1 <= total ? selected + 1 : total)} />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink className="pagination-cell" last onClick={() => onPagePressed(total)} />
      </PaginationItem>
    </Pagination>
  )
}

TablePagination.propTypes = {
  maxToDisplay: PropTypes.number.isRequired,
  selected: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onPagePressed: PropTypes.func.isRequired,
}

export default TablePagination
