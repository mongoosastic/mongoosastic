'use strict'

const mongoose = require('mongoose')
const should = require('should')
const Schema = mongoose.Schema
const Generator = require('../lib/mapping-generator')
const generator = new Generator()

describe('MappingGenerator', function () {
  describe('type mapping', function () {
    it('maps field with simple text type', function (done) {
      const schema = new Schema({ name: String })
      const mapping = generator.generateMapping(schema)
      mapping.properties.name.type.should.eql('text')
      done()
    })

    it('maps field with text type attribute', function (done) {
      const schema = new Schema({
        name: {
          type: String
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.name.type.should.eql('text')
      done()
    })

    it('converts Date type to date', function (done) {
      const schema = new Schema({
        graduationDate: {
          type: Date,
          es_format: 'YYYY-MM-dd'
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.graduationDate.type.should.eql('date')
      done()
    })

    it('removes _id field without prefix', function (done) {
      const schema = new Schema({
        _id: {
          type: Schema.Types.ObjectId
        },
        user: {
          _id: {
            type: Schema.Types.ObjectId
          },
          name: {
            type: String
          }
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.should.not.have.property('_id')
      done()
    })

    it('does not remove _id field with prefix', function (done) {
      const schema = new Schema({
        _id: {
          type: Schema.Types.ObjectId
        },
        user: {
          _id: {
            type: Schema.Types.ObjectId
          },
          name: {
            type: String
          }
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.user.properties.should.have.property('_id')
      done()
    })

    it('converts object id to text if not _id', function (done) {
      const schema = new Schema({
        oid: {
          type: Schema.Types.ObjectId
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.oid.type.should.eql('text')
      done()
    })

    it('does not modify the original schema tree', function (done) {
      const schema = new Schema({
        oid: Schema.ObjectId
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.oid.type.should.eql('text')
      should.not.exist(schema.tree.oid.type)
      done()
    })

    it('recognizes an object and maps it as one', function (done) {
      const schema = new Schema({
        contact: {
          email: {
            type: String
          },
          telephone: {
            type: String
          }
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.contact.properties.email.type.should.eql('text')
      mapping.properties.contact.properties.telephone.type.should.eql('text')
      done()
    })

    it('recognizes an object and handles explict es_indexed', function (done) {
      const schema = new Schema({
        name: {
          type: String,
          es_indexed: true
        },
        contact: {
          email: {
            type: String,
            es_indexed: true
          },
          telephone: {
            type: String
          },
          keys: [String],
          tags: {
            type: [String],
            es_indexed: true
          }
        }
      })
      const mapping = generator.generateMapping(schema)
      mapping.properties.name.type.should.eql('text')
      mapping.properties.contact.properties.email.type.should.eql('text')
      mapping.properties.contact.properties.tags.type.should.eql('text')
      mapping.properties.contact.properties.should.not.have.property('telephone')
      mapping.properties.contact.properties.should.not.have.property('keys')
      done()
    })

    it('recognizes a nested schema and handles explict es_indexed', function (done) {
      const ContactSchema = new Schema({
        email: {
          type: String,
          es_indexed: true
        },
        telephone: {
          type: String
        },
        keys: { type: [String], es_indexed: false },
        tags: {
          type: [String],
          es_indexed: true
        }
      })

      const schema = new Schema({
        name: {
          type: String,
          es_indexed: true
        },
        contact: {
          type: ContactSchema,
          select: false
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.type.should.eql('text')
      mapping.properties.contact.properties.email.type.should.eql('text')
      mapping.properties.contact.properties.tags.type.should.eql('text')
      mapping.properties.contact.properties.should.not.have.property('telephone')
      mapping.properties.contact.properties.should.not.have.property('keys')
      done()
    })

    it('recognizes an multi_field and maps it as one', function (done) {
      const schema = new Schema({
        test: {
          type: String,
          es_include_in_all: false,
          es_type: 'multi_field',
          es_fields: {
            test: {
              type: 'text',
              index: 'analyzed'
            },
            untouched: {
              type: 'text',
              index: 'not_analyzed'
            }
          }
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.test.type.should.eql('multi_field')
      mapping.properties.test.fields.test.type.should.eql('text')
      mapping.properties.test.fields.test.index.should.eql('analyzed')
      mapping.properties.test.fields.untouched.type.should.eql('text')
      mapping.properties.test.fields.untouched.index.should.eql('not_analyzed')
      done()
    })

    it('recognizes an geo_point and maps it as one', function (done) {
      const schema = new Schema({
        geo: {
          type: String,
          es_type: 'geo_point'
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.geo.type.should.eql('geo_point')
      done()
    })

    it('recognizes an geo_point with independent lat lon fields and maps it as one', function (done) {
      const schema = new Schema({
        geo_with_lat_lon: {
          geo_point: {
            type: String,
            es_type: 'geo_point',
            es_lat_lon: true
          },
          lat: {
            type: Number
          },
          lon: {
            type: Number
          }
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.geo_with_lat_lon.type.should.eql('geo_point')
      mapping.properties.geo_with_lat_lon.lat_lon.should.eql(true)
      done()
    })

    it('recognizes an nested schema and maps it', function (done) {
      const NameSchema = new Schema({
        first_name: {
          type: String
        },
        last_name: {
          type: String
        }
      })

      const schema = new Schema({ name: [NameSchema] })
      const mapping = generator.generateMapping(schema)

      mapping.properties.name.type.should.eql('object')
      mapping.properties.name.properties.first_name.type.should.eql('text')
      mapping.properties.name.properties.last_name.type.should.eql('text')
      done()
    })

    it('recognizes an es_type of nested with es_fields and maps it', function (done) {
      const NameSchema = new Schema({
        first_name: {
          type: String,
          es_index: 'not_analyzed'
        },
        last_name: {
          type: String,
          es_index: 'not_analyzed'
        }
      })

      const schema = new Schema({
        name: {
          type: [NameSchema],
          es_indexed: true,
          es_type: 'nested',
          es_include_in_parent: true
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.type.should.eql('nested')
      mapping.properties.name.include_in_parent.should.eql(true)
      mapping.properties.name.properties.first_name.type.should.eql('text')
      mapping.properties.name.properties.first_name.index.should.eql('not_analyzed')
      mapping.properties.name.properties.last_name.type.should.eql('text')
      mapping.properties.name.properties.last_name.index.should.eql('not_analyzed')
      should.not.exist(mapping.properties.name.properties.es_include_in_parent)
      should.not.exist(mapping.properties.name.properties.es_type)
      done()
    })

    it('recognizes a nested array with a simple type and maps it as a simple attribute', function (done) {
      const schema = new Schema({
        contacts: [String]
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.contacts.type.should.eql('text')
      done()
    })

    it('recognizes a nested array with a simple type and additional attributes and maps it as a simple attribute', function (done) {
      const schema = new Schema({
        contacts: [{
          type: String,
          es_index: 'not_analyzed'
        }]
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.contacts.type.should.eql('text')
      mapping.properties.contacts.index.should.eql('not_analyzed')
      done()
    })

    it('recognizes a nested array with a complex object and maps it', function (done) {
      const schema = new Schema({
        name: String,
        contacts: [{
          email: {
            type: String,
            es_index: 'not_analyzed'
          },
          telephone: String
        }]
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.type.should.eql('text')
      mapping.properties.contacts.properties.email.type.should.eql('text')
      mapping.properties.contacts.properties.email.index.should.eql('not_analyzed')
      mapping.properties.contacts.properties.telephone.type.should.eql('text')
      done()
    })

    it('excludes a virtual property from mapping', function (done) {
      const PersonSchema = new Schema({
        first_name: {
          type: String
        },
        last_name: {
          type: String
        },
        age: {
          type: Number
        }
      })

      PersonSchema.virtual('birthYear').set(function (year) {
        this.age = new Date().getFullYear() - year
      })

      const schema = new Schema({
        name: [PersonSchema]
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.properties.first_name.type.should.eql('text')
      mapping.properties.name.properties.last_name.type.should.eql('text')
      mapping.properties.name.properties.age.type.should.eql('long')
      should.not.exist(mapping.properties.name.properties.birthYear)
      done()
    })

    // make this cleaner
    it('should not map type mixed on mixed fields', function (done) {
      // instead, Elastic should "guess" and set default mapping
      const schema = new Schema({
        string: String,
        mixed_field: {
          type: mongoose.Schema.Types.Mixed
        },
        mixed_arr_field: {
          type: [mongoose.Schema.Types.Mixed]
        },
        obj_mixed: {
          mixed: {
            type: mongoose.Schema.Types.Mixed
          }
        }
      })
      const mongoosastic = require('../lib/mongoosastic')
      schema.plugin(mongoosastic)

      const MyModel = mongoose.model('MyModel', schema)

      MyModel.createMapping((err, mapping) => {
        if (err) console.log(err)
        const doc = new MyModel({
          string: 'test_string',
          mixed_field: 'mixed',
          mixed_arr_field: [1, 2],
          obj_mixed: { mixed: 'nested mixed' }
        })
        const config = require('./config')
        mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
          doc.save(() => {
            setTimeout(() => {
              MyModel.search({ query_string: { query: 'mixed' } }, (err, res) => {
                res.hits.hits[0]._source.mixed_field.should.eql('mixed')
                res.hits.hits[0]._source.mixed_arr_field.should.eql([1, 2])
                res.hits.hits[0]._source.obj_mixed.mixed.should.eql('nested mixed')
                doc.remove(() => {
                  config.deleteIndexIfExists('mymodels', done)
                })
              })
            }, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  describe('elastic search fields', function () {
    it('type can be overridden', function (done) {
      const schema = new Schema({
        name: {
          type: String,
          es_type: 'date'
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.type.should.eql('date')
      done()
    })

    it('adds the boost field', function (done) {
      const schema = new Schema({
        name: {
          type: String,
          es_boost: 2.2
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.boost.should.eql(2.2)
      done()
    })

    it('respects schemas with explicit es_indexes', function (done) {
      const schema = new Schema({
        implicit_field_1: {
          type: String
        },
        explicit_field_1: {
          type: Number,
          es_indexed: true
        },
        implicit_field_2: {
          type: Number
        },
        explicit_field_2: {
          type: String,
          es_indexed: true
        },
        implicit_field_3: {
          type: [Number]
        },
        explicit_field_3: {
          type: [Number],
          es_indexed: true
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.should.have.property('explicit_field_1')
      mapping.properties.should.have.property('explicit_field_2')
      mapping.properties.should.have.property('explicit_field_3')
      mapping.properties.should.not.have.property('implicit_field_1')
      mapping.properties.should.not.have.property('implicit_field_2')
      mapping.properties.should.not.have.property('implicit_field_3')
      done()
    })

    it('make sure id is mapped', function (done) {
      const schema = new Schema({
        name: {
          type: String
        },
        id: {
          type: String,
          es_indexed: true
        },
        _id: {
          type: String,
          es_indexed: true
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.should.have.property('id')
      mapping.properties.should.not.have.property('name')
      mapping.properties.should.not.have.property('_id')
      done()
    })

    it('maps all fields when schema has no es_indexed flag', function (done) {
      const schema = new Schema({
        implicit_field_1: {
          type: String
        },
        implicit_field_2: {
          type: Number
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.should.have.property('implicit_field_1')
      mapping.properties.should.have.property('implicit_field_2')
      done()
    })
  })

  describe('ref mapping', function () {
    it('maps all fields from referenced schema', function (done) {
      const Name = new Schema({
        firstName: String,
        lastName: String
      })

      const schema = new Schema({
        name: { type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.properties.firstName.type.should.eql('text')
      mapping.properties.name.properties.lastName.type.should.eql('text')
      done()
    })

    it('maps only selected fields from referenced schema', function (done) {
      const Name = new Schema({
        firstName: String,
        lastName: String
      })

      const schema = new Schema({
        name: { type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name, es_select: 'firstName' }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.properties.firstName.type.should.eql('text')
      should.not.exist(mapping.properties.name.properties.lastName)
      done()
    })

    it('maps all fields from array of referenced schema', function (done) {
      var Name = new Schema({
        firstName: String,
        lastName: String
      })

      const schema = new Schema({
        name: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name }],
          es_type: 'object'
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.properties.firstName.type.should.eql('text')
      mapping.properties.name.properties.lastName.type.should.eql('text')
      done()
    })

    it('maps only selected fields from array of referenced schema', function (done) {
      var Name = new Schema({
        firstName: String,
        lastName: String
      })

      const schema = new Schema({
        name: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name, es_select: 'firstName' }],
          es_type: 'object'
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.name.properties.firstName.type.should.eql('text')
      should.not.exist(mapping.properties.name.properties.lastName)
      done()
    })

    it('maps a geo_point field of an nested referenced schema as a geo_point', function (done) {
      var Location = new Schema({
        name: String,
        coordinates: {
          type: {
            geo_point: {
              type: String,
              es_type: 'geo_point',
              es_lat_lon: true
            },

            lat: { type: Number, default: 0 },
            lon: { type: Number, default: 0 }
          },
          es_type: 'geo_point'
        }
      })

      const schema = new Schema({
        locations: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Location', es_schema: Location }],
          es_type: 'object'
        }
      })

      const mapping = generator.generateMapping(schema)

      mapping.properties.locations.properties.coordinates.type.should.eql('geo_point')
      done()
    })
  })
})
