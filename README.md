# csgo-obscontrol
Trigger changes in OBS based on CSGO ingame actions

This is still a PoC that actually as of today works and the outcome can be viewed on: http://twitch.tv/dmlr_

As of today it does the following:
- Identify if CSGO is played using multicam mode or single cam mode (we sometimes play with more than one camera on the stream)
- In any state other than "playing" it switches to a pause-scene (that means the pause scene is showed during map loading, in menus etc)
- Modifies a killcounter in OBS that shows current number of kills in OBS
- Modify Sources in OBS whenever the player is dead (to show cool blood-textures etc).
- Play sound and/or video whenever the player hits 3, 4 and 5 (ace) kills.
- Play sound when the team of the player win the round.

# CSGO:
CSGO has two modes for sending ingame actions to remote endpoint:
- As a player, it sends the data that the player actually can see in the game (your own health and state etc). When dead it sends data about the person you are spectating or can see in the game. This is to avoid that this data is of any advantage to the player if used incorrectly.
- As an observer all data is send to the remote endpoint.

Almost all streamers play the game instead of using observer mode so the plan is to make a central service that can be used for a whole team to enable multicam actions and enable features for all players in a single stream.

# Todo:
- Code cleanup
- Make the code useful for others
- Instructions of how to configure + config file
- Add web UI to control csgo-obscontrol (and in return OBS) using the started Websocket server.
