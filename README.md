# hoatzin
Type-safe object data modeling library for JSON files

This package is very simple, it lets you create a model which has specific keys and properties, with models that ensure that this model is enforced. It can also be combined with typescript, where a type can be passed to the model as a generic to ensure that all keys and their correct properties are added to the model.

Property types include:
- string
- string or null
- number
- number or null
- string or number
- boolean
- array
- object
- map (This type acts like a typescript Record - meaning an object, but instead of consistent keys with different properties it rather has any keys with all the same properties)

IMPORTANT NOTE: This package should not be used in favor of real databases - JSON is not a good file type for databases, as JSON files need to be read and written to in full, making it slow and prone to corruption once it is written to at a large rate. Only use this for tests, or small sets of data that are not frequently written to and not important if lost.

## Installing

To install this package, type `npm install hoatzin` into your console.

## Example usage

This example is in typescript, but you can easily remove the typescript parts and it will still work!
```ts
import { Model } from 'hoatzin' // in js, this would be const { Model } = require("hoatzin");

type PostSchema = {
  _id: string, // mandatory
  title: string,
  description: string | null,
  rating: number,
  hidden: boolean,
  interactions: Record<string, { // string is authorId
    interactionType: 'comment' | 'rating',
    body: string | number, // string if comment, number if rating
    
  }>,
  tags: Array<string>,
  pinnedPosition: number | null, // null if it is not pinned on the authors profile
};

const postSchema = new Model<PostSchema>(
	'./database/posts', // The path is always based on the root of your project. You can use the join method of nodes "path" module plus __dirname to create a file-relative path.
	{ 
      _id: { type: 'string', default: '', locked: true },
      title: { type: 'string', default: 'New Post', locked: false },
      description: { type: 'string?', default: null, locked: false },
      rating: { type: 'number', default: 0, locked: false },
      hidden: { type: 'boolean', default: false, locked: false },
      interactions: {
        type: 'map',
        of: {
          type: 'object',
          default: {
            interactionType: { type: 'string', default: 'comment', locked: false },
            body: { type: 'string|number', default: '', locked: false }
          },
        },
      },
      tags: {
        type: 'array',
        of: { type: 'string', default: '', locked: false },
      },
      pinnedPosition: { type: 'number?', default: null, locked: false },
    }, 
	{ createFile: true, deleteFile: true, changeFile: true }, // These are the log settings. They are optional and set to false by default. All properties of this object are optional too and will be set to false if left out. A boolean value can also be passed in place of the object, which sets all of these to the passed value
	true // This is about whether strict mode is enabled or not. It is optional and set to true by default. Strict mode checks whether the information passed the "create" and "findOneAndUpdate" functions alligns with the schema.
);

const post = postSchema.create({
  _id: '8e76460f-840b-42da-968e-ad66c076ff7c',
  title: 'Hoatzins are great!',
  description: 'We should really talk about how great hoatzins are!',
  rating: 5,
  hidden: true,
  interactions: {
    "5083c0e2-8cf7-4be3-ae1e-68b7147981f4": {
      interactionType: 'rating',
      body: 5
    }
  },
  tags: [],
  pinnedPosition: null,
})

console.log(post)
const updatedPost = postSchema.update(
  post,
  p => {
    p.tags.push('animals')
  },
  { log: false } // for Model#update, Model#findOneAndUpdate, Model#delete, Model#findOneAndDelete and Model#create, there is an optional "options" object with a log property. If it is set, it overrides the setting set when the model is created for the call
)

  console.log(updatedPost)
  const goodRatedPosts = postSchema.find(p => p.rating >= 4)
  console.log(goodRatedPosts)
  
  postSchema.delete(updatedPost)
  
  try {

    const nonExistentPost = postSchema.findOne(p => p.title.includes('Hoatzin')) // The post got deleted in the line above. It is asynchronous so it might not actually be deleted yet, but if it is, this will throw an error that needs to be caught
	console.log(nonExistentPost)
  }
  catch(error) {

	console.error(error)
  }
```