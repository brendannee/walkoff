var request = require('request'),
    async = require('async'),
    _ = require('underscore'),
    moment = require('moment');
    keen = require('keen.io');

module.exports = function routes(app){

  var automaticAPI = app.get('automaticAPI');
  var jawboneAPI = app.get('jawboneAPI');

  app.get('/', function(req, res) {
    // req.session.automatic_access_token = 'eec57d208a73151e13af127d656337f78b099141';
    // req.session.jawbone_access_token = 'Je5CDuGC9ORcrdAxf3gA43cL2pSXewR5GKNSPxdpEdkwDHRMyyO4-hex9ftlpMur8ooJl-U9fXdXW2MSxp0B_VECdgRlo_GULMgGZS0EumxrKbZFiOmnmAPChBPDZ5JP';
    if(req.session && req.session.automatic_access_token && req.session.jawbone_access_token) {
      res.render('app', {loggedIn: true});
    } else {
      res.render('index', {automatic_access_token: (req.session.automatic_access_token), jawbone_access_token: (req.session.jawbone_access_token)});
    }
  });


  app.get('/authorize-automatic/', function(req, res) {
      res.redirect(automaticAPI.automaticAuthorizeUrl + '?client_id=' + automaticAPI.automaticClientId + '&response_type=code&scope=' + automaticAPI.automaticScopes)
  });


  app.get('/authorize-jawbone/', function(req, res) {
      res.redirect(jawboneAPI.jawboneAuthorizeUrl + '?client_id=' + jawboneAPI.jawboneClientId + '&redirect_uri=' + encodeURIComponent('https://walkoff.herokuapp.com/redirect-jawbone/') + '&response_type=code&scope=basic_read move_read generic_event_write')
  });


  app.get('/logout/', function(req, res) {
    req.session.destroy();
    res.redirect('/');
  });


  app.get('/api/trips/', authenticate, function(req, res) {
    request.get({
      uri: 'https://api.automatic.com/v1/trips',
      qs: { page: req.query.page, per_page: req.query.per_page || 100 },
      headers: {Authorization: 'token ' + req.session.automatic_access_token}
    }, function(e, r, body) {
      try {
        res.json(JSON.parse(body));
      } catch(e) {
        console.log("error: " + e);
        res.json(400, {"message": "Invalid access_token"});
      }
    });
  });


  app.get('/api/moves/', authenticate, function(req, res) {
    request.get({
      uri: 'https://jawbone.com/nudge/api/users/@me/moves',
      qs: { start_time: ((Date.now()/1000) - 7*24*60*60).toFixed(0) },
      headers: {Authorization: 'Bearer ' + req.session.jawbone_access_token}
    }, function(e, r, body) {
      try {
        res.json(JSON.parse(body));
      } catch(e) {
        console.log("error: " + e);
        res.json(400, {"message": "Invalid access_token"});
      }
    });
  });


  app.get('/api/goals/', authenticate, function(req, res) {
    request.get({
      uri: 'https://jawbone.com/nudge/api/users/@me/goals',
      headers: {Authorization: 'Bearer ' + req.session.jawbone_access_token}
    }, function(e, r, body) {
      try {
        res.json(JSON.parse(body));
      } catch(e) {
        console.log("error: " + e);
        res.json(400, {"message": "Invalid access_token"});
      }
    });
  });


  app.get('/redirect-automatic/', function(req, res) {
    if(req.query.code) {
      request.post({
        uri: automaticAPI.automaticAuthTokenUrl,
        form: {
            client_id: automaticAPI.automaticClientId
          , client_secret: automaticAPI.automaticClientSecret
          , code: req.query.code
          , grant_type: 'authorization_code'
        }
      }, saveAuthToken)
    } else {
      res.json({error: 'No code provided'});
    }

    function saveAuthToken(e, r, body) {
      var access_token = JSON.parse(body || '{}')
      if (access_token.access_token) {
        req.session.automatic_access_token = access_token.access_token;
        req.session.automatic_scopes = access_token.scopes;
        res.redirect('/');
      } else {
        res.json({error: 'No access token'});
      }
    }
  });


  app.get('/redirect-jawbone/', function(req, res) {
    if(req.query.code) {
      request.post({
        uri: jawboneAPI.jawboneAuthTokenUrl,
        form: {
            client_id: jawboneAPI.jawboneClientId
          , client_secret: jawboneAPI.jawboneClientSecret
          , code: req.query.code
          , grant_type: 'authorization_code'
        }
      }, saveAuthToken)
    } else {
      res.json({error: 'No code provided'});
    }

    function saveAuthToken(e, r, body) {
      var access_token = JSON.parse(body || '{}')
      console.log(access_token.access_token);
      if (access_token.access_token) {
        req.session.jawbone_access_token = access_token.access_token;
        console.log(req.session.jawbone_access_token)
        res.redirect('/');
      } else {
        res.json({error: 'No access token'});
      }
    }
  });


  function authenticate(req, res, next) {
    if(!req.session || !req.session.automatic_access_token || !req.session.jawbone_access_token) {
      res.redirect('/');
    } else {
      next();
    }
  }

  /* From https://gist.github.com/niallo/3109252 */
  function parse_link_header(header) {
    var links = {};
    if (header) {
      var parts = header.split(',');
      parts.forEach(function(p) {
        var section = p.split(';');
        if (section.length != 2) {
          throw new Error("section could not be split on ';'");
        }
        var url = section[0].replace(/<(.*)>/, '$1').trim();
        var name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
      });
    }
    return links;
  }


  app.get('/webhook/', function(req, res) {
    console.log(req.body)
    // request.post({
    //   uri: 'https://jawbone.com/nudge/api/users/@me/generic_events',
    //   form: {title: 'Driving Trip', verb: 'drove', attributes: {"description": "Drive Event"}}
    //   headers: {Authorization: 'Bearer ' + req.session.jawbone_access_token}
    // }, function(e, r, body) {
    //   try {
    //     res.json(JSON.parse(body));
    //   } catch(e) {
    //     console.log("error: " + e);
    //     res.json(400, {"message": "Invalid access_token"});
    //   }
    // });
  });

}
