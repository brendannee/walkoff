var page = 1,
    end = moment(),
    fetching = false,
    cache = [],
    viewType = 'tile';

fetchTrips();

//infinite scroll
$(window).scroll(function() {
  if(page !== undefined && fetching === false && $(window).scrollTop() + $(window).height() > $(document).height() - 1000) {
    fetching = true;
    fetchTrips();
  }
});


function fetchTrips() {
  showLoading();
  $.getJSON('/api/trips/', {page: page})
    .done(function(data) {
      hideLoading();
      if(data && data.length) {
        cache = cache.concat(data);
        data.map(addToPage);
        $('#trips .trip').not('.tile').map(function(idx, div) { renderTile(div); });
        page += 1;
      } else {
        page = undefined;
        if(cache.length == 0) {
          showAlert('No trips found', 'warning');
        }
      }
      fetching = false;
    })
    .fail(function(jqhxr, textStatus, error) {
      showAlert('Unable to fetch trips (' +jqhxr.status + ' ' + error + ')', 'danger');
    });
}


function addToPage(trip) {
  // don't show very short trips
  if(trip.distance_m >= 100) {
    $('<div>')
      .addClass('trip')
      .data('trip_id', trip.id)
      .data('trip', trip)
      .appendTo('#trips');
  }
}


function renderTile(div) {
  var trip = $(div).data('trip');
  $(div)
    .removeClass('table')
    .addClass('tile')
    .empty()
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
          .text(formatDistance(trip.distance_m)))
        .append($('<div>')
          .addClass('mpg')
          .text(formatMPG(trip.average_mpg)))
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
        .attr('id', 'map' + trip.id));
  drawMap(trip);
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


function formatDistance(distance) {
  //convert from m to mi
  return (distance / 1609.34).toFixed(1);
}


function formatFuelCost(fuelCost) {
  return fuelCost.toFixed(2);
}


function formatLocation(location) {
  return (location) ? location.replace(/\d+, USA/gi, '') : '';
}


function formatMPG(average_mpg) {
  return average_mpg.toFixed(1);
}


function formatDuration(ms) {
  var mins = Math.floor(ms % (60 * 60 * 1000) / (60 * 1000));
  var hours = Math.floor(ms / (60 * 60 * 1000));
  return ((hours > 0) ? hours + 'h ' : '') + mins + ' min'
}


function formatSpeeding(sec) {
  return Math.floor(sec / 60);
}