import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import Generator from '../lib/mapping'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

const generator = new Generator()

interface ISchema extends MongoosasticDocument {
  string: string,
  mixed_field: unknown,
  mixed_arr_field: unknown,
  obj_mixed: {
    mixed: unknown
  },
}

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

schema.plugin(mongoosastic)

const MyModel = mongoose.model<ISchema, MongoosasticModel<ISchema>>('MyModel', schema)

describe('MappingGenerator', function () {

  describe('type mapping', function () {

    beforeAll(async function () {
      await config.deleteIndexIfExists(['mymodels'])
      await mongoose.connect(config.mongoUrl, config.mongoOpts)
      await MyModel.deleteMany()

      const doc = new MyModel({
        string: 'test_string',
        mixed_field: 'mixed',
        mixed_arr_field: [1, 2],
        obj_mixed: { mixed: 'nested mixed' }
      })

      await config.saveAndWaitIndex(doc)
    })

    afterAll(async function () {
      await MyModel.deleteMany()
      await config.deleteIndexIfExists(['mymodels'])
      await mongoose.disconnect()
    })

    it('maps field with simple text type', function (done) {
      const schema = new Schema({ name: String })
      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.name.type).toEqual('text')
      done()
    })

    it('maps field with text type attribute', function (done) {
      const schema = new Schema({
        name: {
          type: String
        }
      })
      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.name.type).toEqual('text')
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

      expect(mapping.properties.graduationDate.type).toEqual('date')
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

      expect(mapping.properties).not.toHaveProperty('_id')
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

      expect(mapping.properties.user.properties).toHaveProperty('_id')
      done()
    })

    it('converts object id to text if not _id', function (done) {
      const schema = new Schema({
        oid: {
          type: Schema.Types.ObjectId
        }
      })
      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.oid.type).toEqual('text')
      done()
    })

    it('does not modify the original schema tree', function (done) {
      const schema = new Schema({
        oid: Schema.Types.ObjectId
      })
      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.oid.type).toEqual('text')
      expect(schema['tree' as keyof Schema].oid.type).toBeUndefined()
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

      expect(mapping.properties.contact.properties.email.type).toEqual('text')
      expect(mapping.properties.contact.properties.telephone.type).toEqual('text')
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
          social: {
            messenger : String,
            instagram: String
          },
          keys: [String],
          tags: {
            type: [String],
            es_indexed: true
          }
        }
      })
      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.name.type).toEqual('text')
      expect(mapping.properties.contact.properties.email.type).toEqual('text')
      expect(mapping.properties.contact.properties.tags.type).toEqual('text')
      expect(mapping.properties.contact.properties).not.toHaveProperty('telephone')
      expect(mapping.properties.contact.properties).not.toHaveProperty('keys')
      expect(mapping.properties.contact.properties).not.toHaveProperty('social')
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

      expect(mapping.properties.name.type).toEqual('text')
      expect(mapping.properties.contact.properties.email.type).toEqual('text')
      expect(mapping.properties.contact.properties.tags.type).toEqual('text')
      expect(mapping.properties.contact.properties).not.toHaveProperty('telephone')
      expect(mapping.properties.contact.properties).not.toHaveProperty('keys')
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

      expect(mapping.properties.test.type).toEqual('multi_field')
      expect(mapping.properties.test.fields.test.type).toEqual('text')
      expect(mapping.properties.test.fields.test.index).toEqual('analyzed')
      expect(mapping.properties.test.fields.untouched.type).toEqual('text')
      expect(mapping.properties.test.fields.untouched.index).toEqual('not_analyzed')
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

      expect(mapping.properties.geo.type).toEqual('geo_point')
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

      expect(mapping.properties.geo_with_lat_lon.type).toEqual('geo_point')
      expect(mapping.properties.geo_with_lat_lon.lat_lon).toEqual(true)
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

      expect(mapping.properties.name.type).toEqual('object')
      expect(mapping.properties.name.properties.first_name.type).toEqual('text')
      expect(mapping.properties.name.properties.last_name.type).toEqual('text')
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

      expect(mapping.properties.name.type).toEqual('nested')
      expect(mapping.properties.name.include_in_parent).toEqual(true)
      expect(mapping.properties.name.properties.first_name.type).toEqual('text')
      expect(mapping.properties.name.properties.first_name.index).toEqual('not_analyzed')
      expect(mapping.properties.name.properties.last_name.type).toEqual('text')
      expect(mapping.properties.name.properties.last_name.index).toEqual('not_analyzed')
      expect(mapping.properties.name.properties.es_include_in_parent).toBeUndefined()
      expect(mapping.properties.name.properties.es_type).toBeUndefined()
      done()
    })

    it('recognizes a nested array with a simple type and maps it as a simple attribute', function (done) {
      const schema = new Schema({
        contacts: [String]
      })

      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.contacts.type).toEqual('text')
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

      expect(mapping.properties.contacts.type).toEqual('text')
      expect(mapping.properties.contacts.index).toEqual('not_analyzed')
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

      expect(mapping.properties.name.type).toEqual('text')
      expect(mapping.properties.contacts.properties.email.type).toEqual('text')
      expect(mapping.properties.contacts.properties.email.index).toEqual('not_analyzed')
      expect(mapping.properties.contacts.properties.telephone.type).toEqual('text')
      done()
    })

    it('excludes a virtual property from mapping', function (done) {
      interface IPerson {
        first_name: string,
        last_name: string,
        age: number,
      }

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

      PersonSchema.virtual('birthYear').set(function (this: IPerson, year: number) {
        this.age = new Date().getFullYear() - year
      })

      const schema = new Schema({
        name: [PersonSchema]
      })

      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.name.properties.first_name.type).toEqual('text')
      expect(mapping.properties.name.properties.last_name.type).toEqual('text')
      expect(mapping.properties.name.properties.age.type).toEqual('long')
      expect(mapping.properties.name.properties.birthYear).toBeUndefined()
      done()
    })

    it('should not map type mixed on mixed fields', async function () {

      await MyModel.createMapping()

      await config.sleep(config.INDEXING_TIMEOUT)

      const res = await MyModel.search({
        query_string: { query: 'mixed' }
      })

      const source = res?.body.hits.hits[0]._source

      expect(source?.mixed_field).toEqual('mixed')
      expect(source?.mixed_arr_field).toEqual([1, 2])
      expect(source?.obj_mixed.mixed).toEqual('nested mixed')
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

      expect(mapping.properties.name.type).toEqual('date')
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

      expect(mapping.properties.name.boost).toEqual(2.2)
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

      expect(mapping.properties).toHaveProperty('explicit_field_1')
      expect(mapping.properties).toHaveProperty('explicit_field_2')
      expect(mapping.properties).toHaveProperty('explicit_field_3')
      expect(mapping.properties).not.toHaveProperty('implicit_field_1')
      expect(mapping.properties).not.toHaveProperty('implicit_field_2')
      expect(mapping.properties).not.toHaveProperty('implicit_field_3')
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

      expect(mapping.properties).toHaveProperty('id')
      expect(mapping.properties).not.toHaveProperty('name')
      expect(mapping.properties).not.toHaveProperty('_id')
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

      expect(mapping.properties).toHaveProperty('implicit_field_1')
      expect(mapping.properties).toHaveProperty('implicit_field_2')
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

      expect(mapping.properties.name.properties.firstName.type).toEqual('text')
      expect(mapping.properties.name.properties.lastName.type).toEqual('text')
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

      expect(mapping.properties.name.properties.firstName.type).toEqual('text')
      expect(mapping.properties.name.properties.lastName).toBeUndefined()
      done()
    })

    it('maps all fields from array of referenced schema', function (done) {
      const Name = new Schema({
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

      expect(mapping.properties.name.properties.firstName.type).toEqual('text')
      expect(mapping.properties.name.properties.lastName.type).toEqual('text')
      done()
    })

    it('maps only selected fields from array of referenced schema', function (done) {
      const Name = new Schema({
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

      expect(mapping.properties.name.properties.firstName.type).toEqual('text')
      expect(mapping.properties.name.properties.lastName).toBeUndefined()
      done()
    })

    it('maps a geo_point field of an nested referenced schema as a geo_point', function (done) {
      const Location = new Schema({
        name: String,
        coordinates: {
          geo_point: {
            type: String,
            es_type: 'geo_point',
            es_lat_lon: true
          },
          lat: { type: Number, default: 0 },
          lon: { type: Number, default: 0 },
        }
      })

      const schema = new Schema({
        locations: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Location', es_schema: Location }],
          es_type: 'object'
        }
      })

      const mapping = generator.generateMapping(schema)

      expect(mapping.properties.locations.properties.coordinates.type).toEqual('geo_point')
      done()
    })

    describe('generator caching', function () {
      it('generaterd mappings should not be cached', function (done) {
        const schema = new Schema({
          name: {
            type: String,
            es_type: 'date'
          }
        })

        const mapping_a = generator.generateMapping(schema)
        const mapping_b = generator.generateMapping(schema)

        expect(mapping_a === mapping_b).toEqual(false)
        done()
      })

      it('generaterd mappings should be cached', function (done) {
        const schema = new Schema({
          name: {
            type: String,
            es_type: 'date'
          }
        })

        const mapping_a = generator.generateMapping(schema, true)
        const mapping_b = generator.generateMapping(schema, true)

        expect(mapping_a === mapping_b).toEqual(true)
        done()
      })
    })
  })
})
