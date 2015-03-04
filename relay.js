var config = require('./config'),
    irc = require('irc');

var baseClient = new irc.Client(config.baseServer, config.baseNick, config.baseConnection),
    relays = {};

config.relayServers.forEach(function(relayServer, i) {
  relays[i+1] = new irc.Client(relayServer, config.relayNick, config.relayConnection);
  relays[i+1].relayServer = relayServer;
  relays[i+1].addListener('error', function(m) {
    console.error('Relay %d error: %s: %s', i+1, m.command, m.args.join(' '));  
  });
});

function parseCommand(msg) {
  if (msg[0] === config.commandIdentifer) {
    var params = msg.split(" "),
        command = params[0].slice(1),
        comObj = { command: command };
    params.shift();
    comObj.params = params;
    return comObj;
  }
  else {
    return false;
  }
}

baseClient.addListener('error', function(err) {
  console.log('Error: %s: %s', err.command, err.args.join(' '));
});

baseClient.addListener('message', function(f, t, m) {
  var com = parseCommand(m);
  
  if (com) {
    
    var relayClient;
    
    if (com.command == 'relay') {
      var relaySelect = com.params[0],
          msg = '';
      
      com.params.shift();
      msg = com.params.join(' ');
      
      if (relaySelect === '*') {
        // to all
        for (var k in relays) {
          relayClient = relays[k];
          if (msg !== '') {
            config.relayConnection.channels.forEach(function(chan) {
              relayClient.say(chan, msg);
              baseClient.say(t, 'Relay: '+relayClient.relayServer+":"+chan+" -> "+com.params.join(' '));
            });
          }
          else {
            baseClient.say(t, 'Usage: !relay * message goes here');
          }
        }
      }
      else {
        relayClient = relays[Number(relaySelect)];
        if (relayClient && msg !== '') {
          config.relayConnection.channels.forEach(function(chan) {
            relayClient.say(chan, msg);
            baseClient.say(t, 'Relay: '+relayClient.relayServer+":"+chan+" -> "+com.params.join(' '));
          });
        }
        else {
          baseClient.say(t, 'Usage: !relay serverID message goes here');
        }
      }
      
      
    }
    
    if (com.command == 'list') {
      for (var k in relays) {
        baseClient.say(t, k+': '+relays[k].relayServer);
      }
    }
  }
});