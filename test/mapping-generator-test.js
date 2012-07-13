var Generator = require('../lib/mapping-generator')
  , mongoose  = require('mongoose')
  , should    = require('should')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , generator = new Generator()

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
        graduationDate: {type:Date}
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
  });
});
