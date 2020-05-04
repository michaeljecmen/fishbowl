var express = require('express');
var app = express();
var serv = require('http').Server(app);

// app.get('/', function(req, res) {
//     res.sendFile(__dirname + '/client/index.html');
// });
app.use('/', express.static('client'));
app.use('/fishbowl', express.static('client/fishbowl'));

// replace the '/fishbowl/room' below with '/fishbowl/RMCODE', host many virt urls on same folder
app.use('/fishbowl/room', express.static('client/fishbowl/room'));

serv.listen(2000); // change this port whenever, currently we are hosting on localhost:2000
console.log('server started');

var SOCKET_LIST = {}; // player list
var NUM_SOCKETS = 0;
var CODE_LEN = 4;

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
    NUM_SOCKETS++;
    socket.id = Math.floor(Math.random() * 100000); // 6 digit player id
    socket.name = 'player_' + socket.id; // temp name
    console.log('socket connection, ' + socket.name);
    socket.emit('your name', {
        name: socket.name
    }); // send player their name for display purposes (to everyone in lobby too)
    socket.broadcast.emit('lobby player added', {
        name: socket.name,
        id: socket.id
    });
    SOCKET_LIST[socket.id] = socket; // push into list

    // LOBBY SET UP
    // if(NUM_SOCKETS == 1) { 
        
    // }

    // Client to Server
    socket.on('pname update', function(data) {
        console.log(socket.name + ' changed name to ' + data.player_name);
        socket.name = data.player_name;
        // update those names in peoples lobbies
        socket.broadcast.emit('lobby name update', {
            id: socket.id,
            name: socket.name
        });
    });
    socket.on('disconnect', function() {
        console.log(socket.name + ' disconnected');
        socket.broadcast.emit('lobby player removed', {
            id: socket.id
        });
        delete SOCKET_LIST[socket.id];
        NUM_SOCKETS--;
    });
});

// makes random char strings for lobby codes
function make_lobby_code(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
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