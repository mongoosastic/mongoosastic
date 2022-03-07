# Mongoosastic
![CI workflow](https://github.com/mongoosastic/mongoosastic/actions/workflows/ci.yml/badge.svg)
[![NPM version](https://img.shields.io/npm/v/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)
[![Coverage Status](https://coveralls.io/repos/mongoosastic/mongoosastic/badge.svg?branch=master&service=github)](https://coveralls.io/github/mongoosastic/mongoosastic?branch=master)
[![Downloads](https://img.shields.io/npm/dm/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)

Mongoosastic is a [mongoose](http://mongoosejs.com/) plugin that can automatically index your models into [elasticsearch](https://www.elastic.co/).


## Getting started

1. Install the package

```bash
npm install mongoosastic
```

2. Setup your mongoose model to use the plugin

```javascript
const mongoose     = require('mongoose')
const mongoosastic = require('mongoosastic')
const Schema       = mongoose.Schema

var User = new Schema({
    name: String,
    email: String,
    city: String
})

User.plugin(mongoosastic)
```

3. Query your Elasticsearch with the `search()` method (added by the plugin)

```javascript
const results = await User.search({
  query_string: {
    query: "john"
  }
});
```

*NOTE*: You can also query Elasticsearch with any other method. Example: 

```bash
curl http://localhost:9200/users/user/_search
```

## Documentation

[View docs](https://mongoosastic.github.io/mongoosastic/)



