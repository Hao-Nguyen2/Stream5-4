const ROUTER = require('./routes/routes.js');
const PATH = require('path');


function useMiddlewares(APP, EXPRESS) {
    
    APP.set("view engine", 'ejs');

    // thiet lap public lam noi luu tru
    APP.use(EXPRESS.static(PATH.join(__dirname, 'public')));

   
    APP.use(EXPRESS.json());

    
    APP.use(EXPRESS.urlencoded({extended: false}));

  
    APP.use(ROUTER);
};

module.exports = {useMiddlewares};