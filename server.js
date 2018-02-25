"use strict";
var http = require('http');
var fs = require('fs');
const WebSocket = require('ws');

// -- CONFIG --
var httpserver_port = 8080; // HTTP server port
var httpserver_host = '192.168.35.104'; // HTTP server, listen address
var remoteobs_host_port = '192.168.35.200:4444'; // OBS-websocket plugin endpoint (machine running OBS)
var websocket_server_port = 8081;
var playername = 'dmlr' // ingame name of player streaming
var regularcsgoscene = 'Scene csgo' // expecting '<name> pause' to exist
var multicamcsgoscene = 'Scene csgo multicam' // expecting '<name> pause' to exist
var deathfx = {
  'alive': [
    { source: 'DEATH', file: 'C:/Users/Daniel/Desktop/stream/null.png' },
    { source: 'DEATH2', file: 'C:/Users/Daniel/Desktop/stream/null.png' },
    { source: 'DEATH3', file: 'C:/Users/Daniel/Desktop/stream/null.png' },
  ],
  'dead': [
    { source: 'DEATH', file: 'C:/Users/Daniel/Desktop/stream/skull.png' },
    { source: 'DEATH2', file: 'C:/Users/Daniel/Desktop/stream/crack.png' },
    { source: 'DEATH3', file: 'C:/Users/Daniel/Desktop/stream/blood.png' },
  ]
}

// List of audioclips and paths, will use random one if more than one in array
var audio = {
  '3kills': ['C:/Users/Daniel/Desktop/stream/3kills.wav'],
  '4kills': [
    'C:/Users/Daniel/Desktop/stream/4kills.wav',
    'C:/Users/Daniel/Desktop/stream/4kills2.wav',
  ],
  'ace': [
    'C:/Users/Daniel/Desktop/stream/unbelivable.wav',
    'C:/Users/Daniel/Desktop/stream/kobe.wav',
    'C:/Users/Daniel/Desktop/stream/ace.wav',
    'C:/Users/Daniel/Desktop/stream/ace2.wav',
  ],
  'round_win': [
    'C:/Users/Daniel/Desktop/stream/round_win.wav',
  ],
}
var audio_source_name = { scene: 'Scene csgo LOLS', source: 'AUDIO' } // Source name of Audio container to play soundclips
var killcount_text_source_name = 'KILLCOUNT' // Source name of Text to update with current killcount
var ace_source_name = { scene: 'Scene csgo LOLS', source: 'ACE' } // Source name of Video file to play when player kills 5 ppl == Ace!
var debug_mode = false

// -- END CONFIG --

var killCamSettings = {}
var data = {}
var roundkills = 0
var dead = true
var playing = true
var usingMultiCamScene = false
var useCSGOScene = regularcsgoscene;
var isCounterTerrorist = null;
var score = { 'team_t': 0, 'team_ct': 0 }
var dontReactOnNextScoreChange = -1

const OBSWebSocket = require('obs-websocket-js');
const obs = new OBSWebSocket();
const wss = new WebSocket.Server({ port: websocket_server_port });

// Eventlistener
obs.onConnectionOpened(() => {
  console.log('[OBS Control] connected to OBS websocket');
  changePlayerKills(playername, 0)
  changePlayerHealth(playername, 100)
  obs.onSwitchScenes(data => {
    reactToSceneChange(data);
  });
});

// Connect to remote OBS
obs.connect({ address: remoteobs_host_port });

// Incoming websocket events
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('[REMOTECONTROL] received: %s', message);
  });
  ws.send('something');
});

Object.prototype.hasOwnNestedProperty = function(propertyPath){
    if(!propertyPath)
        return false;

    var properties = propertyPath.split('.');
    var obj = this;

    for (var i = 0; i < properties.length; i++) {
        var prop = properties[i];

        if(!obj || !obj.hasOwnProperty(prop)){
            return false;
        } else {
            obj = obj[prop];
        }
    }

    return true;
};

