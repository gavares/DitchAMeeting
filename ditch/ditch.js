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

  // Max number of allowable retries
  var maxRetries = 5

  // Match a string of 10 digits
  var phoneNumRegex = /^\d{10}$/

  // one week in milliseconds
  var oneWeek = 1000 * 60 * 60 * 24 * 7;

  Meteor.startup(function () {
    // code to run on server at startup
  });

  Meteor.methods({
      create_phone_call: function(phoneCall) {
        if( phoneCall === undefined )
          throw new Meteor.Error(400, "No phone call instance provided")

        var errors = {phone:[], time: [], retries: []}
        if( phoneCall.phone === undefined ){
          errors.phone.push("No phone number specified.");
        }
        else {
          phoneCall.phone = phoneCall.phone.trim();
          if( !phoneNumRegex.match(phoneCall.phone) ){
            errors.phone.push("Phone number must be 10 digits.")
          }
        }

        if( phoneCall.time != undefined && phoneCall.time.toLowerCase() != 'now' ){
          // verify that time is a number and in the future
          if( typeof phoneCall.time === 'number' ) {
            var now = new Date().getTime() - 60 * 1000; // some delta to prevent extraneous errors
            var weekFromNow = now + oneWeek;
            if( phoneCall.time  < now ){
              errors.time.push("Scheduled call time cannot be in the past.");
            }
            else if( phoneCall.time > weekFromNow ) {
              errors.time.push("Scheduled call time cannot be more than 1 week in the future.");
            }
          }
          else {
            throw new Meteor.Error(400, "Call time expected to be a numeric timestamp in milliseconds since epoch.");
          }
        }

        if( phoneCall.retries === undefined || phoneCall.retries < 0 ){
          phoneCall.retries = 0;
        }
        else if( phoneCall.retries > maxRetries ){
          errors.retries.push("Number of retries cannot be more than " + maxRetries);
        }

        if( errors.phone.length || errors.time.length || errors.retries.length ){
          throw new Meteor.Error(400, errors);
        }

        PhoneCalls.insert(phoneCall)
      }
  });
}
