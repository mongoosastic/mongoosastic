var elasticsearch = require('elasticsearch'),
  Generator = require('./mapping-generator'),
  generator = new Generator(),
  serialize = require('./serialize'),
  events = require('events'),
  util = require('util'),
  nop = function nop() {};

function isString(subject) {
  return typeof subject === 'string';
}

function isStringArray(arr) {
  return arr.filter && arr.length === (arr.filter(item => typeof item === 'string')).length;
}

function getMapping(schema) {
  var retMapping = {};
  generator.generateMapping(schema, (err, mapping) => {
    retMapping = mapping;
  });

  return retMapping;
}

function createEsClient(options) {

  var esOptions = {};

  if (util.isArray(options.hosts)) {
    esOptions.host = options.hosts;
  } else {
    esOptions.host = {
      host: options && options.host ? options.host : 'localhost',
      port: options && options.port ? options.port : 9200,
      protocol: options && options.protocol ? options.protocol : 'http',
      auth: options && options.auth ? options.auth : null,
      keepAlive: false
    };
  }

  esOptions.log = (options ? options.log : null);

  return new elasticsearch.Client(esOptions);
}

function createMappingIfNotPresent(options, cb) {
  var client = options.client,
    indexName = options.indexName,
    typeName = options.typeName,
    schema = options.schema,
    settings = options.settings,
    properties = options.properties;

  generator.generateMapping(schema, (ignoredErr, mapping) => {
    var completeMapping = {};
    completeMapping[typeName] = mapping;

    if (properties) {
      Object.keys(properties).map(key => {
        completeMapping[typeName].properties[key] = properties[key];
      });
    }

    client.indices.exists({
      index: indexName
    }, (err, exists) => {
      if (err) {
        return cb(err);
      }

      if (exists) {
        return client.indices.putMapping({
          index: indexName,
          type: typeName,
          body: completeMapping
        }, cb);

      }
      return client.indices.create({
        index: indexName,
        body: settings
      }, indexErr => {
        if (indexErr) {
          return cb(indexErr);
        }

        client.indices.putMapping({
          index: indexName,
          type: typeName,
          body: completeMapping
        }, cb);
      });
    });
  });
}

function hydrate(res, model, options, cb) {
  var results = res.hits,
    resultsMap = {},
    ids = results.hits.map((result, idx) => {
      resultsMap[result._id] = idx;
      return result._id;
    }),

    query = model.find({
      _id: {
        $in: ids
      }
    }),
    hydrateOptions = options.hydrateOptions;

  // Build Mongoose query based on hydrate options
  // Example: {lean: true, sort: '-name', select: 'address name'}
  Object.keys(hydrateOptions).forEach(option => {
    query[option](hydrateOptions[option]);
  });

  query.exec((err, docs) => {
    var hits = [];
    if (err) {
      return cb(err);
    }

    docs.forEach(doc => {
      var idx = resultsMap[doc._id];
      if (options.highlight) {
        doc._highlight = results.hits[idx].highlight;
      }

      hits[idx] = doc;
    });

    results.hits = hits;
    res.hits = results;
    cb(null, res);
  });
}

function deleteByMongoId(options, cb) {
  var index = options.index,
    type = options.type,
    client = options.client,
    model = options.model,
    tries = options.tries;

  client.delete({
    index: index,
    type: type,
    id: model._id.toString()
  }, (err, res) => {
    if (err && err.message.indexOf('404') > -1) {
      setTimeout(() => {
        if (tries <= 0) {
          return cb(err);
        }
        options.tries = --tries;
        deleteByMongoId(options, cb);
      }, 500);
    } else {
      model.emit('es-removed', err, res);
      cb(err);
    }
  });
}

