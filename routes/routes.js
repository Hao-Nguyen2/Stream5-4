
const EXPRESS = require('express');
const UTILS = require('../utility/utils.js');

// khoi tao dinh tuyen 
const ROUTER = EXPRESS.Router();


ROUTER.get('/', (request, response) => {
    response.clearCookie('username');
    response.render('login.ejs');
});

ROUTER.post('/dashboard', (request, response) => {    
    
    let username = request.body.username;

 
    username = UTILS.validateString(username);

    //thiet lap cookie
    response.cookie('username', username, {sameSite: 'lax', httpOnly: true, secure: false});
    response.render('index.ejs', {username: username});
});

ROUTER.get('/signout', (request, response) => {
    response.redirect('/');
});

module.exports = ROUTER;