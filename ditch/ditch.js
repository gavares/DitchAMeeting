// Set up a collection to contain phone call information. On the server,
// it is backed by a MongoDB collection named "PhoneCalls".
// A phone call record looks like:
// { 
//   phone: "1234567890",
//   time: 1234567890L,
//   retries: 5
// }
//
PhoneCalls = new Meteor.Collection("PhoneCalls");

if (Meteor.isClient) {
  Template.hello.greeting = function () {
    return "Welcome to ditch.";
  };

  Template.hello.events({
    'click input' : function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
