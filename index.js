const nodemailer = require('nodemailer');
var async = require("async");
var http = require("http");
var fs = require("fs");
var htmlDoc = String(fs.readFileSync('document.html'));;
var Subj = 'EOS Insider Witness beta test'
let mmmailsJSON = String(fs.readFileSync('mmmails0.json')); //REPLACE with mails
var senders = ['eostokens@gmail.com'];
var passwords = ['scamioio12390'];

var currentTransporter = 0;
var transporters = []

var status = 'stopped';
var mm = null;

for (var i = 0; i < senders.length; ++i) {
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // secure:true for port 465, secure:false for port 587
        auth: {
            user: senders[i],
            pass: passwords[i]
        }
    });

    transporters.push(transporter);
}

var listofemails = JSON.parse(mmmailsJSON);
console.log(listofemails.length);

var success_email = [];
// Will store email whose sending is failed. 
var failure_email = [];

function massMailer() {
    var self = this;

    // Fetch all the emails from database and push it in listofemails
    // Will do it later.
    self.invokeOperation();
};

/* Invoking email sending operation at once */

massMailer.prototype.invokeOperation = function () {
    var self = this;
    async.each(listofemails, self.SendEmail, function () {
        console.log(success_email);
        console.log(failure_email);
    });
}

/* 
* This function will be called by multiple instance.
* Each instance will contain one email ID
* After successfull email operation, it will be pushed in failed or success array.
*/

massMailer.prototype.SendEmail = function (Email, callback) {
    console.log("Sending email to " + Email);
    var self = this;
    self.status = false;
    // waterfall will go one after another
    // So first email will be sent
    // Callback will jump us to next function
    // in that we will update DB
    // Once done that instance is done.
    // Once every instance is done final callback will be called.
    async.waterfall([
        function (callback) {

            let transporter = transporters[currentTransporter];
            currentTransporter++;
            currentTransporter %= transporters.length;

            var mailOptions = {
                from: transporter.transporter.auth.user,
                to: Email,
                subject: Subj,
                html: htmlDoc
            };

            setTimeout(function () {
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error)
                        failure_email.push(Email);
                    } else {
                        self.status = true;
                        success_email.push(Email);
                    }

                    status = "failure " + failure_email.length + " success " + success_email.length;
                    callback(null, self.status, Email);
                });
            }, 2000 * 60);

        },
        function (statusCode, Email, callback) {

            callback();
        }
    ], function () {

        if (failure_email.length + success_email.length == listofemails.length) {
            fs.writeFileSync("failedMails.json", JSON.stringify(failure_email));
            fs.writeFileSync("successMails.json", JSON.stringify(success_email));

            status = 'done';
        }

        callback();
    });
}


var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/start', function (request, response) {

    if (mm != null)
    {
        response.send('Already started');
        return;
    }

    status = 'started';
    mm = new massMailer(); //lets begin
    response.send('Ok running');
});

app.get('/status', function (request, response) {
    response.send(status);
});

app.get('/success', function (request, response) {
    response.setHeader('Content-Type', 'application/json');
    let success = String(fs.readFileSync('successMails.json'));
    response.send(success);
});

app.get('/failed', function (request, response) {
    response.setHeader('Content-Type', 'application/json');
    let success = String(fs.readFileSync('failedMails.json'));
    response.send(success);
});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


