
// server side file handles all authentication and every helper function for server that doesnt involve messages or api

const url = require('url')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose() //verbose provides more detailed stack trace
const db = new sqlite3.Database('data/db_ChatServer.db')


const CONSTRAINT_1 = 1;     //Username first character is a letter -> must match client side
const CONSTRAINT_2 = 2;     //Username consists of only letters and numbers -> must match client side
const CONSTRAINT_3 = 4;     //Username is unique and is not the same as an existing user -> must match client side
const CONSTRAINT_4 = 8;     //Username is less than MAX_CHAR characters -> must match client side
const MAX_CHAR = 50;        // max char of username must match client side
const SC_DEBUG = 0;         // debug for this file

/*
    allowedUsersServer - session authentication store
    global key value store for valid users signed into chat server session,
    must be signed in and out in this store implicitly in this file for passing authentication
    obj = {password: password for this userid, role: application privilege for this userid, count: depricated integer counter for this user}
*/
let allowedUsersServer = {};

const PRINT_BREAK_S = '\n------------------------------------------------------'
const PRINT_BREAK_E = '------------------------------------------------------\n'

// function returns a list of usernames to the server
exports.getAllUsers = function() {
    if (SC_DEBUG) console.log('\nrSERVER getting justUsers ');

    return new Promise((resolve, reject) => {
        db.all("SELECT userid FROM users", function(err, rows) {
            if (err) {
                console.error("Error in getAllUsers:", err);
                reject(err);
            } else {
                let userList = rows.map(getUser => getUser.userid);
                for (const user of userList) {
                    if (SC_DEBUG) console.log('users: ' + user);
                }
                resolve(userList);
            }
        });
    });
};

// function returns an object with a code and overall boolean value based on the username creation attempt and constraints the application makes for new usernames
exports.authenticateUser = function(clientUsername,allUsernames) {
    if(SC_DEBUG)console.log('\nrSERVER authenticatingUser: ' + clientUsername)
    let firstChar = clientUsername.charAt(0);
    let onlyLetters = /^[a-zA-Z]+$/;    //https://www.geeksforgeeks.org/javascript-program-to-check-if-a-string-contains-only-alphabetic-characters/
    let onlyLettersAndNumbers = /^[a-zA-Z0-9]+$/;       //https://www.w3resource.com/javascript/form/all-numbers.php

    // valid username 1: first character is a letter
    let validNameConstraint_1 = clientUsername.charAt(0).match(onlyLetters) !== null;

    // valid username 2: username consists of only letters and numbers
    let validNameConstraint_2 = clientUsername.match(onlyLettersAndNumbers) !== null;

    // valid username 3: username is unique and is not the same as an existing user
    let validNameConstraint_3 = !allUsernames.includes(clientUsername);

    // contraint 4 is max char for username constraint MAX_CHAR
    let validNameConstraint_4 = clientUsername.length < MAX_CHAR;

    if(SC_DEBUG){
        console.log(`\nAUTHENTICATING USERNAME:                                  ${clientUsername}`)
        console.log(`Username first character is a letter:                       ${validNameConstraint_1}`)
        console.log(`Username consists of only letters and numbers:              ${validNameConstraint_2}`)
        console.log(`Username is unique and is not the same as an existing user: ${validNameConstraint_3}`)
        console.log(`Username is less than ${MAX_CHAR} characters:                        ${validNameConstraint_4}`)
    }

    let validCode = 0; // response code to client to indicate what constraint wasnt met
    let register = validNameConstraint_1 && validNameConstraint_2 && validNameConstraint_3 && validNameConstraint_4; // boolean for registering userid in server db -> important

     if(validNameConstraint_1){
         validCode += CONSTRAINT_1;
     }
     if(validNameConstraint_2){
         validCode += CONSTRAINT_2;
     }
     if(validNameConstraint_3){
         validCode += CONSTRAINT_3;
     }
     if(validNameConstraint_4){
         validCode += CONSTRAINT_4;
     }

     // Return an object with the code and the final boolean value
     return { code: validCode, register: register };
};

