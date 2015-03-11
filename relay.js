var config = require('./config'),
    irc = require('irc'),
    _ = require('underscore');

var baseClient = new irc.Client(config.baseServer, config.baseNick, config.baseConnection),
    relays = {}, lastRelay;

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

function getChannels(relay) {
  var channels = [];
  for (var k in relay.chans) {
    channels.push(k);
  }
  return channels;
}

config.relayServers.forEach(function(relayServer, i) {
  relays[i+1] = new irc.Client(relayServer, config.relayNick, config.relayConnection);
  relays[i+1].relayServer = relayServer;
  relays[i+1].echoState = 1; // thx b4x
  relays[i+1].addListener('error', function(m) {
    console.error('Relay %d error: %s: %s', i+1, m.command, m.args.join(' '));
    config.baseConnection.channels.forEach(function(baseChan) {
      baseClient.say(baseChan, 'Relay '+(i+1)+' error: '+m.command+' '+m.args.join(' '));
    });
  });
  relays[i+1].addListener('message', function(f, t, m) {
    if (relays[i+1].echoState > 0) {
      if (relays[i+1].echoState == 1) {
        if (m.indexOf(relays[i+1].nick) !== -1) {
          config.baseConnection.channels.forEach(function(baseChan) {
            baseClient.say(baseChan, '1,9'+relays[i+1].relayServer+' '+t+'4,9 '+f+' 1,9-> 2,9 '+m);
          });
        }
      }
      if (relays[i+1].echoState == 2) {
        // log all
        config.baseConnection.channels.forEach(function(baseChan) {
          baseClient.say(baseChan, '1,9'+relays[i+1].relayServer+' '+t+'4,9 '+f+' 1,9-> 2,9 '+m);
        });
      }
    }
  });
  lastRelay = i+1;
});

baseClient.addListener('error', function(err) {
  console.log('Error: %s: %s', err.command, err.args.join(' '));
});

