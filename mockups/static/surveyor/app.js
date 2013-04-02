$(function() {

  $('#mock-problems-check').change(function() {
    if ($(this).is(':checked')) {
      $('#mock-problems-note').show();
    } else {
      $('#mock-problems-note').hide();
    }
  });

});
