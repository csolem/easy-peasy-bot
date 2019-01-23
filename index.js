/**
 * A Bot for Slack!
 */


var _ = require('underscore');
var cron = require('node-cron');
var fs = require('fs');

/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}

function findRandomMembers(numberOfChosenMembers, members) {
  return ['U0DL5N1L4','UDU6KE0A0'];
    // return _.sample(members, numberOfChosenMembers);
}
function inviteUsers(bot, users) {
  return Promise.all(users.map((user) => {
    return new Promise((resolve, reject) => {
      bot.startPrivateConversation({user: user.id, text: 'Tjena'}, (err, conversation) => {
        if(err) {
          console.error(err)
        }else{
          conversation.addQuestion('Tjenare Kompis!\nSkall du med a fika klockan 2?\nSvara Ja/Nej sa fort som möjlig',[
            {
              pattern: /^ja/i,
              callback: function(response,convo) {
                convo.say('Jättekul! Det här blir hur bra som helst');
                convo.next();
                resolve(user);
              }
            },
            {
              pattern: /^ne[ij]/i,
              callback: function(response,convo) {
                convo.say('Tråkmåns.. jaja kanske en annan gång då :D');
                convo.next();
                reject();
              }
            },
            {
              default: true,
              callback: function(response,convo) {
                convo.say('Nu fattade jag inte helt var du sa kompis');
                convo.repeat();
                convo.next();
              }
            }
          ]);
        }
      });
    });
  }));
}

/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}

/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */

const CHANNEL = "CFN8CPJKY";
const INVITATION_FILE = "invitation.json";
var members = [];

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
    bot.api.channels.info({channel: CHANNEL}, function(err, list) {
        members = list.channel.members;
        console.log("Fetched members: ", members);
    
        let randomMembers = findRandomMembers(2, members).map((id) =>({id}));
        let replies = inviteUsers(bot, randomMembers);
      replies.then((users)=>{
        console.log(users);

        let usersString = usersString(users);
        let responsibleUser = findRandomMembers(1, users).map((id) =>({id}));
        bot.say({channel: CHANNEL, text: `Tjabba tjena allihopa!\n Klockan 14:00 skall ${usersString} fika tillsammans i lunchrummet pa andra vaningen i glasgarden:tada:\n ${responsibleUser} koper fika och gor utlagg. NRK betalar.\n Blev det inte din tur idag?\n Du far en ny chans i morgon :nerd_face:`})
      })
        
        console.log("Generated a list of random members: ", randomMembers);

        let invitation = {
            time: new Date(),
            invitedMembers: randomMembers,
            membersInvited: false
        };
        saveInvitiation(invitation);
    });
});

function usersString(users) {
    if(users) {
        return users.map(user => user.id).join(' ');
    }
    return '';
}

function saveInvitiation(invitation) {
    fs.writeFileSync(INVITATION_FILE, JSON.stringify(invitation));
}

function invitationExists() {
    return fs.existsSync(INVITATION_FILE)
}

function readInvitation() {
    return JSON.parse(fs.readFileSync(INVITATION_FILE));
}

cron.schedule('* * * * *', () => {  

    if (invitationExists()) {
        
        let invitation = readInvitation();
        console.log("Found invitation: ", invitation);
                
        if(!invitation.membersInvited) {
            // initiate dialogoue with users
            console.log("About to invite members to fika!");

            invitation.membersInvited = true;

            saveInvitiation(invitation);
        } else {
            console.log("Members already invited.");
        }
    } else {
        console.log("No invitation exist");
    }
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here!")
});

controller.hears('hello', 'direct_message', function (bot, message) {
    bot.reply(message, 'Hello!');
});

controller.hears('hello', 'direct_mention', function (bot, message) {
    bot.reply(message, 'Hello!');
});


/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });
//});
