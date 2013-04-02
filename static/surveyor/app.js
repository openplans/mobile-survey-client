$(function() {

  $('#mock-problems-check').change(function() {
    if ($(this).is(':checked')) {
      $('#mock-problems-note').show();
    } else {
      $('#mock-problems-note').hide();
    }
  });

  $('#mock-discard-button').click(function() {
    $('#discard-confirmation').modal('show');
  });

  $('#mock-back-button').click(function(evt) {
    evt.preventDefault();
    $('#save-changes-prompt').modal('show');
  });

  $('#discard-confirmation a.no-op').click(function(evt) {
    evt.preventDefault();
    $('#discard-confirmation').modal('hide');
  });

  $('#save-changes-prompt a.no-op').click(function(evt) {
    evt.preventDefault();
    $('#save-changes-prompt').modal('hide');
  });

});
