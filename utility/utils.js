
// xu ly chuoi
function validateString(aString) {
    aString = aString.toLowerCase();
    aString = aString.trim();
 
    return aString;
};

function isUserOnline(usernameToCheck, onlineUsers) {
    // kiem tra nguoi dung truc tuyen
    let userOnline = onlineUsers.find(user => user.username == usernameToCheck);
    if (userOnline != undefined) {
        if (userOnline.username == usernameToCheck) {
            return userOnline;
        };
        return false;
    }; 
    
    return false;
};

function getUserData(socket, onlineUsers) {
    let user = onlineUsers.find(user => user.socket == socket);
    if (user != undefined) {
        return user;
    };
    return false;
};

module.exports = {
    validateString,
    isUserOnline,
    getUserData
};