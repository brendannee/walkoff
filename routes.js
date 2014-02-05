var request = require('request'),
    async = require('async'),
    _ = require('underscore'),
    moment = require('moment');

module.exports = function routes(app){

  var automaticAPI = app.get('automaticAPI')
    , jawboneAPI = app.get('jawboneAPI')
    , users = app.get('db').get('walkoffusers')
    , keen = app.get('db').get('keen')

  app.get('/', function(req, res) {
    // req.session.automatic_access_token = 'eec57d208a73151e13af127d656337f78b099141';
    // req.session.jawbone_access_token = 'W3AjaI7_iOUXoGbe1HgAYvjzF5uVFZ0zYqU_fcvtdx5hlsAkEOtrlmkjMe-1ZFvM4-yaOxh-sKlMWLqfgbkSwFECdgRlo_GULMgGZS0EumxrKbZFiOmnmAPChBPDZ5JP';
    if(req.session.jawbone_redirect_url) {
      res.redirect(req.session.jawbone_redirect_url);
    } else if(req.session && req.session.automatic_access_token && req.session.jawbone_access_token) {
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
      qs: { page: req.query.page, per_page: 140 },
      headers: {Authorization: 'token ' + req.session.automatic_access_token}
    }, function(e, r, body) {
      try {
        var seven_days_ago = Date.now() - 7*24*60*60*1000
          , trips = _.filter(JSON.parse(body), function(trip) {
            return trip.end_time > seven_days_ago;
          });
        res.json(trips);
      } catch(e) {
        console.log("error: " + e);
        res.json(400, {"message": "Invalid access_token"});
      }
    });
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
            users.findAndModify({jawbone_id: jawbone_id}, {$set: {jawbone_access_token: req.session.jawbone_access_token, jawbone_id: jawbone_id}}, {upsert: true}, function (e, doc) {
              if(doc.automatic_access_token) {
                req.session.automatic_access_token = doc.automatic_access_token;
              }
              res.redirect('/');
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
    console.log('>>>>>>> Incoming Webhook: ' + JSON.stringify(req.body));
    if(req.body.type == 'trip:finished') {
      users.findOne({automatic_id: req.body.user.id}, function (e, doc) {
        if(doc) {
          var trip = req.body.trip || {};
          var distance_mi = (trip.distance_m || 0) / 1609;
          var end_time = trip.end_time || (new Date).getTime();
          var start_time = trip.start_time || (new Date).getTime();
          var minutes = ((end_time - start_time) / (60*1000));
          var stepsPerMile = 2100;
          var missedSteps = (distance_mi * 2100) || 0;
          var dailyGoal = 10000;
          var title = distance_mi.toFixed(1) + ' mi instead of walking ' + numberWithCommas(missedSteps.toFixed(0)) + ' steps';
          var percentOfDailyGoal = ((missedSteps / dailyGoal) * 100).toFixed(0) + '%';
          var fuel_cost = trip.fuel_cost_usd || 0;
          var start_location = (trip.start_location) ? trip.start_location.name : '';
          var end_location = (trip.end_location) ? trip.end_location.name : '';
          var end_lat = (trip.end_location) ? trip.end_location.lat : 0;
          var end_lon = (trip.end_location) ? trip.end_location.lon : 0;
          var note = 'Your drive from ' + start_location + ' to ' + end_location + '. It took ' + numberWithCommas(minutes.toFixed(0)) + ' minutes to drive ' + distance_mi.toFixed(1) + ' miles and cost $' + fuel_cost.toFixed(2) + ' in fuel.  Had you walked for this trip, it would have been ' + missedSteps.toFixed(0) + ' additional steps accounting for ' + percentOfDailyGoal + ' of your daily goal.';

          request.post({
            uri: 'https://jawbone.com/nudge/api/users/@me/generic_events',
            form: {
              title: title,
              verb: 'drove',
              note: note,
              image_url: getStaticMap(trip),
              place_lat: end_lat,
              place_lon: end_lon,
              time_created: Math.round(start_time/1000)
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
    } else {
      res.json({"message": "Thanks"});
    }
  });


  function getStaticMap(trip) {
    var start_lat = (trip.start_location) ? trip.start_location.lat : 0;
    var start_lon = (trip.start_location) ? trip.start_location.lon : 0;
    var end_lat = (trip.end_location) ? trip.end_location.lat : 0;
    var end_lon = (trip.end_location) ? trip.end_location.lon : 0;
    var path = 'color:0x08b1d5dd|weight:9|enc:' + trip.path;
    var start_marker = 'label:S|' + start_lat + ',' + start_lon;
    var end_marker = 'label:E|' + end_lat + ',' + end_lon;
    return 'http://maps.googleapis.com/maps/api/staticmap?scale=2&markers=' + start_marker + '&markers=' + end_marker + '&path=' +  path + '&size=600x600&sensor=false';
  }


  app.get('/authorize/', function(req, res) {
    req.session.jawbone_redirect_url = req.query.redirect_url;
    res.redirect('/authorize-jawbone/');
  });


  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

}
