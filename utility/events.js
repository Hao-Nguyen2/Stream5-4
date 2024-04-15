// dependencies
const COOKIE = require('cookie');
const UTILS = require('./utils.js');
const { v4: uuidv4 } = require('uuid');

let onlineUsers = [];
let allRooms = [];

// xu ly ket noi socket
function connectionEvent(socket, SignalSocket) {
    let thisUser = goOnline(socket);

    // bat dau cuoc goi
    socket.on("forwardCall", receivedPayload => forwardCall(socket, receivedPayload, thisUser));

    // thiet lap cuoc goi
    socket.on('offer', receivedPayload => forwardOffer(socket, receivedPayload));

    // phan hoi cuoc goi
    socket.on('answer', receivedPayload => forwardAnswer(socket, receivedPayload));

    // trao doi thong tin 
    socket.on('iceCandidate', receivedPayload => forwardIceCandidate(socket, receivedPayload));

    // tu choi tiep nhan cuoc goi
    socket.on('callReject', receivedPayload => endCall(socket, receivedPayload));

    // ngat ket noi
    socket.on("disconnecting", () => disconnecting(socket));

    socket.on("disconnect", cause => console.log("Socket Disconnected due to " + cause));
};


function forwardCall(socket, receivedPayload, thisUser) {
    //phan tich va xac thuc du lieu dau vao
    receivedPayload = JSON.parse(receivedPayload);
    receivedPayload.to = UTILS.validateString(receivedPayload.to);
    console.log("Calling " + receivedPayload.to + " from " + thisUser.username);

    // kiem tra nguoi nhan truc tuyen 
    let callReceiver = UTILS.isUserOnline(receivedPayload.to, onlineUsers);
    if(!callReceiver) {
        sendAck(socket, `receiver offline`);
        return;
    };
    sendAck(socket, `calling`);

    // nguoi nhan truc tuyen
    console.log(receivedPayload.to + " is Online. Creating room with it");

    // tao phong va them thanh vien
    let room = {
        roomId: uuidv4(),
        members: [thisUser.username, callReceiver.username]
    };

    console.log("Room created with roomID: " + room.roomId);
    
    allRooms.push(room);

    // moi nguoi dung tham gia phong
    socket.join(room.roomId);
    // cap nhat trang thai tham gia phong
    let userRecord = onlineUsers.find(user => user.username == thisUser.username);
    onlineUsers[onlineUsers.indexOf(userRecord)].roomJoined = room.roomId;
    
    // nguoi nhan duoc them vao phong
    callReceiver.socket.join(room.roomId);
    // cap nhat trang thai tham gia phong cua cac user
    userRecord = onlineUsers.find(user => user.username == callReceiver.username);
    onlineUsers[onlineUsers.indexOf(userRecord)].roomJoined = room.roomId;

    sendAck(socket, `Room ${room.roomId}`);
    sendAck(socket, `Waiting for ${callReceiver.username}'s response`);

    // kich hoat cuoc goi
    socket.to(room.roomId).emit("call", (JSON.stringify({
        from: thisUser.username, id: room.roomId
    })));
};


function forwardOffer(socket, receivedPayload) {
    receivedPayload = JSON.parse(receivedPayload);
    
    console.log("Request received to forward OFFER in room: " + receivedPayload.roomId);

    //kiem tra ton tai cua phong 
    if ((allRooms.find(room => room.roomId == receivedPayload.roomId)) != undefined) {
        socket.to(receivedPayload.roomId).emit('offer', (JSON.stringify(receivedPayload)));
        console.log("Offer forwarded into room.");
    } else {
        console.log("Room Id does not exists.");
        sendAck(socket, 'This room id does not exits. Offer sending failed.');
    };
};

function forwardAnswer(socket, receivedPayload) {
    console.log("Received answer");
    receivedPayload = JSON.parse(receivedPayload);

    // kiem tra ton tai cua phong
    if (doesRoomExist(receivedPayload.roomId)) {
      //nguoi goi nhan phan hoi tu nguoi nhan cuoc goi
        console.log("Room exists. forwarding answer");
        socket.to(receivedPayload.roomId).emit('answer', (JSON.stringify(receivedPayload)));
    } else {
        sendAck(socket, 'Room does not exist. Answer signalling failed !');
    };
};


