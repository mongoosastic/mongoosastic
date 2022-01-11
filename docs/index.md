# Getting started

Mongoosastic is a [mongoose](http://mongoosejs.com/) plugin that can automatically index your models into [elasticsearch](https://www.elastic.co/).

## Installation

The latest version of this package will be as close as possible to the latest `elasticsearch` and `mongoose` packages.

```bash
npm install -S mongoosastic
```

## Setup

Syntax:

``` javascript
Schema.plugin(mongoosastic, options)
```

### Options

Options are:

* `index` - the index in Elasticsearch to use. Defaults to the pluralization of the model name.
* `esClient` - an existing Elasticsearch `Client` instance.
* `clientOptions` - Connection configuration to pass to Elasticsearch client. you can find the possible options in the [client configuration](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html) page.
* `alwaysHydrate` - whether or not to lookup results in mongodb before
* `hydrateOptions` - options to pass into hydrate function
* `bulk` - size and delay options for bulk indexing
* `filter` - the function used for filtered indexing
* `transform` - the function used to transform serialized document before indexing
* `populate` - an Array of Mongoose populate options objects
* `indexAutomatically` - allows indexing after model save to be disabled for when you need finer control over when documents are indexed. Defaults to true
* `customProperties` - an object detailing additional properties which will be merged onto the type's default mapping when `createMapping` is called.
* `saveOnSynchronize` - triggers Mongoose save (and pre-save) method when synchronizing a collection/index. Defaults to true


To have a model indexed into Elasticsearch simply add the plugin.

=== "Javascript"

    ``` javascript
    const mongoose = require('mongoose')
    const mongoosastic = require('mongoosastic')
    const Schema = mongoose.Schema

    const UserSchema = new Schema({
        name: String,
        email: String,
        city: String
    })

    UserSchema.plugin(mongoosastic)
    ```

=== "Typescript"

    ```typescript
    import mongoose, { Schema, Document } from 'mongoose'
    import mongoosastic, { MongoosasticModel, MongoosasticDocument } from 'mongoosastic'

    interface IUser extends Document, MongoosasticDocument {
        name: string,
        email: string,
        city: string,
    }

    var UserSchema = new Schema({
        name: String,
        email: String,
        city: String
    })

    UserSchema.plugin(mongoosastic)

    const User = mongoose.model<IUser, MongoosasticModel<IUser>>('User', UserSchema)
    ```

This will by default simply use the pluralization of the model name as the index
while using the model name itself as the type. So if you create a new
User object and save it, you can see it by navigating to
`http://localhost:9200/users/_search` (this assumes Elasticsearch is
running locally on port 9200).

The default behavior is all fields get indexed into Elasticsearch. This can be a little wasteful especially considering that
the document is now just being duplicated between mongodb and
Elasticsearch so you should consider opting to index only certain fields by specifying `es_indexed` on the
fields you want to store:


```javascript
var UserSchema = new Schema({
    name: { type: String, es_indexed: true },
    email: String,
    city: String
})

UserSchema.plugin(mongoosastic)
```

In this case only the `name` field will be indexed for searching.

Now, by adding the plugin, the model will have a new method called
`search` which can be used to make simple to complex searches. The `search`
method accepts [standard Elasticsearch query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-queries.html)

```javascript
const results = await User.search({
  query_string: {
    query: "john"
  }
});
```

To connect to more than one host, you can use an array of hosts.

```javascript
MySchema.plugin(mongoosastic, {
  clientOptions: {
    nodes: [
      'localhost:9200',
      'anotherhost:9200'
    ]
  }
})
```

Also, you can re-use an existing Elasticsearch `Client` instance

```javascript
import { Client } from '@elastic/elasticsearch'

const esClient = new Client({ node: 'http://localhost:9200' })

MySchema.plugin(mongoosastic, {
  esClient: esClient
})
```