function errorhandler(err, data) {
  if (err != null) {
    console.log("[ERROR]")
    console.log(err)
  } else {
    if (debug_mode) {
      console.log("[DEBUG] " + data)
    }
  }
}

function reactToSceneChange(data) {
    if (data.hasOwnProperty('scene-name') && data.hasOwnProperty('update-type')) {
        if (data['update-type'] == 'SwitchScenes') {
            console.log('switched to Scene: ' + data['scene-name']);
            if (data['scene-name'] == regularcsgoscene) {
                usingMultiCamScene = false
                useCSGOScene = regularcsgoscene
                playing = true
                console.log('[Multicam mode] - Disabled');
            } else if (data['scene-name'] == multicamcsgoscene) {
                usingMultiCamScene = true
                useCSGOScene = multicamcsgoscene
                playing = true
                console.log('[Multicam mode] + Enabled');
            }
        }
    }
}

function toggleVisOnSceneItem(sourceobj, visible) {
  obs.SetSceneItemProperties({ 'scene-name': sourceobj.scene, item: sourceobj.source, visible: false }, (err, data) => {
    errorhandler(err, data)
    if (visible) {
      obs.SetSceneItemProperties({ 'scene-name': sourceobj.scene, item: sourceobj.source, visible: true }, (err, data) => {
        console.log("Done showing " + sourceobj.source)
        errorhandler(err, data)
      });
    }
  });
}

function toggleVisOnSceneItemByTriggerSource(sourceobj, visible) {
  if (visible) {
    obs.GetSourceSettings({ sourceName: sourceobj.source }, (err, data) => {
      errorhandler(err, data)
      obs.SetSourceSettings({ sourceName: sourceobj.source, sourceSettings: { local_file: data.sourceSettings.local_file }})
    });
  }
}

function getRandomAudioClip(audiokey) {
  var list = audio[audiokey]
  var item = list[Math.floor(Math.random()*list.length)];
  return item
}

function playAudio(audiokey) {
  var filename = getRandomAudioClip(audiokey)
  console.log("Playing audio for " + audiokey + " file: " + filename)
  obs.SetSceneItemProperties({ 'scene-name': audio_source_name.scene, item: audio_source_name.source, visible: false }, (err, data) => {
    errorhandler(err, data)
    obs.SetSourceSettings({ sourceName: audio_source_name.source, sourceSettings: { local_file: filename } }, (err, data) => {
      errorhandler(err, data)
      obs.SetSceneItemProperties({ 'scene-name': audio_source_name.scene, item: audio_source_name.source, visible: true }, errorhandler);
    });
  });
}

function changePlayerKills(name, kills) {
  var sourceSettingsarr = { text: String(kills) }
  var triggered_sound = false
  if (name == playername && roundkills != kills) {
    obs.SetSourceSettings({ sourceName: killcount_text_source_name, sourceSettings: sourceSettingsarr }, (err, data) => {
      errorhandler(err, data)
      if (kills == 3) {
        playAudio('3kills')
        triggered_sound = true
      } else if (kills == 4) {
        playAudio('4kills')
        triggered_sound = true
      } else if (kills == 5) {
        toggleVisOnSceneItemByTriggerSource(ace_source_name, true)
        playAudio('ace')
        triggered_sound = true
      }
    });
    roundkills = kills;
  }
  return triggered_sound
}

function changePlayerActivity(name, activity) {
    if (name == playername) {
        if (activity != 'playing' && playing) {
            playing = false;
            obs.SetCurrentScene({'scene-name': useCSGOScene + ' pause'})
        } else if (activity == 'playing' && !playing) {
            playing = true;
            obs.SetCurrentScene({'scene-name': useCSGOScene})
        }
    }
}