baseClient.addListener('message', function(f, t, m) {
  var com = parseCommand(m);
  
  var relaySelect, relayClient, cmd,
      channel, channels, msg, nick;
  
  if (com && (f == config.admin || config.masters.indexOf(f) !== -1)) {
    
    if (com.command == 'relay') {
      var channelSelect = com.params[1];
      relaySelect = com.params[0];
      msg = '';
      com.params.shift();
      com.params.shift();
      msg = com.params.join(' ');
      
      if (msg !== '' && channelSelect !== '') {
        if (relaySelect === '*') {
          // to all
          for (var k in relays) {
            relayClient = relays[k];
            channels = getChannels(relayClient);
            if (channelSelect === '*') {
              channels.forEach(function(chan) {
                relayClient.say(chan, msg);
                baseClient.say(t, '9,1<<Relay>> 1,9'+relayClient.relayServer+" "+chan+" ->2,9 "+com.params.join(' '));
              });
            }
            else {
              if (channels.indexOf(channelSelect) !== -1) {
                relayClient.say(channelSelect, msg);
                baseClient.say(t, '9,1<<Relay>> 1,9'+relayClient.relayServer+" "+channelSelect+" ->2,9 "+com.params.join(' '));
              }
            }
          }
        }
        else {
          relayClient = relays[Number(relaySelect)];
          if (relayClient) {
            channels = getChannels(relayClient);
            
            if (channelSelect === '*') {
              channels.forEach(function(chan) {
                relayClient.say(chan, msg);
                baseClient.say(t, '9,1<<Relay>> 1,9'+relayClient.relayServer+" "+chan+" ->2,9 "+com.params.join(' '));
              });
            }
            else {
              if (channels.indexOf(channelSelect) !== -1) {
                relayClient.say(channelSelect, msg);
                baseClient.say(t, '9,1<<Relay>> 1,9'+relayClient.relayServer+" "+channelSelect+" ->2,9 "+com.params.join(' '));
              }
            }
            
          }
          else {
            baseClient.say(t, 'Usage: !relay serverID|* channel|* message goes here');
          }
        }
      }
      else {
        baseClient.say(t, 'Usage: !relay serverID|* channel|* message goes here');
      }
    }
    
    if (com.command == 'list') {
      for (var k in relays) {
        channels = getChannels(relays[k]);
        baseClient.say(t, k+': '+relays[k].relayServer+' ['+channels.join(', ')+'] Echo: '+relays[k].echoState);
      }
    }
    
    if (com.command == 'join') {
      channel = com.params[1];
      
      relaySelect = com.params[0];
      
      if (channel && channel.match(/^[#&+]/) && relaySelect) {
        if (relaySelect === '*') {
          // join the channel on all servers
          for (var k in relays) {
            relayClient = relays[k];
            relayClient.join(channel, function() {
              baseClient.say(t, 'Joined '+relayClient.relayServer+':'+channel);  
            });
          }
        }
        else {
          // just join on one server
          relayClient = relays[Number(relaySelect)];
          if (relayClient) {
            relayClient.join(channel, function() {
              baseClient.say(t, 'Joined '+relayClient.relayServer+':'+channel);
            });
          }
          else {
            baseClient.say(t, 'Usage: !join serverID #channel');
          }
        }
      }
      else {
        baseClient.say(t, 'Usage: !join serverID #channel');
      }
    }
    
    if (com.command == 'part') {
      channel = com.params[1];
      
      relaySelect = com.params[0];
      
      if (channel && relaySelect) {
        if (relaySelect === '*') {
          // part the channel on all servers
          for (var k in relays) {
            relayClient = relays[k];
            channels = getChannels(relayClient);
            if (channels.indexOf(channel) !== -1) {
              relayClient.part(channel);
              baseClient.say(t, 'Parted '+relayClient.relayServer+':'+channel);
            }
          }
        }
        else {
          // part the channel on one server
          relayClient = relays[Number(relaySelect)];
          channels = getChannels(relayClient);
          if (relayClient) {
            if (channels.indexOf(channel) !== -1) {
              relayClient.part(channel);
              baseClient.say(t, 'Parted '+relayClient.relayServer+':'+channel);
            }
          }
          else {
            baseClient.say(t, 'Usage: !part serverID #channel');
          }
        }
      }
      else {
        baseClient.say(t, 'Usage: !part serverID #channel');
      }
    }
    
    if (com.command == 'echo') {
      var state = com.params[1];
      
      relaySelect = com.params[0];
      
      if (relaySelect && (state == '2' || state == '1' || state == '0')) {
        if (relaySelect === '*') {
          // set the echoState for all servers
          for (var k in relays) {
            relayClient = relays[k];
            relayClient.echoState = Number(state);
            baseClient.say(t, relayClient.relayServer+' echo: '+state);
          }
        }
        else {
          // set the echoState for one server
          relayClient = relays[Number(relaySelect)];
          if (relayClient) {
            relayClient.echoState = Number(state);
            baseClient.say(t, relayClient.relayServer+' echo: '+state);
          }
          else {
            baseClient.say(t, 'Usage: !echo serverID 0|1|2');  
          }
        }
      }
      else {
        baseClient.say(t, 'Usage: !echo serverID 0|1|2');
      }
      
    }
    
    if (com.command == 'nick') {
      nick = com.params[1];
      
      relaySelect = com.params[0];
      
      if (relaySelect && nick) {
        if (relaySelect === '*') {
          // change nick for all channels
          for (var k in relays) {
            relayClient = relays[k];
            relayClient.send('NICK', nick);
            baseClient.say(t, 'Nick '+relayClient.relayServer+': '+nick);
          }
        }
        else {
          // change nick for 1 channel
          relayClient = relays[Number(relaySelect)];
          if (relayClient) {
            relayClient.send('NICK', nick);
            baseClient.say(t, 'Nick '+relayClient.relayServer+': '+nick);
          }
          else {
            baseClient.say(t, 'Usage: !nick serverID nick');  
          }
        }
      }
      else {
        baseClient.say(t, 'Usage: !nick serverID nick');
      }
    }
    
    if (com.command == 'connect') {
      var server = com.params[0];
          
      nick = com.params[1];
      
      if (!nick) {
        nick = config.relayNick;
      }
      
      if (server) {
        var thisRelay = lastRelay + 1;
        relays[thisRelay] = new irc.Client(server, nick, config.relayConnection);
        relays[thisRelay].relayServer = server;
        relays[thisRelay].echoState = 1;
        relays[thisRelay].addListener('error', function(m) {
          console.error('Relay %d error: %s: %s', thisRelay, m.command, m.args.join(' '));
          config.baseConnection.channels.forEach(function(baseChan) {
            baseClient.say(baseChan, 'Relay '+thisRelay+' error: '+m.command+' '+m.args.join(' '));
          });
        });
        relays[thisRelay].addListener('registered', function(m) {
          baseClient.say(t, 'Connected to '+server);
          lastRelay += 1;
        });
        relays[thisRelay].addListener('message', function(f, t, m) {
          if (relays[thisRelay].echoState > 0) {
            if (relays[thisRelay].echoState == 1) {
              if (m.indexOf(relays[thisRelay].nick) !== -1) {
                config.baseConnection.channels.forEach(function(baseChan) {
                  baseClient.say(baseChan, '1,9'+relays[thisRelay].relayServer+' '+t+'4,9 '+f+' 1,9-> 2,9 '+m);
                });
              }
            }
            if (relays[thisRelay].echoState == 2) {
              config.baseConnection.channels.forEach(function(baseChan) {
                baseClient.say(baseChan, '1,9'+relays[thisRelay].relayServer+' '+t+'4,9 '+f+' 1,9-> 2,9 '+m);
              });
            }
          }
        });
        relays[thisRelay].addListener('netError', function(e) {
          baseClient.say(t, 'Network '+e);
        });
        relays[thisRelay].addListener('abort', function(c) {
          delete(relays[thisRelay]);
        });
      }
      else {
        baseClient.say(t, 'Usage: !connect server [nick]');
      }
    }
    
    if (com.command == 'disconnect') {
      relaySelect = com.params[0];
      com.params.shift();
      msg = com.params.join(' ');
      
      if (msg == '') { msg = 'bye'; }
      
      if (relaySelect) {
        relayClient = relays[Number(relaySelect)];
        if (relayClient) {
          relayClient.disconnect(msg, function() {
            baseClient.say(t, 'Disconnected from '+relayClient.relayServer);
          });
          delete(relays[Number(relaySelect)]);
        }
        else {
          baseClient.say(t, 'Usage: !disconnect serverID [message]');
        }
      }
      else {
        baseClient.say(t, 'Usage: !disconnect serverID [message]');
      }
    }
    
    if (com.command == 'pm') {
      var to = com.params[1];
      relaySelect = com.params[0];
      com.params.shift();
      com.params.shift();
      msg = com.params.join(' ');
      
      relayClient = relays[Number(relaySelect)];
      if (relayClient && to && msg) {
        relayClient.say(to, msg);
      }
      else {
        baseClient.say(t, 'Usage: !pm serverID to message goes here');
      }
    }
    
  }
  
  if (com && f == config.admin) {
    
    if (com.command == 'add') {
      nick = com.params[0];
      
      if (nick) {
        config.masters.push(nick);
        baseClient.say(t, 'Added '+nick+' as a master');
      }
      else {
        baseClient.say(t, 'Usage: !add nick');
      }
    }
    
    if (com.command == 'rm') {
      nick = com.params[0];
      
      if (nick) {
        config.masters = _.without(config.masters, nick);
        baseClient.say(t, 'Removed '+nick+' as a master');
      }
      else {
        baseClient.say(t, 'Usage: !rm nick');
      }
    }
  }
});