// register user and their password into users database
exports.registerUser = async function(user) {
    if (SC_DEBUG) console.log('\nscSERVER registering User ' + user.userid);
    return new Promise((resolve, reject) => {
        db.all(`INSERT INTO users VALUES('${user.userid}','${user.password}','guest')`, function (err, rows) {
            if (err) {
                console.error("Error inserting user to the database ", err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
};


// decryption function for base64 encryption. returns decrypted userid and password in single object
exports.extractAuthData = function(authHeader){
    var tmp = authHeader.split(' ')

    // create a buffer and tell it the data coming in is base64
    var buf = Buffer.from(tmp[1], 'base64');

    // read it back out as a string
    //should look like 'user:password'
    var plain_auth = buf.toString()

    //extract the userid and password as separate strings
    var credentials = plain_auth.split(':') // split on a ':' char
    var username = credentials[0]
    var password = credentials[1]

    return({username: username, password: password})
}


// master authentication function : protects pages from being navigated to when they shouldnt have access and redirects if not authenticated and not already at main landing page
exports.authenticateMiddleware = function(req, res, next) {
    if(SC_DEBUG)console.log('\nrSERVER authenticateMiddleware (user_id user_password)')

    let userData;   // object for username password extracted from post method auth header
    const auth = req.headers.authorization; // extract auth header from request

    if(auth){ // client sign in from landing page sending authorization header after filling signin form in post request /signin (see clientControl.js)
        userData = module.exports.extractAuthData(auth) // utility function in this file for decrypting auth header base64 encryption
        req.user_id = userData.username; // build request with authenticated user data
        req.user_password = userData.password;
        if(SC_DEBUG){
            console.log(PRINT_BREAK_S)
            console.log(`POST REQUEST /signin attempt for user: ${req.user_id} `);
            console.log(PRINT_BREAK_E)
        }

        if(allowedUsersServer[req.user_id]){ // catch if user already signed in

            // if that userid signed it but incorrect password will say incorrect password. If correct login will say already signed in
            if(allowedUsersServer[req.user_id].password===req.user_password){
                if(SC_DEBUG){
                    console.log(PRINT_BREAK_S)
                    console.log(`        * FAILED SIGNIN - USER ALREADY SIGNED IN : ${req.user_id} *`)
                    console.log(PRINT_BREAK_E)
                }
                res.status(401).json({ error: ` USER ALREADY SIGNED IN : ${req.user_id} ` });
            } else{
                if(SC_DEBUG){
                    console.log(PRINT_BREAK_S)
                    console.log(`        * FAILED SIGNIN - INCORRECT PASSWORD OR USERNAME : ${req.user_id} *`)
                    console.log(PRINT_BREAK_E)
                }
                res.status(401).json({ error: ` INCORRECT PASSWORD OR USERNAME : ${req.user_id} ` });
            }
        } else{
            // send to next middleware function
            next();
        }
    }
    else if(req.query.auth){ // auth exists in reqest query = cirvumnavigate signin and rendering chat server page or admin page

        let userAuthData = module.exports.extractAuthData(`Basic ${req.query.auth}`)

        /*
        Here to block request with valid auth in url but no prior middleware data built in request
        eg in get request with valid user auth encryption:
            http://localhost:3000/chatServer?auth=***************=
            http://localhost:3000/admin?auth=****************=
        and user data not in global key:value store for current chat server session allowedUsersServer
        */
        if(!allowedUsersServer[userAuthData.username]){
            console.log(PRINT_BREAK_S)
            console.log(`NO GET ACCESS. REDIRECTING USER: ${userAuthData.username}`)
            console.log(PRINT_BREAK_E)
            res.redirect('/chatClient.html');
            res.end();
            return;
        }

        if(SC_DEBUG){
            console.log(PRINT_BREAK_S)
            console.log(`client GET REQUEST for user: ${userAuthData.username} ... confirming authentication password `)
            console.log(PRINT_BREAK_E)
        }

        let path = req.url.split('?'); // req url disected for request data
        console.log(PRINT_BREAK_S)
        console.log('             * AUTHENTICATION MIDDLEWARE * ')
        // if password in current server session matches get request authentication header password - happens if accessor has auth data in get request, here checks if the server has record of them being signed in
        if(allowedUsersServer[userAuthData.username].password===userAuthData.password){ // if they are signed in and has auth data in get request
            req.user_id = userAuthData.username;

            if(path[0]==='/admin'){ // get request to access admin
                // cannot block here because rendering issue with handlebars inside exports function on middleware with builtup request
                req.user_role = allowedUsersServer[userAuthData.username].role;
                console.log('             GET: /admin ')
                console.log('         user ID: ' + userAuthData.username)
                console.log(' user Priviledge: ' + req.user_role)
                console.log(PRINT_BREAK_E)
                next();
            } else if (path[0]==='/chatServer'){ // get request to access chatServer
                console.log('             GET: /chatServer ')
                console.log('         user ID: ' + userAuthData.username)
                console.log(PRINT_BREAK_E)
                next();
            } else{ // get requests made only for admin or chatServer others are failed and redirected
                console.log(`           * GET: ${path[0]}  FAILED *`)
                console.log(`REDIRECTING USER: ${userAuthData.username}`)
                console.log(PRINT_BREAK_E)
                res.redirect('/chatClient.html');
                res.end();
                return;
            }
        }
        else{   // attempted access of application with valid authentication but attempting to bypass signin middleware where server stores chat server session users signed in
            console.log(`             * GET: ${path[0]}  FAILED *`)
            console.log(`USER NOT SIGNED IN: ${userAuthData.username}`)
            console.log(`                    REDIRECTING CLIENT`)
            console.log(PRINT_BREAK_E)
            res.redirect('/chatClient.html');
            res.end();
            return;
        }

    }else{ // no auth header in post request (signin), no auth data in get request.
        if(SC_DEBUG){
            console.log(PRINT_BREAK_S)
            console.log(`* FAILED AUTHORIZATION - ATTEMPTED NAVIGATION WITH NO CLIENT DATA *`)
            console.log(PRINT_BREAK_E)
        }
        res.redirect('/chatClient.html');
        res.end();
        return;
    }
}

// for signing in
exports.signin = function(req, res, next) {
    if(SC_DEBUG)console.log('\nrSERVER SIGNIN')
    if(!req.user_id || !req.user_password){
        res.status(401).json({ error: ` NO USERID OR PASSWORD TO AUTHENTICATE ` });
        return;
    }

    let authorized = false

    //check database users table for user
    // adding users here so next time request is made and storing
    db.all("SELECT userid, password, role FROM users", function(err, rows) {
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].userid == req.user_id && rows[i].password == req.user_password) {

                 allowedUsersServer[req.user_id] = {password:req.user_password, role: rows[i].role, count: 0}

                 req.user_role = rows[i].role;
                 authorized = true;
            }
          }
          if (!authorized) {
            if(SC_DEBUG)console.log(`* SIGNIN ATTEMPT: ${req.user_id} userid or password invalid *`)
            res.status(401).json({ error: ` USERID OR PASSWORD INVALID ` });


          } else{
            if(SC_DEBUG)console.log(`* SIGNIN ATTEMPT: ${req.user_id} valid *`)
            res.status(200).end();
          }
    })
 }

 exports.signOutUser = function(userid){
     if(SC_DEBUG)console.log('\nrSERVER signOutUser: ' + userid)
     if(allowedUsersServer[userid]){
         delete allowedUsersServer[userid];
         if(SC_DEBUG)console.log(`  * chat server session - user signout successful: ${userid} *`)
     } else{
         if(SC_DEBUG)console.log(`  * chat server session - user already signed out: ${userid} *`)
     }
 }

exports.allUserData = async function(req, res) {
    if(SC_DEBUG)console.log('\nrSERVER allUserData ')
    module.exports.signOutUser(req.user_id) // attempt second signout - latency issues with io disconnect and no issues to signout twice (security more important)
    if(!req.user_role){ // if navigated here somehow without middleware request building user data
        res.redirect('/chatClient.html');
        res.end()
        return;
    }
    try {
        if(SC_DEBUG)console.log('userrole: ' + req.user_role)
        if(req.user_role === 'admin') {
            // If the user is an admin, fetch all user data and chat history
            db.all("SELECT userid, password, role FROM users", function(err, users) {
                if(SC_DEBUG)console.log('User Data for #' + users.length);
                // Fetch all message history from chat_data
                db.all("SELECT mid,userid, msg, type, access FROM chat_data", function(err, messages) {
                    res.render('v3', {userData: users, messageData: messages}); // v3 is admin page rendered with data
                });
            });
        } else {
            // v4 is page for users attempting to access privilidged admin page without admin authentication
            res.render('v4',{userid: req.user_id});
        }


    } catch (error) {
        console.log('rSERVER ERROR loading userdata : ' + error);
    }
}
