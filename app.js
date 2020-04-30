var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000); // change this port whenever, currently we are hosting on localhost:2000
console.log('server started');

var SOCKET_LIST = {}; // player list
var NUM_SOCKETS = 0;

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
    NUM_SOCKETS++;
    socket.id = Math.random(); // player id
    console.log('socket connection, player_' + socket.id);
    socket.name = 'player_' + socket.id; // temp name

    // LOBBY SET UP
    // if(NUM_SOCKETS == 1) { 
        
    // }

    SOCKET_LIST[socket.id] = socket; // push into list

    // Client to Server
    socket.on('pname update', function(data) {
        console.log(socket.name + ' changed name to ' + data.player_name);
        socket.name = data.player_name;
    });
    socket.on('disconnect', function() {
        console.log(socket.name + ' disconnected');
        delete SOCKET_LIST[socket.id];
        NUM_SOCKETS--;
    });

    // Server to Client
    socket.emit('question', 'name?', function (answer) {
        console.log('new name: ' + answer);
    });
});

// // this function gets called continuously
// setInterval(function(data) {
//     var pack = []; // pack of all player data
//     for(var i in SOCKET_LIST) {
//         socket = SOCKET_LIST[i];
//     }
// }, 1000/25); // 25 frames per second