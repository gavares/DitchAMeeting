// Set up a collection to contain phone call information. On the server,
// it is backed by a MongoDB collection named "PhoneCalls".
// A phone call record looks like:
// { 
//   phone: "1234567890",
//   time: 1234567890L,
//   retries: 5
//   say: "say this when the callee answers"
//   voice: "man"
//   language: "en-gb"
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
  var libxml = undefined;

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
    var libxmlPath = modulePath + '/libxmljs/';

    var Twilio = require(twilioPath)
    twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
    cron = require(cronPath);
    libxml = require(libxmlPath);

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
        console.log("Current time: ", new Date().getTime());

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
        insertPhoneCall(phoneCall)
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

  function insertPhoneCall(phoneCall) {
    var result = PhoneCalls.insert(phoneCall)
    phoneCall.id = result
    console.log("Inserted phoneCall result: ", phoneCall)
  }

  function schedulePhoneCall(phoneCall) {
      // schedule a future to exec the phonecall 
      var callTime = new Date(phoneCall.time);
      var now = new Date().getTime() + 5000; 
      if( callTime.getTime() < now ){
        callTime = new Date( now )
      }

      console.log("Scheduling phoneCall: ", phoneCall," at ", callTime)
      var j = new cron.CronJob(callTime, function() {
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
    var callbackURL = 'http://ditchameeting.com/twiml/858fdc07-f4f0-464c-8ae7-e2fe33802de5' //'http://ditchameeting.com/twiml/' + phoneCall.id
    var statusCallback = 'http://ditchameeting.com/status/' + phoneCall.id
    console.log("Initiating call with callback url:", callbackURL)
    // Alright, our phone number is set up. Let's, say, make a call:
    twilioClient.makeCall({
        to: phoneCall.phone,
        from: TWILIO_PHONE_NUM,
        url: callbackURL,
        method: "GET",
        statusCallback: statusCallback
    }, function(err, responseData){
      console.log( responseData )
    });
  }

  function createTwiml(phoneCall) {
    var doc = libxml.Document()
    var resp = doc.node("Response")
    var say = phoneCall.say == undefined ? "Hello, fellow billionaire!" : phoneCall.say;
    var say = resp.node("Say", say)
    var voice = phoneCall.voice == undefined ? "man" : phoneCall.voice;
    var language = phoneCall.language == undefined ? "en-gb" : phoneCall.language;
    say.attr("voice", voice)
    say.attr("language", language)

    var play = resp.node("Play", phoneCall.play)
    return doc.toString()
  }

  // Register a route that will serve the twiml docs
  // required for configuring phone calls
  Meteor.Router.add('/twiml/:id', function(id) {
    console.log("Looking for twiml with id:",id)
    var phoneCall = PhoneCalls.findOne(id);
    var resp = ""
    if( phoneCall != undefined ) {
      resp = createTwiml(phoneCall)
    }
    
    console.log("Response:",resp)
    return [200, {'Content-Type':'application/xml'}, resp]
  });

  Meteor.Router.add('/status/:id', function(id) {
    console.log("Received status for (",id,") : ", this.request.body)
  });
}
