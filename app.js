require('./lib/login');

var express = require('express'),
    stylus = require('stylus'),
    everyauth = require('everyauth'),
    hex_md5 = require('./lib/md5').hex_md5,
    util = require('./lib/util'),
    db = require('./lib/couch').db;

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('warn', true)
    .set('compress', true);
}

var app = module.exports = express.createServer();
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'htuayreve'}));
  app.use(app.router);
  app.use(everyauth.middleware());

  app.use(stylus.middleware({
      src: __dirname + '/views' // .styl files are located in `views/stylesheets`
    , dest: __dirname + '/public' // .styl resources are compiled `/stylesheets/*.css`
    , compile: compile
  }));
  app.use(express.static(__dirname + '/public'));
  everyauth.helpExpress(app);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// TODO: move to a separate file

app.get('/', function(req, renderer, next){
  var comments = [],
      products = [];

  db.view('all/comments', function (err, res) {
    if (err) {
      console.log(err);
      return renderer.render('500.jade', {error: err, title: '500 Error'});
    }

    res.forEach(function (row) {
      row.display_date = util.prettyDate(+row.created_at);
      db.get(row.product_id, function(err, doc) {
        row.product_name = doc.display_name;
        row.gravatar = hex_md5(row.posted_by);
        comments.push(row);
      });
    });

    db.view('all/products', function (err, res) {
      res.forEach(function (row) {
        products.push(row);
      });
      renderHome(renderer, comments, products);
    });
  });
});

app.get('/oauth/error', function(req, res){
  res.render('oauth-error', {
    title: 'OAuth access denied'
  });
});

app.get('/login', function(req, res){
  res.render('login', {
    title: 'You need  to be logged in to perform actions on this site - login using your provider'
  });
});

app.get('/comment', function(req, renderer){
  if (!getUserEmail(req)) {
    req.session.redirectTo = '/comment';
    return renderer.redirect('/login');
  }

  var products = [];
  db.view('all/products', function (err, res) {
    if (err) {
      console.log(err);
      return renderer.render('500.jade', {error: err, title: '500 Error'});
    }
    res.forEach(function (row) {
      products.push(row);
    });
    renderer.render('comment', {
      title: 'Comment page',
      locals: {
        products: products 
      }
    });
  });
});

app.get('/comment/:id', function(req, renderer, next) {
  var id = req.params.id;
  db.get(id, function(err, doc) {
    if (err) {
      console.log(err);
      return renderer.render('500.jade', {error: err, title: '500 Error'});
    }
    doc.display_date = util.prettyDate(+doc.created_at);
    doc.gravatar = hex_md5(doc.posted_by);
		db.get(doc.product_id, function(err, product) {
			doc.product_name = product.display_name;
			renderer.render('comment_detail', {
				title: 'Comment page',
				locals: {
					comment: doc 
				}
			});
		});
  });
});

app.get('/product/:id', function(req, renderer, next) {
  var id = req.params.id;
  db.view('all/comments_for_product', {startkey: id, endkey: [id, {}]}, function(err, res) {
    if (err) {
      console.log(err);
      return renderer.render('500.jade', {error: err, title: '500 Error'});
    }
    var comments = [];
    res.forEach(function (row) {
      row.display_date = util.prettyDate(+row.created_at);
      comments.push(row);
    });

    db.get(id, function(err, doc) {
      if (err) {
        console.log(err);
        return renderer.render('500.jade', {error: err, title: '500 Error'});
      }
      renderer.render('product_detail', {
        title: 'Comments about ' + doc.display_name,
        locals: {
          comments: comments.reverse(), // note reverse - because we used push to put elements in
          product: doc
        }
      });
    });
  });
});

app.post('/comment/save', function(req, renderer) {
  if ( !req.body.product || !req.body.comment ) {
    throw new Error('Both product and comment are needed');
  }

  db.save({
    "level": "comment",
    "product_id": req.body.product,
    "created_at": (new Date()).getTime(),
    "posted_by": getUserEmail(req),
    "comment": req.body.comment
  }, function(err, res) {
    renderer.redirect('/', 301);
  });
});

function getUserEmail(req) {
  if (!req.session.auth) {
    return null;
  }

  if (req.session.auth.facebook) {
    return req.session.auth.facebook.user.email;
  } else if (req.session.auth.google) {
    return req.session.auth.google.user.id;
  }

  return null;
}

function renderHome(renderer, comments, products) {
  renderer.render('index', {
    title: 'Welcome',
    locals: {
      /* 
        note reverse - because we used push to add entries.
        I think I must have botched up performance big time with this
      */
      comments: comments.reverse(),
      products: products
    }
  });
}

app.listen(process.env['husharu_port'] || 3000);
console.info("Started on port %d", app.address().port);
