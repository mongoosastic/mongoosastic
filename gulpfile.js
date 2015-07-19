var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');

var SOURCE_FILES = ['*.js', './example/*.js', './lib/*.js', './test/**/*.js'];

gulp.task('lint', function() {
  return gulp.src(SOURCE_FILES)
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('jscs', function() {
  return gulp.src(SOURCE_FILES)
    .pipe(jscs());
});

gulp.task('mocha', function() {
  return gulp.src(['test/*-test.js'], { read: false })
    .pipe(mocha({
      reporter: 'spec',
      timeout: 600000,
      globals: {
        should: require('should')
      }
    }));
});

gulp.task('default', ['lint', 'jscs', 'mocha']);