function Mongoosastic(schema, pluginOpts) {
  var options = pluginOpts || {};

  var bulkTimeout, bulkBuffer = [], esClient,
    populate = options && options.populate,
    mapping = getMapping(schema),
    indexName = options && options.index,
    typeName = options && options.type,
    alwaysHydrate = options && options.hydrate,
    defaultHydrateOptions = options && options.hydrateOptions,
    bulk = options && options.bulk,
    filter = options && options.filter,
    transform = options && options.transform,
    customProperties = options && options.customProperties,
    indexAutomatically = !(options && options.indexAutomatically === false);

  if (options.esClient) {
    esClient = options.esClient;
  } else {
    esClient = createEsClient(options);
  }

  function setIndexNameIfUnset(model) {
    var modelName = model.toLowerCase();
    if (!indexName) {
      indexName = `${modelName}s`;
    }

    if (!typeName) {
      typeName = modelName;
    }
  }

  function clearBulkTimeout() {
    clearTimeout(bulkTimeout);
    bulkTimeout = undefined;
  }

  function bulkAdd(instruction) {
    bulkBuffer.push(instruction);

    // Return because we need the doc being indexed
    // Before we start inserting
    if (instruction.index && instruction.index._index) {
      return;
    }

    if (bulkBuffer.length >= ((bulk && bulk.size) || 1000)) {
      schema.statics.flush();
      clearBulkTimeout();
    } else if (bulkTimeout === undefined) {
      bulkTimeout = setTimeout(() => {
        schema.statics.flush();
        clearBulkTimeout();
      }, (bulk && bulk.delay) || 1000);
    }
  }

  function bulkDelete(opts, cb) {
    bulkAdd({
      delete: {
        _index: opts.index || indexName,
        _type: opts.type || typeName,
        _id: opts.model._id.toString()
      }
    });
    cb();
  }

  function bulkIndex(opts) {
    bulkAdd({
      index: {
        _index: opts.index || indexName,
        _type: opts.type || typeName,
        _id: opts._id.toString()
      }
    });
    bulkAdd(opts.model);
  }


  /**
   * ElasticSearch Client
   */
  schema.statics.esClient = esClient;

  /**
   * Create the mapping. Takes an optional settings parameter and a callback that will be called once
   * the mapping is created

   * @param settings Object (optional)
   * @param cb Function
   */
  schema.statics.createMapping = function createMapping(inSettings, inCb) {
    var cb = inCb,
      settings = inSettings;
    if (arguments.length < 2) {
      cb = inSettings || nop;
      settings = undefined;
    }

    setIndexNameIfUnset(this.modelName);

    createMappingIfNotPresent({
      client: esClient,
      indexName: indexName,
      typeName: typeName,
      schema: schema,
      settings: settings,
      properties: customProperties
    }, cb);
  };

  /**
   * @param options  Object (optional)
   * @param cb Function
   */
  schema.methods.index = function schemaIndex(inOpts, inCb) {
    var index, type, serialModel,
      cb = inCb,
      opts = inOpts;

    if (arguments.length < 2) {
      cb = inOpts || nop;
      options = {};
    }

    if (filter && filter(this)) {
      return this.unIndex(cb);
    }

    setIndexNameIfUnset(this.constructor.modelName);

    index = opts.index || indexName;
    type = opts.type || typeName;

    /**
     * Serialize the model, and apply transformation
     */
    serialModel = serialize(this, mapping);
    if (transform) serialModel = transform(serialModel, this);

    if (bulk) {
      bulkIndex({
        index: index,
        type: type,
        model: serialModel,
        _id: this._id
      });
      setImmediate(cb);
    } else {
      esClient.index({
        index: index,
        type: type,
        id: this._id.toString(),
        body: serialModel
      }, cb);
    }
  };

  /**
   * Unset elasticsearch index
   * @param options - (optional) options for unIndex
   * @param cb - callback when unIndex is complete
   */
  schema.methods.unIndex = function unIndex(inOpts, inCb) {
    var opts = inOpts,
      cb = inCb;

    if (arguments.length < 2) {
      cb = inOpts || nop;
      opts = {};
    }

    setIndexNameIfUnset(this.constructor.modelName);

    opts.index = opts.index || indexName;
    opts.type = opts.type || typeName;
    opts.model = this;
    opts.client = esClient;
    opts.tries = 3;

    if (bulk) {
      bulkDelete(opts, cb);
    } else {
      deleteByMongoId(opts, cb);
    }
  };

  /**
   * Delete all documents from a type/index
   * @param options - (optional) specify index/type
   * @param cb - callback when truncation is complete
   */
  schema.statics.esTruncate = function esTruncate(inOpts, inCb) {
    var opts = inOpts,
      cb = inCb,
      esQuery;

    if (arguments.length < 2) {
      cb = inOpts || nop;
      opts = {};
    }

    setIndexNameIfUnset(this.modelName);

    opts.index = opts.index || indexName;
    opts.type = opts.type || typeName;

    esQuery = {
      body: {
        query: {
          match_all: {}
        }
      },
      index: opts.index,
      type: opts.type
    };

    esClient.search(esQuery, (err, res) => {
      if (err) {
        return cb(err);
      }
      if (res.hits.total) {
        res.hits.hits.forEach(doc => {
          opts.model = doc;
          bulkDelete(opts, nop);
        });
      }
      cb();
    });
  };

  /**
   * Synchronize an existing collection
   *
   * @param query - query for documents you want to synchronize
   */
  schema.statics.synchronize = function synchronize(inQuery) {
    var em = new events.EventEmitter(),
      closeValues = [],
      counter = 0,
      stream,
      query = inQuery || {},
      close = function close() {
        em.emit.apply(em, ['close'].concat(closeValues));
      };

    // Set indexing to be bulk when synchronizing to make synchronizing faster
    // Set default values when not present
    bulk = bulk || {};
    bulk.delay = bulk.delay || 1000;
    bulk.size = bulk.size || 1000;
    bulk.batch = bulk.batch || 50;

    setIndexNameIfUnset(this.modelName);

    stream = this.find(query).batchSize(bulk.batch).stream();

    stream.on('data', doc => {
      stream.pause();
      counter++;

      function onIndex(indexErr, inDoc) {
        counter--;
        if (indexErr) {
          em.emit('error', indexErr);
        } else {
          em.emit('data', null, inDoc);
        }
        stream.resume();
      }

      doc.on('es-indexed', onIndex);
      doc.on('es-filtered', onIndex);

      doc.save(err => {
        if (err) {
          em.emit('error', err);
          return stream.resume();
        }
      });
    });

    stream.on('close', (pA, pB) => {
      var closeInterval;
      closeValues = [pA, pB];
      closeInterval = setInterval(() => {
        if (counter === 0 && bulkBuffer.length === 0) {
          clearInterval(closeInterval);
          close();
          bulk = false;
        }
      }, 1000);
    });

    stream.on('error', err => {
      em.emit('error', err);
    });

    return em;
  };

  /**
   * ElasticSearch search function
   *
   * @param query - query object to perform search with
   * @param options - (optional) special search options, such as hydrate
   * @param cb - callback called with search results
   */
  schema.statics.search = function search(inQuery, inOpts, inCb) {
    var _this = this,
      cb = inCb,
      opts = inOpts,
      esQuery,
      query = inQuery === null ? undefined : inQuery;

    if (arguments.length === 2) {
      cb = arguments[1];
      opts = {};
    }

    opts.hydrateOptions = opts.hydrateOptions || defaultHydrateOptions || {};

    setIndexNameIfUnset(this.modelName);

    esQuery = {
      body: {
        query: query
      },
      index: opts.index || indexName,
      type: opts.type || typeName
    };
    if (opts.highlight) {
      esQuery.body.highlight = opts.highlight;
    }

    if (opts.suggest) {
      esQuery.body.suggest = opts.suggest;
    }

    if (opts.aggs) {
      esQuery.body.aggs = opts.aggs;
    }

    Object.keys(opts).forEach(opt => {
      if (!opt.match(/(hydrate|sort)/) && opts.hasOwnProperty(opt)) {
        esQuery[opt] = opts[opt];
      }

      if (opts.sort) {
        if (isString(opts.sort) || isStringArray(opts.sort)) {
          esQuery.sort = opts.sort;
        } else {
          esQuery.body.sort = opts.sort;
        }

      }

    });

    esClient.search(esQuery, (err, res) => {
      if (err) {
        return cb(err);
      }

      if (alwaysHydrate || opts.hydrate) {
        hydrate(res, _this, opts, cb);
      } else {
        cb(null, res);
      }
    });
  };

  schema.statics.esCount = function esCount(inQuery, inCb) {
    var cb = inCb,
      query = inQuery,
      esQuery;

    setIndexNameIfUnset(this.modelName);

    if (!cb && typeof query === 'function') {
      cb = query;
      query = null;
    }

    esQuery = {
      body: {
        query: query
      },
      index: indexName,
      type: typeName
    };

    esClient.count(esQuery, cb);
  };


  schema.statics.flush = function flush(inCb) {
    var cb = inCb || nop;

    esClient.bulk({
      body: bulkBuffer
    }, cb);

    bulkBuffer = [];
  };

  schema.statics.refresh = function refresh(inOpts, inCb) {
    var cb = inCb,
      opts = inOpts;
    if (arguments.length < 2) {
      cb = inOpts || nop;
      opts = {};
    }

    setIndexNameIfUnset(this.modelName);
    esClient.indices.refresh({
      index: opts.index || indexName
    }, cb);
  };


  function postRemove(doc) {
    var opts = {
      index: indexName,
      type: typeName,
      tries: 3,
      model: doc,
      client: esClient
    };

    setIndexNameIfUnset(doc.constructor.modelName);

    if (bulk) {
      bulkDelete(opts, nop);
    } else {
      deleteByMongoId(opts, nop);
    }
  }

  function postSave(doc) {
    function onIndex(err, res) {
      if (!filter || !filter(doc)) {
        doc.emit('es-indexed', err, res);
      } else {
        doc.emit('es-filtered', err, res);
      }
    }

    if (doc) {
      if (populate && populate.length) {
        populate.forEach(populateOpts => {
          doc.populate(populateOpts);
        });
        doc.execPopulate().then(popDoc => {
          popDoc.index(onIndex);
        });
      } else {
        doc.index(onIndex);
      }
    }
  }

  /**
   * Use standard Mongoose Middleware hooks
   * to persist to Elasticsearch
   */
  function setUpMiddlewareHooks(inSchema) {
    /**
     * Remove in elasticsearch on remove
     */
    inSchema.post('remove', postRemove);
    inSchema.post('findOneAndRemove', postRemove);

    /**
     * Save in elasticsearch on save.
     */
    inSchema.post('save', postSave);
    inSchema.post('findOneAndUpdate', postSave);
  }

  if (indexAutomatically) {
    setUpMiddlewareHooks(schema);
  }

}

module.exports = Mongoosastic;
