Template.create.events({
  'submit form': function (e) {
    var $target = $(e.target),
        data;

    e.preventDefault();

    data = $target.serializeObject();
    console.log(data);
  }
});