function changePlayerHealth(name, health) {
  var newstate = false;
  var sourceSettingsarr = {}
  var sourceSettingsarrTwo = {}
  var sourceSettingsarrThree = {}
  if (name == playername) {
    if (health > 0 && dead) {
      newstate = true;
      dead = false;
      changePlayerKills(name, 0)
    } else if (health == 0 && !dead) {
      newstate = true;
      dead = true;
    } 
    if (newstate) {
      if (dead) {
        deathfx.dead.forEach(function(element) {
          obs.SetSourceSettings({ sourceName: element.source, sourceSettings: { file: element.file } }, errorhandler);
        });
      } else {
        deathfx.alive.forEach(function(element) {
          obs.SetSourceSettings({ sourceName: element.source, sourceSettings: { file: element.file } }, errorhandler);
        });
      }
    }
  }
}

function changeTeam(name, team) {
  if (name == playername) {
    if (isCounterTerrorist != true && team == 'CT') {
      isCounterTerrorist = true
    } else if (isCounterTerrorist != false && team == 'T') {
      isCounterTerrorist = false
    }
  }
}

function changeScore(newscore, team, dontReactOnNextScoreChange) {
  //console.log("IS CT " + isCounterTerrorist)
  if (newscore != score[team]) {
    console.log("OLD SCORE: " + score[team] + " NEW SCORE: " + newscore + "DONTREACT" + dontReactOnNextScoreChange)
    if (newscore < score[team]) {
      score[team] = newscore
      return
    } else {
      score[team] = newscore;
    }
    if ((dontReactOnNextScoreChange + 1) == newscore) {
      dontReactOnNextScoreChange = -1
      return
    }
    if (newscore == 0) {
      return
    }
    if (((isCounterTerrorist && team == 'team_ct') || (!isCounterTerrorist && team == 'team_t'))) {
      playAudio('round_win')
    }
  } 
}

function myTeam() {
  if (isCounterTerrorist) {
    return 'team_ct'
  }
  return 'team_t'
}


function parseCSGOData(incomingdata) {
  data = incomingdata
  var name = 'unknown'
  var triggered_sound = false
  if (data.hasOwnNestedProperty('player.name')) {
    name = data.player.name
  }
  if (data.hasOwnNestedProperty('player.team')) {
    changeTeam(name, data.player.team);
  }
  if (data.hasOwnNestedProperty('player.state.health')) {
    changePlayerHealth(name, data.player.state.health);
  }
  if (data.hasOwnNestedProperty('player.state.round_kills')) {
    triggered_sound = changePlayerKills(name, data.player.state.round_kills);
    console.log('triggered_sound: ' + triggered_sound)
    if (triggered_sound) {
      dontReactOnNextScoreChange = score[myTeam()]
    }
  }
  if (data.hasOwnNestedProperty('player.activity')) {
    changePlayerActivity(name, data.player.activity);
    if (data.player.activity == 'menu') {
      changePlayerKills(playername, 0)
      changePlayerHealth(playername, 100)
      changeScore(0, 'team_t')
      changeScore(0, 'team_ct')
    }
  }
  if (data.hasOwnNestedProperty('map.team_ct.score')) {
    changeScore(data.map.team_ct.score, 'team_ct', dontReactOnNextScoreChange);
  }
  if (data.hasOwnNestedProperty('map.team_t.score')) {
    changeScore(data.map.team_t.score, 'team_t', dontReactOnNextScoreChange);
  }
}

var server = http.createServer( function(req, res) {
    if (req.method == 'POST') {
        res.writeHead(200, {'Content-Type': 'text/html'});

        var body = '';
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function () {
              var jsondata = JSON.parse(body);
              parseCSGOData(jsondata);
              wss.clients.forEach(function each(ws) {
                ws.send(JSON.stringify(jsondata));
              });
                res.end( '' );
        });
    }
    else
    {
        console.log('[CSGO HTTP] Not expecting other request types...');
        res.writeHead(200, {'Content-Type': 'text/html'});
                var html = '<html><body>HTTP Server at http://' + host + ':' + port + '</body></html>';
        res.end(html);
    }

});

server.listen(httpserver_port, httpserver_host);
console.log('[CSGO HTTP] Listening at http://' + httpserver_host + ':' + httpserver_port);
