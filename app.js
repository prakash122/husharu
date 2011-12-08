var express = require('express'),
    stylus = require('stylus'),
    everyauth = require('everyauth'),
    db = require('./couch').db,
    login = require('./login');

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

app.get('/', function(req, renderer){
  var comments = [];
  db.view('all/comments_products', function (err, res) {
    if (err) {
      next(new Error('Unable to find comments and products or something is wrong'));
    }
    var end = getCommentCount(res) - 1,
        i = 0,
        products = getProducts(res);

    res.forEach(function (row) {
      if (row.level === 'comment') {
        row.display_date = (new Date(row.created_at*1000)).toDateString();
        db.get(row.product_id, function(err, doc) {
          row.product_name = doc.display_name;
          comments.push(row);
          if (i === end) {
            renderHome(renderer, comments, products);
          } else {
            i++;
          }
        });
      }
    });
  });
});

app.get('/login', function(req, res){
  res.render('login', {
    title: 'Login using your provider'
  });
});

app.get('/comment', function(req, renderer){
  var products = [];
  db.view('products/all', function (err, res) {
    if (err) {
      throw new Error('Unable to retrieve products');
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
      return next(new Error('No such comment or something is wrong'));
    }
    renderer.render('comment_detail', {
      title: 'Comment page',
      locals: {
        comment: doc 
      }
    });
  });
});

app.get('/product/:id', function(req, renderer, next) {
  var id = req.params.id;
  db.view('all/comments_for_product', {key: id}, function(err, res) {
    if (err) {
      return next(new Error('No such product or something is wrong'));
    }
    var comments = [];
    res.forEach(function (row) {
      row.display_date = (new Date(row.created_at*1000)).toDateString();
      comments.push(row);
    });

    db.get(id, function(err, doc) {
      if (err) {
        return next(new Error('failed to get product details'));
      }
      renderer.render('product_detail', {
        title: 'Comments about ' + doc.display_name,
        locals: {
          comments: comments
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
    "posted_by": "",
    "comment": req.body.comment
  }, function(err, res) {
    renderer.redirect('/', 301);
  });
});

function renderHome(renderer, comments, products) {
  renderer.render('index', {
    title: 'Welcome',
    locals: {
      comments: comments,
      products: products 
    }
  });
}

function getCommentCount(res) {
  var i = 0;

  res.forEach(function (row) {
    if (row.level === 'comment') {
      i++;
    }
  });

  return i;
}

function getProducts(res) {
  var products = [];
  res.forEach(function (row) {
    if (row.level === 'product') {
      products.push(row);
    }
  });

  return products;
}

app.listen(process.env['app_port'] || 3000);
console.info("Started on port %d", app.address().port);
