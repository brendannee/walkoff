var moves
  , goals
  , trips
  , stats = {}
  , requestCount = 0;

var Keen=Keen||{configure:function(e){this._cf=e},addEvent:function(e,t,n,i){this._eq=this._eq||[],this._eq.push([e,t,n,i])},setGlobalProperties:function(e){this._gp=e},onChartsReady:function(e){this._ocrq=this._ocrq||[],this._ocrq.push(e)}};(function(){var e=document.createElement("script");e.type="text/javascript",e.async=!0,e.src=("https:"==document.location.protocol?"https://":"http://")+"dc8na2hxrj29i.cloudfront.net/code/keen-2.1.0-min.js";var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t)})();

Keen.configure({
  projectId: "52d0b36a05cd66792b00000b",
  writeKey: "531d7faa9ada8e0a0f2c345e50f682645b5f055d89a42c234bfacd0c116e3ac1c9fb499df00a2954a839d6c60052e9627a86764c811f1875a09cbc1217adf7e2dc575f6cc06050c9547c750bd51e89e0fe5af1d2ce659369cc7e97b460039aa3cc714f056c1c385b85c6428e827dd82f"
});

fetchData();

function fetchData() {
  showLoading(requestCount);
  fetchMoves();
  fetchGoals();
  fetchTrips();
};

function fetchComplete() {
  requestCount += 1;
  showLoading(requestCount);
  if(requestCount == 3) {
    processStats();
  }
}


function fetchMoves() {
  $.getJSON('/api/moves/', {})
    .done(function(data) {
      if(data && data.data && data.data.items && data.data.items.length) {
        moves = data.data.items;
      } else {
        console.log('No moves found');
        moves = [];
      }
    })
    .fail(function(jqhxr, textStatus, error) {
      console.log('Unable to fetch moves (' + jqhxr.status + ' ' + error + ')');
    })
    .always(fetchComplete);
}


function fetchGoals() {
  $.getJSON('/api/goals/', {})
    .done(function(data) {
      if(data && data.data) {
        goals = data.data
      } else {
        console.log('No goals found');
        goals = {};
      }
    })
    .fail(function(jqhxr, textStatus, error) {
      console.log('Unable to fetch goals (' + jqhxr.status + ' ' + error + ')');
    })
    .always(fetchComplete);
}


function fetchTrips() {
  $.getJSON('/api/trips/', {page: 1, per_page: 20})
    .done(function(data) {
      trips = data || [];
    })
    .fail(function(jqhxr, textStatus, error) {
      console.log('Unable to fetch trips (' + jqhxr.status + ' ' + error + ')');
    })
    .always(fetchComplete);
}


function processStats() {
  //sum moves for last 7 days
  stats.totalMoves = _.reduce(moves, function(memo, day) {
    return {
        distance: memo.distance + day.details.distance
      , calories: memo.calories + day.details.calories
      , active_time: memo.active_time + day.details.active_time
      , steps: memo.steps + day.details.steps
    }
  }, {distance: 0, calories: 0, active_time: 0, steps: 0});



  stats.weeklyGoal = goals.move_steps * 7;
  stats.stepsPerMile = Math.round(stats.totalMoves.steps / metersToMiles(stats.totalMoves.distance));

  //Count trips under two miles, but greater than 100 m
  stats.tripsUnderTwoMiles = _.filter(trips, function(trip) {
    return metersToMiles(trip.distance_m) <= 2 && trip.distance_m > 100;
  });

  stats.drivingDistance =  _.reduce(stats.tripsUnderTwoMiles, function(memo, trip) {
    return memo + metersToMiles(trip.distance_m);
  }, 0);

  stats.drivingDuration = _.reduce(stats.tripsUnderTwoMiles, function(memo, trip) {
    return memo + (trip.end_time - trip.start_time)/(1000*60);
  }, 0).toFixed(0);

  stats.missedSteps = stats.drivingDistance * stats.stepsPerMile;

  stats.movesPercentOfGoalNoDriving = (stats.totalMoves.steps + stats.missedSteps) / stats.weeklyGoal;

  $('[data-steps]').html(formatNumber(stats.totalMoves.steps));
  $('[data-walking-distance]').html(formatNumber(metersToMiles(stats.totalMoves.distance)));
  $('[data-calories]').html(stats.totalMoves.calories.toFixed(0));
  $('[data-percent-of-goal]').html(formatPercent(stats.totalMoves.steps / stats.weeklyGoal));


  $('[data-percent-of-goal-no-driving]').html(formatPercent(stats.movesPercentOfGoalNoDriving));
  $('[data-trips-under-two-miles]').html(stats.tripsUnderTwoMiles.length);
  $('[data-driving-duration').html(stats.drivingDuration);

  showTrips(stats.tripsUnderTwoMiles);

  hideLoading();
}


