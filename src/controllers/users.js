function getUser(ctx) {
  const { query } = ctx.request
  const { user } = query

  ctx.ok({ user, query, comment: ' user was requested!' })
}

module.exports = { getUser }
