var express = require('express')
  , MemoryStore = express.session.MemoryStore
  , store = new MemoryStore();

try {
  var keys = require('./keys');
} catch(e) {
}

module.exports = function(app){

  var automaticAPI = {
      automaticClientId: process.env.AUTOMATIC_CLIENT_ID || keys.automaticClientId
    , automaticClientSecret: process.env.AUTOMATIC_CLIENT_SECRET || keys.automaticClientSecret
    , automaticAuthorizeUrl: process.env.AUTOMATIC_AUTHORIZE_URL || keys.automaticAuthorizeUrl
    , automaticAuthTokenUrl: process.env.AUTOMATIC_AUTH_TOKEN_URL || keys.automaticAuthTokenUrl
    , automaticScopes: 'scope:trip:summary scope:location scope:vehicle scope:notification:hard_accel scope:notification:hard_brake scope:notification:speeding'
  }
  app.set('automaticAPI', automaticAPI);

  app.configure(function(){
    this
      .use(express.cookieParser('rXrq6xCSJu'))
      .use(express.bodyParser())
      .use(express.session({store: store, secret: '58675874ER1giugiuga'}))
      .enable('error templates')
      .use(express.static(__dirname + '/public'))
      .set('views', __dirname + '/views')
      .set('view engine', 'jade')
  });

  // Dev
  app.configure('development', function(){
    this
      .use(express.logger('\x1b[90m:remote-addr -\x1b[0m \x1b[33m:method\x1b[0m' +
         '\x1b[32m:url\x1b[0m :status \x1b[90m:response-time ms\x1b[0m'))
      .use(express.errorHandler({dumpExceptions: true, showStack: true}))
      .enable('dev')
      .set('domain', 'localhost');
  });

  // Prod
  app.configure('production', function(){
    this
      .use(express.logger({buffer: 10000}))
      .use(express.errorHandler())
      .enable('prod')
      .set('domain', 'tripviewer.herokuapp.com');

    app.all('*',function(req, res, next) {
      if(req.headers['x-forwarded-proto'] != 'https') {
        res.redirect('https://' + req.headers.host + req.path);
      } else {
        next();
      }
    });
  });
}
