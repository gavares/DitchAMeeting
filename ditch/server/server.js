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

  var MAX_CALLS_PER_DAY = 100

  var timeZone = "America/Los_Angeles";

  // Max number of allowable retries
  var maxRetries = 5

  // Match a string of 10 digits
  var phoneNumRegex = /^\d{10}$/

  // one week in milliseconds
  var oneWeek = 1000 * 60 * 60 * 24 * 7;

  var twilioClient = undefined;
  var cron = undefined;

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
    var cronPath = modulePath + '/cron/';

    var Twilio = require(twilioPath)
    twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
    cron = require(cronPath);

    // Scan the PhoneCalls collection and schedule anything
    // that is still pending
    schedulePendingPhoneCalls()
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

        console.log("Call time incomming as: ", phoneCall.time)

        if( phoneCall.time != undefined){
          // verify that time is a number and in the future
          if( typeof phoneCall.time === 'number' ) {
            var now = new Date().getTime(); // some delta to prevent excessive rejection
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

        // Make sure we haven't exceeded max calls for the specified date
        var callDateStr = new Date(phoneCall.time).toDateString();
        var numCallsForDate = PhoneCalls.find({$where: 'new Date(this.time).toDateString() == "' + callDateStr + '"' }).count();
        console.log("Found ", numCallsForDate, " calls for date ", callDateStr);

        if( numCallsForDate >= MAX_CALLS_PER_DAY )
          throw new Meteor.Error(400, "Ditch A Metting has exceeded the maximum number of calls for the date specified.");



        if( errors.phone.length || errors.time.length || errors.retries.length ){
          if( errors.phone.length === 0) delete errors.phone;
          if( errors.time.length === 0) delete errors.time;
          if( errors.retries.length === 0) delete errors.retries;

          throw new Meteor.Error(400, "", errors);
        }

        // Insert the phone call into our mongo instance
        PhoneCalls.insert(phoneCall)
        console.log("phoneCallTime:",phoneCall.time)
        schedulePhoneCall(phoneCall)
      }
  });

  /**
   * Scans the PhoneCalls collection and schedules any pending calls.
   * */
  function schedulePendingPhoneCalls() {
    var now = new Date().getTime();
    PhoneCalls.find({time: {$gt: now}}).forEach( schedulePhoneCall );
  }

  function schedulePhoneCall(phoneCall) {
      // schedule a future to exec the phonecall 
      console.log("phoneCallTime:",phoneCall.time)
      var callTime = new Date(phoneCall.time);
      console.log("CallTime:", callTime);
      console.log("CallTime:", callTime.getTime());
      var now = new Date().getTime() + 5000; 
      if( callTime.getTime() < now ){
        callTime = new Date( now )
      }

      console.log("Scheduling phoneCall: ", phoneCall," at ", callTime)
      var j = new cron.CronJob(callTime, function(){
          console.log("Initiating phoneCall: ", phoneCall);
          makeCall( phoneCall )
        },
        function() {
          console.log("Completed phoneCall: ", phoneCall)
        },
        true
      );
  }

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
