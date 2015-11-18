var gulp = require('gulp');
var concat = require('gulp-concat');

gulp.task('express', function() {
  var express = require('express');
  var app = express();
  app.use(require('connect-livereload')({port: 35729}));
  app.use(express.static(__dirname));
  app.listen(3000, '0.0.0.0');
});

gulp.task('scripts', function() {
  return gulp.src('js/*.js')
    .pipe(concat('meow.js'))
    .pipe(gulp.dest('public/javascripts'));
});

var tinylr;
gulp.task('livereload', function() {
  tinylr = require('tiny-lr')();
  tinylr.listen(35729);
});

function notifyLiveReload(event) {
  var fileName = require('path').relative(__dirname, event.path);

  tinylr.changed({
    body: {
      files: [fileName]
    }
  });
}

gulp.task('watch', function() {
  gulp.watch('js/*.js', ['scripts']);
  gulp.watch('./*.html', notifyLiveReload);
});

gulp.task('default', ['express', 'livereload', 'watch'], function() {

});