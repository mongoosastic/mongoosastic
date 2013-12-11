var Generator = require('../lib/mapping-generator')
  , mongoose  = require('mongoose')
  , should    = require('should')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , generator = new Generator();

describe('MappingGenerator', function(){

  describe('type mapping', function(){
    it('maps field with simple String type', function(done){
      generator.generateMapping(new Schema({
        name: String
      }), function(err, mapping){
        mapping.properties.name.type.should.eql('string');
        done();
      });
    });

    it('maps field with String type attribute', function(done){
      generator.generateMapping(new Schema({
        name: {type:String}
      }), function(err, mapping){
        mapping.properties.name.type.should.eql('string');
        done();
      });
    });
    it('converts Date type to date', function(done){
      generator.generateMapping(new Schema({
        graduationDate: {type:Date, es_format: 'YYYY-MM-dd'}
      }), function(err, mapping){
        mapping.properties.graduationDate.type.should.eql('date');
        done();
      });
    });
    it('removes _id field', function(done){
      generator.generateMapping(new Schema({
        _id: {type:Schema.Types.ObjectId}
      }), function(err, mapping){
        mapping.properties.should.not.have.property('_id');
        done();
      });
    });
    it('converts object id to string if not _id', function(done){
      generator.generateMapping(new Schema({
        oid: {type:Schema.Types.ObjectId}
      }), function(err, mapping){
        mapping.properties.oid.type.should.eql('string');
        done();
      });
    });
    it('recognizes an object and maps it as one', function(done){
      generator.generateMapping(new Schema({
        contact: {
            email: {type: String},
            telephone: {type: String}
        }
      }), function(err, mapping){
        mapping.properties.contact.properties.email.type.should.eql('string');
        mapping.properties.contact.properties.telephone.type.should.eql('string');
        done();
      });
    });
    it('recognizes an object and handles explict es_indexed', function(done){
      generator.generateMapping(new Schema({
        name: {type: String, es_indexed: true},
        contact: {
            email: {type: String, es_indexed: true},
            telephone: {type: String}
        }
      }), function(err, mapping){
        mapping.properties.name.type.should.eql('string');
        mapping.properties.contact.properties.email.type.should.eql('string');
        mapping.properties.contact.properties.should.not.have.property('telephone');
        done();
      });
    });
    it('recognizes an multi_field and maps it as one', function(done){
      generator.generateMapping(new Schema({
        test: {
          type: String,
          es_include_in_all: false,
          es_type: 'multi_field',
          es_fields: {
            test: { type: 'string', index: 'analyzed' },
            untouched: { type: 'string', index: 'not_analyzed' }
          }
        }
      }), function(err, mapping){
        mapping.properties.test.type.should.eql('multi_field');
        mapping.properties.test.fields.test.type.should.eql('string');
        mapping.properties.test.fields.test.index.should.eql('analyzed');
        mapping.properties.test.fields.untouched.type.should.eql('string');
        mapping.properties.test.fields.untouched.index.should.eql('not_analyzed');
        done();
      });
    });
    it('recognizes an geo_point and maps it as one', function(done){
      generator.generateMapping(new Schema({
        geo: {
          type: String,
          es_type: 'geo_point'
        }
      }), function(err, mapping){
        mapping.properties.geo.type.should.eql('geo_point');
        done();
      });
    });
    it('recognizes an geo_point with independent lat lon fields and maps it as one', function(done){
      generator.generateMapping(new Schema({
        geo_with_lat_lon: {
          geo_point: {
            type: String,
            es_type: 'geo_point',
            es_lat_lon: true
          },
          lat: { type: Number },
          lon: { type: Number }
        }
      }), function(err, mapping){
        mapping.properties.geo_with_lat_lon.type.should.eql('geo_point');
        mapping.properties.geo_with_lat_lon.lat_lon.should.eql(true);
        done();
      });
    });
    it('recognizes an nested schema and maps it', function(done){
      var NameSchema = new Schema({
        first_name: {type: String},
        last_name: {type: String}
      });
      generator.generateMapping(new Schema({
        name: [NameSchema]
      }), function(err, mapping){
        mapping.properties.name.type.should.eql('object');
        mapping.properties.name.properties.first_name.type.should.eql('string');
        mapping.properties.name.properties.last_name.type.should.eql('string');
        done();
      });
    });
    it('excludes a virtual property from mapping', function(done){
      var PersonSchema = new Schema({
        first_name: {type: String},
        last_name: {type: String},
        age: {type: Number}
      });

      PersonSchema.virtual('birthYear').set(function (year) {
        this.age = new Date().getFullYear() - year;
      })

      generator.generateMapping(new Schema({
        name: [PersonSchema]
      }), function(err, mapping){
        mapping.properties.name.properties.first_name.type.should.eql('string');
        mapping.properties.name.properties.last_name.type.should.eql('string');
        mapping.properties.name.properties.age.type.should.eql('double');
        should.not.exist(mapping.properties.name.properties.birthYear);
        done();
      });
    });
  });

  describe('elastic search fields', function(){
    it('type can be overridden', function(done){
      generator.generateMapping(new Schema({
        name: {type:String, es_type:'date'}
      }), function(err, mapping){
        mapping.properties.name.type.should.eql('date');
        done();
      });
    });
    it('adds the boost field', function(done){
      generator.generateMapping(new Schema({
        name: {type:String, es_boost:2.2}
      }), function(err, mapping){
        mapping.properties.name.boost.should.eql(2.2);
        done();
      });
    });
    it('respects schemas with explicit es_indexes', function(done){
      generator.generateMapping(new Schema({
        implicit_field_1: {type: String},
        explicit_field_1: {type: Number, es_indexed: true},
        implicit_field_2: {type: Number},
        explicit_field_2: {type: String, es_indexed: true}
      }), function(err, mapping){
        mapping.properties.should.have.property('explicit_field_1');
        mapping.properties.should.have.property('explicit_field_2');
        mapping.properties.should.not.have.property('implicit_field_1');
        mapping.properties.should.not.have.property('implicit_field_2');
        done();
      });
    });
    it('maps all fields when schema has no es_indexed flag', function(done) {
      generator.generateMapping(new Schema({
        implicit_field_1: {type: String},
        implicit_field_2: {type: Number},
      }), function(err, mapping){
        mapping.properties.should.have.property('implicit_field_1');
        mapping.properties.should.have.property('implicit_field_2');
        done();
      });
    });
  });
});
