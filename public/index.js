// thiet lap ket noi socket
const SOCKET = io();

// thong tin ket noi
let receivingCall = [];
let activeCall = { 
    state: 'empty',
    instance: null,
    peer: null,
    roomId: null,
    myStream: null
};

// thiet lap RTC
let config = {
    iceServers: [
        {
            'urls': 'stun:stun.stunprotocol.org'
        }
    ]
};


let localVideo = document.getElementById('localVideo');
let peerVideo = document.getElementById('peerVideo');
let home = document.getElementById('home');
let callUpdate = document.getElementById('call-update');
let caller = document.getElementById('caller');
let callerP = document.getElementById('callee');
let callContainer = document.getElementById('callContainer');
let ringerName = document.getElementById('ringer-name');
let ringerWarning = document.getElementById('ringer-warning');

//ket thuc cuoc goi
document.getElementById("end").addEventListener("click", () => {
    if (activeCall.roomId != null) {
        let detail = {
            from: activeCall.peer,
            roomId: activeCall.roomId
        };
        rejectCall(detail);
    } else {
        resetCallData();
    };
});

// tro ve trang chu
handleView("home");

// khoi tao cuoc goi
document.getElementById('call').addEventListener('click', () => {    
    let callTo = document.getElementById('connectWith').value;
    callTo = callTo.trim();
    callTo = callTo.toLowerCase();
    SOCKET.emit('forwardCall', (JSON.stringify({ to: callTo })));
    activeCall.state = "precall";
    activeCall.peer = callTo;
});

//xu ly phan hoi cuoc goi
SOCKET.on('ack', (receivedPayload) => {
    receivedPayload = JSON.parse(receivedPayload);
    console.log("Acknowledgement: " + receivedPayload.status);

    if (receivedPayload.status == "receiver offline") {
        callUpdate.innerHTML = "User is Offline";
        handleView("home");
        resetCallData();

    } else if (receivedPayload.status == "rejected") {
        callerP.innerHTML = "call rejected";
        callerP.style.color = "maroon";
        handleView("home");
        resetCallData();

    } else if (receivedPayload.status == "calling") {
        if (activeCall.state == "precall") {
         
            activeCall.state = "calling";  
            activeCall.instance = new RTCPeerConnection(config); 
            
            callerP.innerHTML = "calling " + activeCall.peer;
            callerP.style.color = "black";     
            handleView("caller");
        };
    };
});

//xu ly tu choi ket thuc cuoc goi
SOCKET.on('rejected', (receivedPayload) => {
    if (activeCall.state == "calling") {
        console.log("Call rejected by " + activeCall.peer);
        resetCallData();
        handleView("home");
    } else if (activeCall.state == "active") {
        console.log("Call Ended");
        resetCallData();
        handleView("home");
    };
});

SOCKET.on('call', (receivedPayload) => {
    receivedPayload = JSON.parse(receivedPayload);
    console.log("Receiving call from " + receivedPayload.from);
    // kiem tra trang thai cuoc goi 
    if (activeCall.state != "empty") {
        // user on other call
        // show pop up with options 
        // to close this one and jump onto other one
        // or decline other one
    }
    receivingCall.push(receivedPayload.from);
    // show call UI
    showCallUI(receivedPayload);
});

SOCKET.on('offer', async (receivedPayload) => {
    receivedPayload = JSON.parse(receivedPayload);
    activeCall.roomId = receivedPayload.roomId;

    console.log("Offer received for roomId: " + receivedPayload.roomId);
    getCallDetail();

    if (activeCall.state == "calling") {

        // chuyen sang giao dien video 
        handleView("callContainer");

        //hien thi video 
        let peerVideo = document.getElementById('peerVideo');
        activeCall.instance.addEventListener('track', ({streams: [stream]}) => {
            
            console.log("Track received from peer");
            peerVideo.srcObject = stream;
        });

        // thiet lap mo ta
        console.log("Setting remote description");
        await activeCall.instance.setRemoteDescription(receivedPayload.offer);

        // them tracks 
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true, 
            video: { width: 300, height: 600, facingMode: "user"}
        });
        activeCall.myStream = stream;

        
        let localVideo = document.getElementById('localVideo');
        localVideo.srcObject = stream;

        
        stream.getTracks().forEach(track => activeCall.instance.addTrack(track, stream));

       
        console.log("Setting ice candidate handler");
        activeCall.instance.onicecandidate = e => {
            console.log("New Ice candidate emitted.");
            
            SOCKET.emit('iceCandidate', JSON.stringify({
                roomId: receivedPayload.roomId,
                ICE: e.candidate
            }));
        };

        // tao phan hoi
        console.log("creating answer");
        let answer = await activeCall.instance.createAnswer();
        console.log("Setting local description");
        activeCall.instance.setLocalDescription(answer);

        
        console.log("sending answer");
        SOCKET.emit('answer', (JSON.stringify({
            roomId: receivedPayload.roomId,
            answer: answer
        })));
        activeCall.state = "active";
    };
});

// them ICE vao ket noi
SOCKET.on('remoteIceCandidate', async (receivedPayload) => {
    receivedPayload = JSON.parse(receivedPayload);
    //kiem tra thiet lap mo ta
    if (activeCall.instance.remoteDescription != null) {
        await activeCall.instance.addIceCandidate(receivedPayload.ICE);
    } else {
        console.log("Ice candidate received from peer and ignored since Remote not set yet.");
    };
    console.log("Ice candidate received from peer and added to connection.");
});