function forwardIceCandidate(socket, receivedPayload) {
    receivedPayload = JSON.parse(receivedPayload);
    //kiem tra ton tai id phong
    if ((allRooms.find(room => room.roomId == receivedPayload.roomId)) != undefined) {
        socket.to(receivedPayload.roomId).emit('remoteIceCandidate', (JSON.stringify(receivedPayload)));
    } else {
        console.log("Room Id does not exists.");
        sendAck(socket, 'This room id does not exits. Ice forwarding failed.');
    };
};


function endCall(socket, receivedPayload) {
    console.log("EndCall fiunction exexcuting");
    receivedPayload = JSON.parse(receivedPayload);
    // kiem tra phong co ton tai 
    if (doesRoomExist(receivedPayload.roomId)) {
        socket.to(receivedPayload.roomId).emit('rejected', JSON.stringify({message: 'Rejected'}));
        let thisUser = UTILS.getUserData(socket, onlineUsers);
        if (thisUser == false) {
            console.log("endCall function line 135");
        };
        remove_member_from_room(receivedPayload.roomId, thisUser.username);
    };
};


function remove_member_from_room(roomid, thisMember) {
    // tim id phong hien tai
    let roomid_Index = allRooms.findIndex(room => room.roomId == roomid);

    // tim thanh vien trong phong
    let member_Index = allRooms[roomid_Index]?.members.findIndex(member => member == thisMember);

    // xoa thanh vien ra khoi phong
    allRooms[roomid_Index].members.splice(member_Index, 1);
    console.log(thisMember + " removed from a room");

    // kiem tra phong trong
    if (allRooms[roomid_Index].members.length < 1) {
        console.log("Room with id: " + allRooms[roomid_Index].roomId + " went silent. Deleting room..");
        // xoa phong
        allRooms.splice(roomid_Index, 1);
    };
};

function doesRoomExist(id) {
    let roomExist = allRooms.find(room => room.roomId == id);
    if (roomExist != undefined) {
        return true;
    };
    return false;
};

function validateSocketConnection(socket, next) {
    // check cookies
    if (!socket.request.headers.cookie) {
        next(new Error("Not Authorised."));
    };
    // xu ly cookies
    let cookies = socket.request.headers.cookie;
    cookies = COOKIE.parse(cookies);
    // kiem tra username
    if (!cookies.username) {
        console.log("Username not available in cookies. Rejecting socket connection.");
        socket.disconnect(true);
        next(new Error("Not Authorised."));
    };
    next();
};

function disconnecting(socket) {
    // tim nguoi dung dau trong onlineUSers
    let thisUser_Index = onlineUsers.findIndex(user => user.socket == socket);
    let thisUser = onlineUsers[thisUser_Index];
    console.log(thisUser.username + " disconnecting.");

    // kiem tra nguoi nay co tham gia khong va xoa ra khoi phong
    if (onlineUsers[thisUser_Index].roomJoined != null) {
        console.log("Removing "+thisUser.username+" from rooms.");
        remove_member_from_room(thisUser.roomJoined, thisUser.username);
    };

    // xoa nguoi nay ra khoi danh sach dang truc tuyen
    onlineUsers.splice(thisUser_Index, 1);
    console.log(thisUser.username + " disconnected.");
};

function goOnline(socket) {
    
    let cookies = COOKIE.parse(socket.request.headers.cookie);
    // khoi tao doi tuong nguoi dung
    let thisUser = {
        username: UTILS.validateString(cookies.username),
        socket: socket,
        roomJoined: null
    };
    //them vao ds dang truc tuyen
    onlineUsers.push(thisUser);
    console.log(cookies.username + " connected");
    // gui thong diep xac nhan cho client
    sendAck(socket, "Socket Connected.");

    return thisUser;
};

// gui thong diep toi client
function sendAck(socket, ackMsg) {
    let ack = {
        status: UTILS.validateString(ackMsg)
    };
    socket.emit("ack", JSON.stringify(ack));
};

// ----------------------------------------------------------------- E X P O R T ----------
module.exports = {
    connectionEvent, 
    validateSocketConnection, 
    allRooms, onlineUsers
};
