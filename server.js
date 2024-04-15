
const EXPRESS = require('express');
const SOCKETIO = require('socket.io');


const HTTP = require('http');
const PORT = process.env.PORT || 3000;


const EVENTS = require('./utility/events.js');
const MIDDLEWARES = require('./middlewares.js');
 

const APP = EXPRESS();


const SERVER = HTTP.createServer(APP);

MIDDLEWARES.useMiddlewares(APP, EXPRESS);

//tao 1 server Socket.IO de xu ly ket noi
const SignalSocket = SOCKETIO(SERVER);

// xac thuc ket noi
SignalSocket.use((socket, next) => EVENTS.validateSocketConnection(socket, next));


SERVER.listen(PORT, () => console.log("Listening.........."));

// xu ly khi ket noi
SignalSocket.on('connection', socket => EVENTS.connectionEvent(socket, SignalSocket));
