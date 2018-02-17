"use strict";
var http = require('http');
var fs = require('fs');
const WebSocket = require('ws');


var httpserver_port = 8080;
var httpserver_host = '192.168.35.104';
var remoteobs_host_port = '192.168.35.200:4444';
var websocket_server_port = 8081;
var playername = 'dmlr'

// END CONFIG

var killCamSettings = {}
var data = {}
var roundkills = 0
var dead = false
var playing = true

const OBSWebSocket = require('obs-websocket-js');
const obs = new OBSWebSocket();
const wss = new WebSocket.Server({ port: websocket_server_port });

// Eventlistener
obs.onConnectionOpened(() => {
  console.log('OBS Control: connected to OBS websocket');
  changePlayerKills(playername, 0)
  changePlayerHealth(playername, 100)
});

//obs.onSwitchScenes(data => {
//  console.log(data);
//});

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

function changePlayerKills(name, kills) {
  var sourceSettingsarr = { text: String(kills) }
  if (name == playername && roundkills != kills) {
    obs.SetSourceSettings({ sourceName: 'KILLCOUNT', sourceSettings: sourceSettingsarr }, (err, data) => {});
    roundkills = kills;
  }
}

function changePlayerActivity(name, activity) {
	if (name == playername) {
		if (!activity == 'playing' && playing) {
			playing = false;
			var sourceSettingsarr = { file: 'C:/Users/Daniel/Desktop/stream/dmlrpause15.mov' }
			obs.SetSourceSettings({ sourceName: 'LOGO', sourceSettings: sourceSettingsarr }, (err, data) => {});
		} else if (activity == 'playing' && !playing) {
			playing = true;
			var sourceSettingsarr = { file: 'C:/Users/Daniel/Desktop/stream/null.png' }
			obs.SetSourceSettings({ sourceName: 'LOGO', sourceSettings: sourceSettingsarr }, (err, data) => {});
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
         sourceSettingsarr = { file: 'C:/Users/Daniel/Desktop/stream/skull.png' }
         sourceSettingsarrTwo = { file: 'C:/Users/Daniel/Desktop/stream/crack.png' }
         sourceSettingsarrThree = { file: 'C:/Users/Daniel/Desktop/stream/blood.png' }
       } else {
         sourceSettingsarr = { file: 'C:/Users/Daniel/Desktop/stream/null.png' }
         sourceSettingsarrTwo = sourceSettingsarr
         sourceSettingsarrThree = sourceSettingsarr
       }
       obs.SetSourceSettings({ sourceName: 'DEATH', sourceSettings: sourceSettingsarr }, (err, data) => {});
       obs.SetSourceSettings({ sourceName: 'DEATH2', sourceSettings: sourceSettingsarrTwo }, (err, data) => {});
       obs.SetSourceSettings({ sourceName: 'DEATH3', sourceSettings: sourceSettingsarrThree }, (err, data) => {});
    }
  }
}

function parseCSGOData(incomingdata) {
  data = incomingdata
  var name = 'unknown'
  if (data.hasOwnNestedProperty('player.name')) {
    name = data.player.name
  }
  if (data.hasOwnNestedProperty('player.activity')) {
  	changePlayerActivity(name, data.player.state.activity);
  }
  if (data.hasOwnNestedProperty('player.state.health')) {
      changePlayerHealth(name, data.player.state.health);
  }
  if (data.hasOwnNestedProperty('player.state.round_kills')) {
    changePlayerKills(name, data.player.state.round_kills);
  }
  if (data.hasOwnNestedProperty('player.activity')) {
    if (data.player.activity == 'menu') {
      changePlayerKills(playername, 0)
      changePlayerHealth(playername, 100)
    }
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
