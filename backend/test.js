const Joi = require('joi')

const schema = Joi.object({
  bool: Joi.boolean().required().falsy(0).truthy(1),
})
const data = { bool: 1 }

const { error } = schema.validate(data)
console.log(error)
