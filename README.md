# hoatzin

Type-safe object data modeling library for JSON files

This package is very simple, it lets you create a model which has specific keys and properties, with models that ensure that this model is enforced. It can also be combined with typescript, where a type can be passed to the model as a generic to ensure that all keys and their correct properties are added to the model.

Property types include:
- string
- string or null
- number
- number or null
- string or null
- boolean
- array
- object
- map (This type acts like a typescript Record - meaning an object, but instead of consistent keys with different properties it rather has any keys with all the same properties)

IMPORTANT NOTE: This package should not be used in favor of real databases - JSON is not a good file type for databases, as JSON files need to be read and written to in full, making it slow and prone to corruption once it is written to at a large rate. Only use this for tests, or small sets of data that are not frequently written to and not important if lost.

