/**
 * Module dependencies.
 */

var express = require('express'),
    app = module.exports = express.createServer(),
    stylus = require('stylus'),
    everyauth = require('everyauth'),
    login = require('./login'),
    cradle = require('cradle'),
    db = new(cradle.Connection)().database('husharu_db');

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('warn', true)
    .set('compress', true);
}

db.save('_design/comments', {
  views: {
    all: {
      map: function(doc) {
        if (doc.level && doc.level === 'comment') {
          emit(doc.level, doc);
        }   
      }
    }
  }
});

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'htuayreve'}));
  app.use(everyauth.middleware());
  app.use(app.router);

  app.use(stylus.middleware({
      src: __dirname + '/views' // .styl files are located in `views/stylesheets`
    , dest: __dirname + '/public' // .styl resources are compiled `/stylesheets/*.css`
    , compile: compile
  }));
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

function renderHome(renderer, comments) {
  renderer.render('index', {
    title: 'Welcome',
    locals: {
      comments: comments
    }
  });
}

// Routes

app.get('/', function(req, renderer){
  var comments = [];
  db.view('comments/all', function (err, res) {
    if (err) {
      console.log(err);
      return;
    }
    var end = res.length - 1, i = 0;
    res.forEach(function (row) {
      row.display_date = (new Date(row.created_at*1000)).toDateString();
      db.get(row.product_id, function(err1, doc) {
        row.product_name = doc.display_name;
        comments.push(row);
        if (i === end) {
          renderHome(renderer, comments);
        } else {
          i++;
        }
      });
    });
  });
});

app.get('/login', function(req, res){
  res.render('login', {
    title: 'Login'
  });
});

app.get('/comment', function(req, res){
  res.render('comment', {
    title: 'Comment page'
  });
});

everyauth.helpExpress(app);

app.listen(process.env['app_port'] || 3000);
console.info("Started on port %d", app.address().port);
