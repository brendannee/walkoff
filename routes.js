var request = require('request'),
    async = require('async'),
    _ = require('underscore'),
    moment = require('moment'),
    keen = require('keen.io');

var keen = keen.configure({
  projectId: "52d0b36a05cd66792b00000b",
  writeKey: "531d7faa9ada8e0a0f2c345e50f682645b5f055d89a42c234bfacd0c116e3ac1c9fb499df00a2954a839d6c60052e9627a86764c811f1875a09cbc1217adf7e2dc575f6cc06050c9547c750bd51e89e0fe5af1d2ce659369cc7e97b460039aa3cc714f056c1c385b85c6428e827dd82f"
});


module.exports = function routes(app){

  var automaticAPI = app.get('automaticAPI');
  var jawboneAPI = app.get('jawboneAPI');
  var users = app.get('db').get('walkoffusers');

  app.get('/', function(req, res) {
    // req.session.automatic_access_token = 'eec57d208a73151e13af127d656337f78b099141';
    // req.session.jawbone_access_token = 'W3AjaI7_iOUXoGbe1HgAYvjzF5uVFZ0zYqU_fcvtdx5hlsAkEOtrlqyxdgjjWTWY4-yaOxh-sKlMWLqfgbkSwFECdgRlo_GULMgGZS0EumxrKbZFiOmnmAPChBPDZ5JP';
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
    keen.addEvent("automaticApiCall", {"trips": true});
  });


  app.get('/api/moves/', authenticate, function(req, res) {
    console.log(req.session.jawbone_access_token)
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
    keen.addEvent("upApiCall", {"moves": true});
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
        var automatic_id = access_token.user.id;
        users.update(
          {jawbone_access_token: req.session.jawbone_access_token},
          {$set: {automatic_access_token: access_token.access_token, automatic_id: automatic_id}},
          function(e, doc) {
            res.redirect('/');
          }
        );
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
      if (access_token.access_token) {
        req.session.jawbone_access_token = access_token.access_token;
        request.get({
          uri: 'https://jawbone.com/nudge/api/users/@me',
          headers: {Authorization: 'Bearer ' + req.session.jawbone_access_token}
        }, function(e, r, body) {
          try {
            var response = JSON.parse(body);
            var jawbone_id = response.data.xid;
            req.session.jawbone_id = jawbone_id;
            users.findOne({jawbone_id: jawbone_id}, function (e, doc) {
              if(!doc) {
                users.insert({jawbone_access_token: req.session.jawbone_access_token, jawbone_id: jawbone_id}, function(e, doc) {
                  res.redirect('/');
                });
              } else {
                if(doc.automatic_access_token) {
                  req.session.automatic_access_token = doc.automatic_access_token;
                }
                res.redirect('/');
              }
            });
          } catch(e) {
            console.log("error: " + e);
            res.json(400, {"message": "Invalid access_token"});
          }
        });
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


  app.post('/webhook/', function(req, res) {
    users.findOne({automatic_id: req.body.user.id}, function (e, doc) {
      if(doc) {
        var trip = req.body.trip;
        var distance_mi = (trip.distance_m / 1609).toFixed(1);
        var duration = ((trip.end_time - trip.start_time) / (60*60*1000)).toFixed();
        var title = 'Trip to ' + trip.start_location.name;
        var note = 'Drive from ' + trip.start_location.name + ' to ' + trip.end_location.name + '. It took ' + duration + ' minutes to drive ' + distance_mi + ' miles and cost $' + trip.fuel_cost_usd.toFixed(2) + ' in fuel.';
        var path = trip.start_location.lat + ',' + trip.start_location.lon + '|' + trip.end_location.lat + ',' + trip.end_location.lon;
        var markers = trip.start_location.lat + ',' + trip.start_location.lon + '|' + trip.end_location.lat + ',' + trip.end_location.lon;
        request.post({
          uri: 'https://jawbone.com/nudge/api/users/@me/generic_events',
          form: {
            title: title,
            verb: 'drove',
            note: note,
            image_url: 'http://maps.googleapis.com/maps/api/staticmap?scale=2&markers=' + markers + '&path=' +  path + '&size=600x600&sensor=false',
            place_lat: trip.end_location.lat,
            place_lon: trip.end_location.lon,
            time_created: Math.round(trip.end_time/1000)
          },
          headers: {Authorization: 'Bearer ' + doc.jawbone_access_token}
        }, function(e, r, body) {
          try {
            res.json(JSON.parse(body));
          } catch(e) {
            console.log("error: " + e);
            res.json(400, {"message": "Invalid access_token"});
          }
        });
      } else {
        res.json(400, {"message": "No Matching User"});
      }
    });

  });

}
