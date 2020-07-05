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
        ack(typeof io.sockets.adapter.rooms[code] != 'undefined' && io.sockets.adapter.rooms[code].length > 0);
    });
    socket.on('group console write', function(data) {
        io.to(data.room).emit('console write', data.msg);
    });
    socket.on('card submit', function(data) {
        ROOMS[data.room].cards.push(data.card);
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
            ROOMS[code]['cards'] = [];
            join_then_notify_roommates(socket, code);
            set_player_as_host(socket.id, code);
        } else {
            // if lobby exists, get notified of all the players in the room
            var room = io.sockets.adapter.rooms[code];
            var players_in_room =  room.sockets;
            var player_data = {};
            for(var s in players_in_room) {
                if(players_in_room.hasOwnProperty(s)) {
                    player_data[s] = IDS_TO_NAMES[s];
                }
            }
            // send this data only to the new player
            console.log(socket.id + ' is being sent list of players in lobby');
            lobby_info = {
                host: ROOMS[code].host,
                players: player_data
            };
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
    socket.on('writing phase req', function(data) {
        console.log(data.room + ' starting writing phase with ' + data.cards + ' cards');
        io.to(data.room).emit('begin writing phase', data.cards);
    });
    socket.on('disconnect', function() {
        // socket has left all rooms
        console.log('socket ' + socket.id + ' disconnected');
        delete IDS_TO_NAMES[socket.id];
    }); 
    socket.on('disconnecting', function(){
        // socket has not yet left all rooms
        for(var room in socket.rooms) {
            // find room code and emit to group
            // also if host, find a new one
            if(room.length == CODE_LEN) {
                // if its a room
                io.to(room).emit('lobby player removed', socket.id);
                if(ROOMS[room].host == socket.id) {
                    // if we are the host of this room
                    var other_players = io.sockets.adapter.rooms[room].sockets;
                    // loop over these homies and pick the first one, tell them
                    // that they're the host
                    var new_host_found = false;
                    for(var sock in other_players) {
                        if(other_players.hasOwnProperty(sock) && sock != socket.id) {
                            set_player_as_host(sock, room);
                            new_host_found = true;
                            break;
                        }
                    }
                    if(!new_host_found) {
                        // if nobody else in lobby then delete the room
                        delete ROOMS[room];
                        // TODO find a way to unhost the url for that game when
                        // last player DCs
                    }
                }
            }
        }
    });
});

// set this player as the host of this room, inform them,
// and inform the other players in the room as well
function set_player_as_host(host, room) {
    ROOMS[room]['host'] = host;
    io.to(room).emit('this person is host', host);
}

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