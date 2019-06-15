
# LOOKING FOR MAINTAINERS

This project is looking for contributors/maintainers. Please check [issue #457](https://github.com/mongoosastic/mongoosastic/issues/457). If you, or anyone you know, work with Mongoose and/or ElasticSearch please let them know that we'd appreciate any help. Thanks!


# Mongoosastic
[![Build Status](https://travis-ci.org/mongoosastic/mongoosastic.svg?branch=master)](https://travis-ci.org/mongoosastic/mongoosastic)
[![NPM version](https://img.shields.io/npm/v/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)
[![Coverage Status](https://coveralls.io/repos/mongoosastic/mongoosastic/badge.svg?branch=master&service=github)](https://coveralls.io/github/mongoosastic/mongoosastic?branch=master)
[![Downloads](https://img.shields.io/npm/dm/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mongoosastic/mongoosastic?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Mongoosastic is a [mongoose](http://mongoosejs.com/) plugin that can automatically index your models into [elasticsearch](https://www.elastic.co/).


## Getting started

1. Install the package

```bash
npm install -S mongoosastic
```

2. Setup your mongoose model to use the plugin

```javascript
var mongoose     = require('mongoose')
  , mongoosastic = require('mongoosastic')
  , Schema       = mongoose.Schema

var User = new Schema({
    name: String
  , email: String
  , city: String
})

User.plugin(mongoosastic)
```

3. Query your Elasticserch with the `search()` method (added by the plugin)

```javascript
User.search({
  query_string: {
    query: "john"
  }
}, function(err, results) {
  // results here
});

```

*NOTE*: You can also query Elasticserch with any other method. Example: 

```bash
curl http://localhost:9200/users/user/_search
```

## Documentation

[View docs](docs/README.md)



