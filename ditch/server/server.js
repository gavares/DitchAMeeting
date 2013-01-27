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

if (Meteor.isServer) {

  // Twilio account credentials
  var ACCOUNT_SID = "ACcf48e69f532d045c92e49ad758a58a55"
  var AUTH_TOKEN = "04f0f80892d0d6eeb14ab8fafef8d930"
  var CALLBACK_ENDPOINT = "www.ditchameeting.com"
  var TWILIO_PHONE_NUM = '+15126237642'

  // Max number of allowable retries
  var maxRetries = 5

  // Match a string of 10 digits
  var phoneNumRegex = /^\d{10}$/

  // one week in milliseconds
  var oneWeek = 1000 * 60 * 60 * 24 * 7;

  var twilioClient = undefined;

  Meteor.startup(function () {
    // Next 6 lines load node modules into meteor
    // See: http://stackoverflow.com/questions/10476170/how-can-i-deploy-node-modules-in-a-meteor-app-on-meteor-com
    var require = __meteor_bootstrap__.require;
    var sys = require('sys')
    var path = require('path');
    var fs = require('fs');
    var base = path.resolve('.');
    var isBundle = fs.existsSync(base + '/bundle');
    var modulePath = base + (isBundle ? '/bundle/static' : '/public') + '/node_modules';
    console.log("ModulePath: " + modulePath)

    var twilioPath = modulePath + '/twilio/';
    console.log("twilioPath: " + twilioPath)

    var Twilio = require(twilioPath)
    console.log("Twilio: " + Twilio)
    twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);

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
          if( !phoneNumRegex.test(phoneCall.phone) ){
            errors.phone.push("Phone number must be 10 digits.")
          }
        }

        if( phoneCall.time != undefined){
          // verify that time is a number and in the future
          if( typeof phoneCall.time === 'number' ) {
            var now = new Date().getTime() - 60 * 1000; // some delta to prevent extraneous errors
            var weekFromNow = now + oneWeek;
            if( phoneCall.time > weekFromNow ) {
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
          if( errors.phone.length === 0) delete errors.phone;
          if( errors.time.length === 0) delete errors.time;
          if( errors.retries.length === 0) delete errors.retries;

          throw new Meteor.Error(400, "", errors);
        }

        PhoneCalls.insert(phoneCall)
        makeCall( phoneCall )
      }
  });

  function makeCall(phoneCall) {

    // Alright, our phone number is set up. Let's, say, make a call:
    twilioClient.makeCall({
        to: phoneCall.phone,
        from: TWILIO_PHONE_NUM,
        url: 'http://www.example.com/twiml.php'
    }, function(err, responseData){
      console.log( responseData )
    });
  }
}
