PhoneCalls = new Meteor.Collection("PhoneCalls");

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

var now = new Date(),
    max = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7));

Template.create.rendered = function () {
  $('#time').datetimepicker({
    minDate: now,
    maxDate: max
  });
};

Template.scheduled.calls = function () {
  return PhoneCalls.find({});
  //return PhoneCalls.find({time: {$gt: new Date().getTime()}})
};

Template.scheduled.events({
  'click button': function (e) {
    var $target = $(e.target),
        id = $target.data('id');

    PhoneCalls.remove(id);
  }
});

Template.create.events({
  'submit form': function (e) {
    var $target = $(e.target),
        data;

    e.preventDefault();

    $('.error').removeClass('error');
    $('.help-inline').text('');
    $('.text-error').text('');

    data = $target.serializeObject();

    try {
      data.time = $('#time').datetimepicker('getDate').getTime();
    } catch (e) {
      data.time = (new Date()).getTime();
    }

    Meteor.call('create_phone_call', data, handleResult);
  }
});
