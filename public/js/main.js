var tripsUnderTwoMiles
  , drivingDuration
  , drivingDistance
  , totalMoves
  , weeklyGoal
  , stepsPerMile
  , missedSteps;

fetchMoves();


function fetchMoves() {
  showLoading('Loading your moves', 'moves');
  $.getJSON('/api/moves/', {})
    .done(function(data) {
      if(data && data.data && data.data.items && data.data.items.length) {
        processMoves(data.data.items);
      } else {
        showAlert('No moves found', 'warning');
      }
      fetching = false;
    })
    .fail(function(jqhxr, textStatus, error) {
      showAlert('Unable to fetch moves (' + jqhxr.status + ' ' + error + ')', 'danger');
    });
}


function processMoves(moves) {
  //sum moves for last 7 days
  totalMoves = _.reduce(moves, function(memo, day) {
    return {
        distance: memo.distance + day.details.distance
      , calories: memo.calories + day.details.calories
      , active_time: memo.active_time + day.details.active_time
      , steps: memo.steps + day.details.steps
    }
  }, {distance: 0, calories: 0, active_time: 0, steps: 0});

  $('[data-steps]').html(formatNumber(totalMoves.steps));
  $('[data-walking-distance]').html(formatNumber(metersToMiles(totalMoves.distance)));
  $('[data-calories]').html(totalMoves.calories.toFixed(0));

  fetchGoals();
}


function fetchGoals() {
  console.log('fetching Goals')
  showLoading('Loading your goals', 'goals');
  $.getJSON('/api/goals/', {})
    .done(function(data) {
      if(data && data.data) {
        processGoals(data.data);
      } else {
        showAlert('No goals found', 'warning');
      }
      fetching = false;
    })
    .fail(function(jqhxr, textStatus, error) {
      showAlert('Unable to fetch goals (' + jqhxr.status + ' ' + error + ')', 'danger');
    });
}


function processGoals(goals) {
  weeklyGoal = goals.move_steps * 7;
  stepsPerMile = Math.round(totalMoves.steps / metersToMiles(totalMoves.distance));

  $('[data-percent-of-goal]').html(formatPercent(totalMoves.steps / weeklyGoal));

  fetchTrips();
}


function fetchTrips() {
  console.log('fetching Trips')
  showLoading('Loading your trips', 'trips')
  $.getJSON('/api/trips/', {page: 1, per_page: 20})
    .done(function(data) {
      if(data && data.length) {
        processTrips(data);
        // trackTrips();
      } else {
        showAlert('No trips found', 'warning');
      }
      fetching = false;
    })
    .fail(function(jqhxr, textStatus, error) {
      showAlert('Unable to fetch trips (' + jqhxr.status + ' ' + error + ')', 'danger');
    });
}

// var trackTrips = function() {
//     var trips = {
//         trip : "content"
//     };
//     Keen.addEvent("trips", trips);
// };

function processTrips(data) {
  //Count trips under two miles, but greater than 100 m
  tripsUnderTwoMiles = _.filter(data, function(trip) {
    return metersToMiles(trip.distance_m) <= 2 && trip.distance_m > 100;
  });

  drivingDistance =  _.reduce(tripsUnderTwoMiles, function(memo, trip) {
    return memo + metersToMiles(trip.distance_m);
  }, 0);

  drivingDuration = _.reduce(tripsUnderTwoMiles, function(memo, trip) {
    return memo + (trip.end_time - trip.start_time)/(1000*60);
  }, 0).toFixed(0);

  missedSteps = drivingDistance * stepsPerMile;

  var movesPercentOfGoalNoDriving = (totalMoves.steps + missedSteps) / weeklyGoal;

  $('[data-percent-of-goal-no-driving]').html(formatPercent(movesPercentOfGoalNoDriving));

  $('[data-trips-under-two-miles]').html(tripsUnderTwoMiles.length);
  $('[data-driving-duration').html(drivingDuration);

  showTrips(tripsUnderTwoMiles);
}


function showTrips(trips) {
  var stepsPerMile = totalMoves.steps / metersToMiles(totalMoves.distance);
  trips.forEach(function(trip) {
    console.log(trip)
    var missedSteps = metersToMiles(trip.distance_m) * stepsPerMile;
    var percentOfGoal = missedSteps / weeklyGoal;
    $('<li>')
      .addClass('trip')
      .data('trip_id', trip.id)
      .data('trip', trip)
      .append($('<p>')
        .addClass('triptitle')
        .html('Trip at ' + moment(trip.start_time).format('h:mm A on M/D/YYYY') /*+ ' to ' + trip.end_location.name*/))
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
            .text(formatPercent(percentOfGoal)))
          .append($('<span>')
            .text('of your goal'))))
      .appendTo('#trips');

  //drawMap(trip);
  });
  hideLoading();
}


function drawMap(trip) {
  var map = L.mapbox.map('map' + trip.id, 'brendannee.g9aijlep')

  if (trip.path) {
    var polyline = L.Polyline.fromEncoded(trip.path, {color: '#08b1d5', opacity: 0.9});

    map.fitBounds(polyline.getBounds());

    polyline.addTo(map);
  } else {
    map.fitBounds([[trip.start_location.lat, trip.start_location.lon], [trip.end_location.lat, trip.end_location.lon]]);
  }

  L.marker([trip.start_location.lat, trip.start_location.lon], {clickable: false, title: 'Start Location'}).addTo(map);
  L.marker([trip.end_location.lat, trip.end_location.lon]).addTo(map);
}

function showLoading(text, phase) {
  $('.loading')
    .text(text)
    .fadeIn();

  $('#loading-bar').removeClass().addClass(phase);
}


function hideLoading() {
  $('.loading').hide();
  $('#loading-bar').fadeOut();

  $('#content').show();
}


function showAlert(msg, type) {
  var type = type || 'info';
  $('#alert').html(msg).removeClass().addClass('alert alert-' + type).fadeIn();
}


function hideAlert() {
  $('#alert').fadeOut();
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