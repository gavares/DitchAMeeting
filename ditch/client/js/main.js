var handleResult = function (err, result) {
  if (err) {
    if (err.details) {
      var fieldName;
      for (fieldName in err.details) {
        var $group = $('#' + fieldName).parent().parent();
        $group.addClass('error');
        $group.find('.help-inline').text(err.details[fieldName][0])
      }
    } else {
      $('.text-error').text(err.reason);
    }
  } else {
    $('form').fadeOut(500, function () {
      $('.scheduled').fadeIn(500);
      setTimeout(function () {
        $('.scheduled').fadeOut(500, function () {
          $('input').val('');
          $('form').fadeIn(500);
        });
      }, 5500);
    });
  }
};

Template.create.events({
  'submit form': function (e) {
    var $target = $(e.target),
        data;

    e.preventDefault();

    $('.error').removeClass('error');
    $('.help-inline').text('');
    $('.text-error').text('');

    data = $target.serializeObject();

    Meteor.call('create_phone_call', data, handleResult);
  }
});
