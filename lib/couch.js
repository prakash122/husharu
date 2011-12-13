var cradle = require('cradle'),
    db_user = process.env['husharu_db_user'] || 'admin',
    db_pass = process.env['husharu_db_pass'] || 'admin',
    db_host = process.env['husharu_db_host'] || '127.0.0.1',
    db_port = process.env['husharu_db_port'] || 5984,
    db = new(cradle.Connection)(db_host, db_port, {
      auth: { username: db_user, password: db_pass }
    }).database('husharu_db');

exports.db = db;

db.save('_design/all', {
  views: {
    comments_for_product: {
      map: function(doc) {
        if (doc.level && doc.level === 'comment') {
          emit([doc.product_id, doc.created_at], doc);
        }
      }
    }
    , categories: {
      map: function(doc) {
        if (doc.level && doc.level === 'category') {
          emit([doc.product_id, doc.display_name], doc);
        }   
      }
    }
    , comments: {
      map: function(doc) {
        if (doc.level && doc.level === 'comment') {
          emit([doc.level, +doc.created_at], doc);
        }   
      }
    }
    , products: {
      map: function(doc) {
        if (doc.level && doc.level === 'product') {
          emit([doc.level, doc.display_name], doc);
        }   
      }
    }
    , users: {
      map: function(doc) {
        if (doc.level && doc.level === 'user') {
          emit([doc.level, doc.email], doc)
        }
      }
    }
    , userByEmail: {
      map: function(doc) {
        if (doc.level && doc.level === 'user') {
          emit(doc.email, doc)
        }
      }
    }
  }
});
