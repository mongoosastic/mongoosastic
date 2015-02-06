var mongoose = require('mongoose'),
	should = require('should'),
	config = require('./config'),
	Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId,
	async = require('async'),
	mongoosastic = require('../lib/mongoosastic');

var BookSchema = new Schema({
	title: String
});
BookSchema.plugin(mongoosastic.plugin(), {
	bulk: {
		size: 10,
		delay: 100
	}
});

var Book = mongoose.model('Book2', BookSchema);

describe('Bulk mode', function() {
	var books = null;

	before(function(done) {
		config.deleteIndexIfExists(['book2s'], function() {
			mongoose.connect(config.mongoUrl, function() {
				var client = mongoose.connections[0].db;
				client.collection('book2s', function(err, _books) {
					books = _books;
					Book.remove(done);
				});
			});
		});
	});
	before(function(done) {
		async.forEach(bookTitles(), function(title, cb) {
			new Book({
				title: title
			}).save(cb);
		}, done)
	});
	before(function(done) {
			Book.findOne({
				title: 'American Gods'
			}, function(err, book) {
				book.remove(done)
			});
		});
	it('should index all objects and support deletions too', function(done) {
    setTimeout(function() {
      Book.search({match_all: {}}, function(err, results) {
        results.should.have.property('hits').with.property('total', 52);
        done();
      });
    }, 8000)
	});
});

function bookTitles() {
	var books = [
		'American Gods',
		'Gods of the Old World',
		'American Gothic'
	];
	for (var i = 0; i < 50; i++) {
		books.push('ABABABA' + i);
	}
	return books;
}