function showTrips(trips) {
  if(!trips.length) {
    $('#trips h2.headline').text('There are no trips in the last 7 days under two miles.');
  }
  stats.stepsPerMile = stats.totalMoves.steps / metersToMiles(stats.totalMoves.distance);
  trips.forEach(function(trip) {
    trip.missedSteps = metersToMiles(trip.distance_m) * stats.stepsPerMile;
    trip.percentOfGoal = trip.missedSteps / stats.weeklyGoal;
    $('<li>')
      .addClass('trip')
      .data('trip_id', trip.id)
      .data('trip', trip)
      .append($('<p>')
        .addClass('triptitle')
        .html('Trip at ' + moment(trip.start_time).format('h:mm A on M/D/YYYY') + ' to ' + trip.end_location.name))
      .append($('<div>')
        .attr('id', 'map' + trip.id)
        .addClass('trip_map'))
      .append($('<div>')
        .addClass('statbox')
        .append($('<span>')
          .text('or')
          .addClass('or'))
        .append($('<span>')
          .addClass('stat length')
          .append($('<var>')
            .text(formatNumber(metersToMiles(trip.distance_m))))
          .append($('<span>')
            .text('miles')))
        .append($('<span>')
          .addClass('stat equivalence')
          .append($('<var>')
            .text(formatPercent(trip.percentOfGoal)))
          .append($('<span>')
            .text('of your goal'))))
      .appendTo('#trips');

    setTimeout(function(){
      drawMap(trip);
    })
  });
}


function drawMap(trip) {

  var map = L.mapbox.map('map' + trip.id, 'brendannee.g9aijlep', {zoomControl: false});

  if (trip.path) {
    var polyline = L.Polyline.fromEncoded(trip.path, {
      color: '#08b1d5',
      opacity: 0.9,
    });

    map.fitBounds(polyline.getBounds());

    polyline.addTo(map);
  } else {
    map.fitBounds([[trip.start_location.lat, trip.start_location.lon], [trip.end_location.lat, trip.end_location.lon]]);
  }

  L.marker([trip.start_location.lat, trip.start_location.lon], {clickable: false, title: 'Start: ' + trip.start_location.name}).addTo(map);

  L.marker([trip.end_location.lat, trip.end_location.lon], {clickable: false, title: 'End: ' + trip.end_location.name}).addTo(map);
}


function showLoading(phase) {
  if(phase == 0) {
    var text = 'Loading your moves';
    var loadingClass = 'moves';
  } else if (phase == 1) {
    var text = 'Loading your goals';
    var loadingClass = 'goals';
  } else if (phase == 2) {
    var text = 'Loading your trips';
    var loadingClass = 'trips';
  } else if(phase == 3) {
    var text = 'Processing Data';
    var loadingClass = 'data';
  }
  $('.loading')
    .text(text)
    .fadeIn();

  $('#loading-bar')
    .show()
    .removeClass()
    .addClass(loadingClass);
}


function hideLoading() {
  $('.loading').hide();
  $('#loading-bar').fadeOut();

  $('#content').show();
}


function metersToMiles(meters) {
  return meters / 1609.34;
}


function formatFuelCost(fuelCost) {
  return fuelCost.toFixed(2);
}


function formatLocation(location) {
  return (location) ? location.replace(/\d+, USA/gi, '') : '';
}


function formatNumber(number) {
  if(number>100) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else {
    return number.toFixed(1);
  }
}

function formatPercent(fraction) {
  return (fraction * 100).toFixed(0) + '%';
}


function formatDuration(ms) {
  var mins = Math.floor(ms % (60 * 60 * 1000) / (60 * 1000));
  var hours = Math.floor(ms / (60 * 60 * 1000));
  return ((hours > 0) ? hours + 'h ' : '') + mins + ' min'
}


function formatSpeeding(sec) {
  return Math.floor(sec / 60);
}