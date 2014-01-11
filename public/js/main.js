var tripsUnderTwoMiles
  , drivingDuration
  , drivingDistance
  , totalMoves;

fetchTrips();
fetchMoves();


function fetchTrips() {
  showLoading();
  $.getJSON('/api/trips/', {page: 1, per_page: 20})
    .done(function(data) {
      hideLoading();
      if(data && data.length) {
        processTrips(data);
      } else {
        showAlert('No trips found', 'warning');
      }
      fetching = false;
    })
    .fail(function(jqhxr, textStatus, error) {
      showAlert('Unable to fetch trips (' + jqhxr.status + ' ' + error + ')', 'danger');
    });
}


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

  $('[data-trips-under-two-miles]').html(tripsUnderTwoMiles.length);
  $('[data-driving-duration').html(drivingDuration);

  showTrips(tripsUnderTwoMiles);
}


function fetchMoves() {
  showLoading();
  $.getJSON('/api/moves/', {})
    .done(function(data) {
      hideLoading();
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
  showLoading();
  $.getJSON('/api/goals/', {})
    .done(function(data) {
      hideLoading();
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
  var weeklyGoal = goals.move_steps * 7;
  var stepsPerMile = totalMoves.steps / metersToMiles(totalMoves.distance);
  var missedSteps = drivingDistance * stepsPerMile;
  var movesPercentOfGoalNoDriving = (totalMoves.steps + missedSteps) / weeklyGoal;
  $('[data-percent-of-goal]').html(formatPercent(totalMoves.steps / weeklyGoal));
  $('[data-percent-of-goal-no-driving]').html(formatPercent(movesPercentOfGoalNoDriving));
}

function showTrips(trips) {
  trips.forEach(function(trip) {
    $('<div>')
      .addClass('trip')
      .data('trip_id', trip.id)
      .data('trip', trip)
      .append($('<div>')
        .addClass('times')
        .append($('<div>')
          .addClass('endTime')
          .html(moment(trip.end_time).format('h:mm A<br>M/D/YYYY')))
        .append($('<div>')
          .addClass('duration')
          .text(formatDuration(trip.end_time - trip.start_time)))
        .append($('<div>')
          .addClass('startTime')
          .html(moment(trip.start_time).format('h:mm A<br>M/D/YYYY')))
        .append($('<div>')
          .addClass('tripLine')
          .html('<div></div><div></div>')))
      .append($('<div>')
        .addClass('tripSummary')
        .append($('<div>')
          .addClass('endLocation')
          .text(formatLocation(trip.end_location.name)))
        .append($('<div>')
          .addClass('tripSummaryBox')
          .append($('<div>')
            .addClass('distance')
            .text(formatNumber(metersToMiles(trip.distance_m))))
          .append($('<div>')
            .addClass('mpg')
            .text(formatNumber(trip.average_mpg)))
          .append($('<div>')
            .addClass('fuelCost')
            .text(formatFuelCost(trip.fuel_cost_usd)))
          .append($('<div>')
            .addClass('hardBrakes')
            .addClass(trip.hard_brakes > 0 ? 'someHardBrakes' : 'noHardBrakes')
            .text(trip.hard_brakes || ''))
          .append($('<div>')
            .addClass('hardAccels')
            .addClass(trip.hard_accels > 0 ? 'someHardAccels' : 'noHardAccels')
            .text(trip.hard_accels || ''))
          .append($('<div>')
            .addClass('durationOver70')
            .addClass(formatSpeeding(trip.duration_over_70_s) > 0 ? 'someSpeeding' : 'noSpeeding')
            .text(trip.duration_over_70_s || '')))
        .append($('<div>')
          .addClass('startLocation')
          .text(formatLocation(trip.start_location.name))))
        .append($('<div>')
          .addClass('map')
          .attr('id', 'map' + trip.id))
    .appendTo('#trips');

  drawMap(trip);
  });
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

function showLoading() {
  $('.loading').fadeIn();
}


function hideLoading() {
  $('.loading').fadeOut();
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