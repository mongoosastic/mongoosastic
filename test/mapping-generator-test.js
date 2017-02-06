'use strict'

const mongoose = require('mongoose')
const should = require('should')
const Schema = mongoose.Schema
const Generator = require('../lib/mapping-generator')
const generator = new Generator()

describe('MappingGenerator', function () {
  describe('type mapping', function () {
    it('maps field with simple String type', function (done) {
      generator.generateMapping(new Schema({
        name: String
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('string')
        done()
      })
    })

    it('maps field with String type attribute', function (done) {
      generator.generateMapping(new Schema({
        name: {
          type: String
        }
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('string')
        done()
      })
    })

    it('converts Date type to date', function (done) {
      generator.generateMapping(new Schema({
        graduationDate: {
          type: Date,
          es_format: 'YYYY-MM-dd'
        }
      }), function (err, mapping) {
        mapping.properties.graduationDate.type.should.eql('date')
        done()
      })
    })

    it('removes _id field without prefix', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.should.not.have.property('_id')
        done()
      })
    })

    it('does not remove _id field with prefix', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.user.properties.should.have.property('_id')
        done()
      })
    })

    it('converts object id to string if not _id', function (done) {
      generator.generateMapping(new Schema({
        oid: {
          type: Schema.Types.ObjectId
        }
      }), function (err, mapping) {
        mapping.properties.oid.type.should.eql('string')
        done()
      })
    })

    it('does not modify the original schema tree', function (done) {
      const schema = new Schema({
        oid: Schema.ObjectId
      })

      generator.generateMapping(schema, function (err, mapping) {
        mapping.properties.oid.type.should.eql('string')
        should.not.exist(schema.tree.oid.type)
        done()
      })
    })

    it('recognizes an object and maps it as one', function (done) {
      generator.generateMapping(new Schema({
        contact: {
          email: {
            type: String
          },
          telephone: {
            type: String
          }
        }
      }), function (err, mapping) {
        mapping.properties.contact.properties.email.type.should.eql('string')
        mapping.properties.contact.properties.telephone.type.should.eql('string')
        done()
      })
    })

    it('recognizes an object and handles explict es_indexed', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('string')
        mapping.properties.contact.properties.email.type.should.eql('string')
        mapping.properties.contact.properties.tags.type.should.eql('string')
        mapping.properties.contact.properties.should.not.have.property('telephone')
        mapping.properties.contact.properties.should.not.have.property('keys')
        done()
      })
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
        keys: {type: [String], es_indexed: false},
        tags: {
          type: [String],
          es_indexed: true
        }
      })

      generator.generateMapping(new Schema({
        name: {
          type: String,
          es_indexed: true
        },
        contact: {
          type: ContactSchema,
          select: false
        }
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('string')
        mapping.properties.contact.properties.email.type.should.eql('string')
        mapping.properties.contact.properties.tags.type.should.eql('string')
        mapping.properties.contact.properties.should.not.have.property('telephone')
        mapping.properties.contact.properties.should.not.have.property('keys')
        done()
      })
    })

    it('recognizes an multi_field and maps it as one', function (done) {
      generator.generateMapping(new Schema({
        test: {
          type: String,
          es_include_in_all: false,
          es_type: 'multi_field',
          es_fields: {
            test: {
              type: 'string',
              index: 'analyzed'
            },
            untouched: {
              type: 'string',
              index: 'not_analyzed'
            }
          }
        }
      }), function (err, mapping) {
        mapping.properties.test.type.should.eql('multi_field')
        mapping.properties.test.fields.test.type.should.eql('string')
        mapping.properties.test.fields.test.index.should.eql('analyzed')
        mapping.properties.test.fields.untouched.type.should.eql('string')
        mapping.properties.test.fields.untouched.index.should.eql('not_analyzed')
        done()
      })
    })

    it('recognizes an geo_point and maps it as one', function (done) {
      generator.generateMapping(new Schema({
        geo: {
          type: String,
          es_type: 'geo_point'
        }
      }), function (err, mapping) {
        mapping.properties.geo.type.should.eql('geo_point')
        done()
      })
    })

    it('recognizes an geo_point with independent lat lon fields and maps it as one', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.geo_with_lat_lon.type.should.eql('geo_point')
        mapping.properties.geo_with_lat_lon.lat_lon.should.eql(true)
        done()
      })
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
      generator.generateMapping(new Schema({
        name: [NameSchema]
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('object')
        mapping.properties.name.properties.first_name.type.should.eql('string')
        mapping.properties.name.properties.last_name.type.should.eql('string')
        done()
      })
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
      generator.generateMapping(new Schema({
        name: {
          type: [NameSchema],
          es_indexed: true,
          es_type: 'nested',
          es_include_in_parent: true
        }
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('nested')
        mapping.properties.name.include_in_parent.should.eql(true)
        mapping.properties.name.properties.first_name.type.should.eql('string')
        mapping.properties.name.properties.first_name.index.should.eql('not_analyzed')
        mapping.properties.name.properties.last_name.type.should.eql('string')
        mapping.properties.name.properties.last_name.index.should.eql('not_analyzed')
        should.not.exist(mapping.properties.name.properties.es_include_in_parent)
        should.not.exist(mapping.properties.name.properties.es_type)
        done()
      })
    })

    it('recognizes a nested array with a simple type and maps it as a simple attribute', function (done) {
      generator.generateMapping(new Schema({
        contacts: [String]
      }), function (err, mapping) {
        mapping.properties.contacts.type.should.eql('string')
        done()
      })
    })

    it('recognizes a nested array with a simple type and additional attributes and maps it as a simple attribute', function (done) {
      generator.generateMapping(new Schema({
        contacts: [{
          type: String,
          es_index: 'not_analyzed'
        }]
      }), function (err, mapping) {
        mapping.properties.contacts.type.should.eql('string')
        mapping.properties.contacts.index.should.eql('not_analyzed')
        done()
      })
    })

    it('recognizes a nested array with a complex object and maps it', function (done) {
      generator.generateMapping(new Schema({
        name: String,
        contacts: [{
          email: {
            type: String,
            es_index: 'not_analyzed'
          },
          telephone: String
        }]
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('string')
        mapping.properties.contacts.properties.email.type.should.eql('string')
        mapping.properties.contacts.properties.email.index.should.eql('not_analyzed')
        mapping.properties.contacts.properties.telephone.type.should.eql('string')
        done()
      })
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

      generator.generateMapping(new Schema({
        name: [PersonSchema]
      }), function (err, mapping) {
        mapping.properties.name.properties.first_name.type.should.eql('string')
        mapping.properties.name.properties.last_name.type.should.eql('string')
        mapping.properties.name.properties.age.type.should.eql('double')
        should.not.exist(mapping.properties.name.properties.birthYear)
        done()
      })
    })
  })

  describe('elastic search fields', function () {
    it('type can be overridden', function (done) {
      generator.generateMapping(new Schema({
        name: {
          type: String,
          es_type: 'date'
        }
      }), function (err, mapping) {
        mapping.properties.name.type.should.eql('date')
        done()
      })
    })

    it('adds the boost field', function (done) {
      generator.generateMapping(new Schema({
        name: {
          type: String,
          es_boost: 2.2
        }
      }), function (err, mapping) {
        mapping.properties.name.boost.should.eql(2.2)
        done()
      })
    })

    it('respects schemas with explicit es_indexes', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.should.have.property('explicit_field_1')
        mapping.properties.should.have.property('explicit_field_2')
        mapping.properties.should.have.property('explicit_field_3')
        mapping.properties.should.not.have.property('implicit_field_1')
        mapping.properties.should.not.have.property('implicit_field_2')
        mapping.properties.should.not.have.property('implicit_field_3')
        done()
      })
    })

    it('make sure id is mapped', function (done) {
      generator.generateMapping(new Schema({
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
      }), function (err, mapping) {
        mapping.properties.should.have.property('id')
        mapping.properties.should.not.have.property('name')
        mapping.properties.should.not.have.property('_id')
        done()
      })
    })

    it('maps all fields when schema has no es_indexed flag', function (done) {
      generator.generateMapping(new Schema({
        implicit_field_1: {
          type: String
        },
        implicit_field_2: {
          type: Number
        }
      }), function (err, mapping) {
        mapping.properties.should.have.property('implicit_field_1')
        mapping.properties.should.have.property('implicit_field_2')
        done()
      })
    })
  })

  describe('ref mapping', function () {
    it('maps all fields from referenced schema', function (done) {
      const Name = new Schema({
        firstName: String,
        lastName: String
      })
      generator.generateMapping(new Schema({
        name: {type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name}
      }), function (err, mapping) {
        mapping.properties.name.properties.firstName.type.should.eql('string')
        mapping.properties.name.properties.lastName.type.should.eql('string')
        done()
      })
    })

    it('maps only selected fields from referenced schema', function (done) {
      const Name = new Schema({
        firstName: String,
        lastName: String
      })
      generator.generateMapping(new Schema({
        name: {type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name, es_select: 'firstName'}
      }), function (err, mapping) {
        mapping.properties.name.properties.firstName.type.should.eql('string')
        should.not.exist(mapping.properties.name.properties.lastName)
        done()
      })
    })

    it('maps all fields from array of referenced schema', function (done) {
      var Name = new Schema({
        firstName: String,
        lastName: String
      })
      generator.generateMapping(new Schema({
        name: {
          type: [{type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name}],
          es_type: 'object'
        }
      }), function (err, mapping) {
        mapping.properties.name.properties.firstName.type.should.eql('string')
        mapping.properties.name.properties.lastName.type.should.eql('string')
        done()
      })
    })

    it('maps only selected fields from array of referenced schema', function (done) {
      var Name = new Schema({
        firstName: String,
        lastName: String
      })
      generator.generateMapping(new Schema({
        name: {
          type: [{type: Schema.Types.ObjectId, ref: 'Name', es_schema: Name, es_select: 'firstName'}],
          es_type: 'object'
        }
      }), function (err, mapping) {
        mapping.properties.name.properties.firstName.type.should.eql('string')
        should.not.exist(mapping.properties.name.properties.lastName)
        done()
      })
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

            lat: {type: Number, default: 0},
            lon: {type: Number, default: 0}
          },
          es_type: 'geo_point'
        }
      })

      generator.generateMapping(new Schema({
        locations: {
          type: [{type: Schema.Types.ObjectId, ref: 'Location', es_schema: Location}],
          es_type: 'object'
        }
      }), function (err, mapping) {
        mapping.properties.locations.properties.coordinates.type.should.eql('geo_point')
        done()
      })
    })
  })
})
