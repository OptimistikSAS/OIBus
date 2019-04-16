/**
 * Get North schema list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorthSchemaList = (ctx) => {
  ctx.ok(ctx.app.engine.getNorthSchemaList())
}

/**
 * Get North schema.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getNorthSchema = (ctx) => {
  const schema = ctx.app.engine.getNorthSchema(ctx.params.api)
  if (schema) {
    ctx.ok(schema)
  } else {
    ctx.throw(404)
  }
}

/**
 * Get South schema list.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getSouthSchemaList = (ctx) => {
  ctx.ok(ctx.app.engine.getSouthSchemaList())
}

/**
 * Get South schema.
 * @param {Object} ctx - The KOA context
 * @return {void}
 */
const getSouthSchema = (ctx) => {
  const schema = ctx.app.engine.getSouthSchema(ctx.params.protocol)
  if (schema) {
    ctx.ok(schema)
  } else {
    ctx.throw(404)
  }
}

module.exports = {
  getNorthSchemaList,
  getNorthSchema,
  getSouthSchemaList,
  getSouthSchema,
}
