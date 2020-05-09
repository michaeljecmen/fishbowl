var express = require('express');
var app = express();
var serv = require('http').Server(app);

// app.get('/', function(req, res) {
//     res.sendFile(__dirname + '/client/index.html');
// });
app.use('/', express.static('client'));
app.use('/fishbowl', express.static('client/fishbowl'));

serv.listen(2000); // change this port whenever, currently we are hosting on localhost:2000
console.log('server started');

// globals for this module
var IDS_TO_NAMES = {};
var ROOMS = {}; // keeps track of cards and host for each room
var CODE_LEN = 4;

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
    var tmp = Math.floor(Math.random() * 100000); // 6 digit player id
    socket.name = 'player_' + tmp; // temp name
    console.log('socket connection, ' + socket.name);
    IDS_TO_NAMES[socket.id] = socket.name;
    socket.emit('your name', {
        name: socket.name
    }); // send player their name for display purposes (to everyone in lobby too)

    // Client to Server
    socket.on('join req', function(code, ack) {
        if(typeof io.sockets.adapter.rooms[code] == 'undefined' || io.sockets.adapter.rooms[code].length <= 0) {
            ack(false);
        } else {
            ack(true);
        }
    });

    // ALL ROOM JOINS GO THROUGH THIS FUNCTION
    socket.on('hard join', function(code) {
        // join the room, no questions asked
        console.log(socket.id + ' hard join ' + code);

        // if first in make the lobby
        if(typeof ROOMS[code] == 'undefined') {
            // make this player host if first in
            console.log('first in, making host');
            ROOMS[code] = {}; // create obj
            ROOMS[code]['host'] = socket.id;
            join_then_notify_roommates(socket, code);
            io.to(socket.id).emit('you are host');
        } else {
            // if lobby exists, get notified of all the players in the room
            var players_in_room = io.sockets.adapter.rooms[code].sockets;
            var lobby_info = {};
            for(var s in players_in_room) {
                if(players_in_room.hasOwnProperty(s)) {
                    lobby_info[s] = IDS_TO_NAMES[s];
                }
            }
            // send this data only to the new player
            console.log(socket.id + ' is being sent list of players in lobby');
            io.to(socket.id).emit('players in lobby', lobby_info);

            // then alert others of your presence
            join_then_notify_roommates(socket, code);
        }
    });
    socket.on('host req', function(ack) {
        var lobby = make_lobby_code(CODE_LEN);
        while(typeof ROOMS[lobby] != 'undefined') {
            // reroll until we have a unique code
            lobby = make_lobby_code(CODE_LEN);
        }
        console.log("creating lobby at code " + lobby);
        // now create the virtual url and io room for that
        app.use('/fishbowl/' + lobby, express.static('client/fishbowl/room'));
        ack(lobby);
        // only once page has reloaded and client has reconnected do we 
        // add their socket to the room. if there's a better solution to 
        // this not sure what it is. probably with cookies
    });
    socket.on('pname update', function(data) {
        socket.name = data.player_name;
        IDS_TO_NAMES[socket.id] = socket.name;
        // update those names in peoples lobbies
        io.to(data.lobby).emit('lobby name update', {
            id: socket.id,
            name: socket.name
        });
    });
    socket.on('disconnect', function() {
        // broadcast to all players, unfortunate performance hit
        // but can't figure out how to just broadcast to that player's lobby
        console.log('player dcd, here are their rooms: ' + socket.rooms);
        socket.broadcast.emit('DEBUG', socket.rooms);
        for(var r in socket.rooms) {
            if(socket.rooms.hasOwnProperty(r)) {
                // find the lobby room (fmt 'XXXX') and notify the 
            }
        }
        delete IDS_TO_NAMES[socket.id];
        socket.broadcast.emit('lobby player removed', {
            id: socket.id
        });
        // TODO find a way to unhost the url for that game when
        // last player DCs
    }); 
});

// join a room and notify those in the room of your presence (yourself included)
function join_then_notify_roommates(socket, code) {
    socket.join(code);
    // also notify others in the room of your presence (and yourself)
    io.to(code).emit('lobby player added', {
        name: socket.name,
        id: socket.id
    });
}

// gets current number of players in the provided lobby
function num_players(room) {
    var count = 0;
    for(var s in room) {
        if(room.hasOwnProperty(s)) {
            count++;
        }
    }
    return count;
}

// makes random char strings for lobby codes
function make_lobby_code(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var charactersLength = characters.length;
    for(var i = 0; i < length; i++) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

 
// // this function gets called continuously
// // have it update players names in the lobby
// setInterval(function(data) {
//     socket.emit('tick', {
//         pdata: SOCKET_LIST
//     });
// }, 1000/25); // 25 frames per second