//xu ly chap nhan cuoc cgoi
async function acceptCall(callData) {
    // hien thi giao dien video va an giao dien cuoc goi den
    handleView("callContainer");
    document.getElementById("ringer-container").style.left = "-100%";

    // cap nhat du lieu cuoc goi
    activeCall.state = 'pending';
    activeCall.from = callData.from,
    activeCall.roomId = callData.id,

    console.log("Call accepted from " + callData.from);
    
    // them ket noi 
    activeCall.instance = new RTCPeerConnection(config);;

    // nap luong du lieu
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 300, height: 600, facingMode: "user"}
    });
    activeCall.myStream = stream;
    
    localVideo.srcObject = stream;

    // them luong vao ket noi RTC
    stream.getTracks().forEach(track => activeCall.instance.addTrack(track, stream));

    // hien thi phan tu video cua nguoi doi dien
    activeCall.instance.addEventListener('track', ({streams: [stream]}) => {
       
        console.log("Track received from peer");
        peerVideo.srcObject = stream;
    });

    
    activeCall.instance.onicecandidate = e => {
        
        console.log("New Ice candidate emitted.");
        SOCKET.emit('iceCandidate', JSON.stringify({
            roomId: callData.id,
            ICE: e.candidate
        }));
    };

    // tao de nghi cuoc goi
    let offer = await activeCall.instance.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
    });

    // thiet lap mo ta de nghi
    await activeCall.instance.setLocalDescription(offer);

    // gui den nguoi dung kia 
    SOCKET.emit('offer', (JSON.stringify({
        roomId: callData.id,
        offer: offer
    })));

    // xu ly cau tra loi cua nguoi dung
    SOCKET.on('answer', async (receivedPayload) => {
        receivedPayload = JSON.parse(receivedPayload);
        console.log("Answer received from " + receivedPayload.roomId);
        if (receivedPayload.roomId == activeCall.roomId) {
            await activeCall.instance.setRemoteDescription(receivedPayload.answer);
            activeCall.state = 'active';
        } else {
            console.log("Room id of answer do not match with activeCall roomid")
        };
    });
};

// xu ly tu choi cuoc goi
function rejectCall(callData) {
    console.log("Rejecting call.");
    //xoa nguoi goi khoi ds cuoc goi
    receivingCall.splice(receivingCall.indexOf(callData.from), 1);
    SOCKET.emit('callReject', JSON.stringify({roomId: callData.roomId}));
    if (activeCall.instance != null) {
        // dong ket noi 
        activeCall.instance.close();
    };
    resetCallData();
};

// hien thi cuoc goi den 
function showCallUI(receivedPayload) {
    // thong bao cuoc goi tu ten cua nguoi goi
    ringerName.innerHTML = receivedPayload.from + " calling..";

    // chap nhan cuoc goi 
    let acceptBtn = document.getElementById("acceptBtn");
    acceptBtn.addEventListener('click', () => {
        clearInterval(ringerInterval);
        acceptCall(receivedPayload);
    });

    // tu choi cuoc goi
    let rejectBtn = document.getElementById('rejectBtn');
    rejectBtn.addEventListener('click', () => {
        
        document.getElementById("ringer-container").style.left = "-100%";
        rejectCall(receivedPayload);
    });

    // hien thi giao dien cuoc goi
    document.getElementById("ringer-container").style.left = "0%";

    // dem thoi gian chuong cuoc goi den 
    let i = 19;
    ringerInterval = setInterval(() => {
        i = i - 1;
        ringerWarning.innerHTML = "Missing call in " + i;
        if (i == 0) {
            clearInterval(ringerInterval);
            document.getElementById("ringer-container").style.left = "-100%";
            console.log("Missed Call.");
            rejectCall(receivedPayload);
        };
    }, 1000);    
};

//chi tiet cuoc goi
function getCallDetail() {
    console.log("Active Call details are: ");
    console.log("State: " + activeCall.state);
    console.log("RoomId: " + activeCall.roomId);
    console.log("Instance: " + activeCall.instance);
};

//xu ly chuyen doi giao dien
function handleView(element_to_lift) {

    if (element_to_lift == "caller") {
        callContainer.style.right = "-100%";
        home.style.right = "-100%";
        caller.style.right = "0%";

    } else if (element_to_lift == "home") {
        callContainer.style.right = "-100%";
        caller.style.right = "-100%";
        home.style.right = "0%";

    } else if (element_to_lift == "callContainer") {
        caller.style.right = "-100%";
        home.style.right = "-100%";
        callContainer.style.right = "0%";
    };

};

//thiet lap lai trang thai cuoc goi
function resetCallData() {
    activeCall.state = 'empty';
    if (activeCall.instance != null) {
        activeCall.instance.close();
    };
    activeCall.instance = null;
    activeCall.instance = null;
    activeCall.peer = null;
    activeCall.roomId = null;
    if (activeCall.myStream != null) {
        activeCall.myStream.getTracks().forEach(track => track.stop());
    };
    console.log("Active Call data cleared.");
    handleView('home');
};

