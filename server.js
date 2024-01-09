/****************************************************************************************************************************************
NAME:
	MICHAEL ANASTASAKIS
	101047439
	COMP2406-A

PURPOSE:
	COMP 2406 - Fall 2023 FINAL PROJECT

PROGRAM FUNCTIONALITY:
    The application is a chat server designed to handle real-time communication between connected clients.
    Clients can send messages, including images and GIFs, to the server, which stores the chat data in a database.
    The server also manages temporary logs of messages for clients that have disconnected and aims to update the
    main chat database when clients reconnect. The server utilizes various events, such as 'storeClientData' and
    'waitForClientsResponse,' to coordinate actions between the server and clients, ensuring data consistency and
    integrity. Additionally, there are features to handle user exits, such as storing local message history
    and updating user visibility in the chat. The application focuses on maintaining a seamless and persistent
    chat experience for users.


FILE:
	server.js

INSTRUCTIONS:
    >npm install
    to install npm modules dependencies listed in package.json file
    Then launch this server:
    >node server.js

    To test open several browsers to: http://localhost:3000/chatClient.html

***************************************************************************************************************************************/

/**************************************************************************************************************************************

{ SERVER }

***************************************************************************************************************************************/

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const fs = require('fs');
const url = require('url');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const hbs = require('hbs') //now we need this to do partials

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const VALID_USERID = 57;
const ADMIN_ID = 'fisto'
const S_DEBUG = 0;

const BAD_GIF = 'BADRESPONSE'; // if bad response
const PRIVATE = 'PRIVATE'       // private message type
const PUBLIC = 'PUBLIC'         // public message type
const DELETE = '';
const PRINT_BREAK_S = '\n----------------------------------------------------------------'
const PRINT_BREAK_E = '----------------------------------------------------------------\n'

const PORT = process.argv[2] || process.env.PORT || 3000 //useful if you want to specify port through environment variable                                               //or command-line arguments

const ROOT_DIR = 'html' //dir to serve static files from

var routesClients = require('./routes/serverClients');
var routesAPI = require('./routes/serverAPI');
var routesMessages = require('./routes/serverMessageData');

let allUsersServer = {}; //allUsersServer global socketid:username key:value store
let clientCount = 0;
let activeUserCount = 0;

const MIME_TYPES = {
  'css': 'text/css',
  'gif': 'image/gif',
  'htm': 'text/html',
  'html': 'text/html',
  'ico': 'image/x-icon',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'txt': 'text/plain'
}

function get_mime(filename) {
  for (let ext in MIME_TYPES) {
    if (filename.indexOf(ext, filename.length - ext.length) !== -1) {
      return MIME_TYPES[ext]
    }
  }
  return MIME_TYPES['txt']
}

server.listen(PORT) //start http server listening on PORT

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs'); //use hbs handlebars wrapper

app.use(express.static(path.join(__dirname, 'styles')));

// Define a middleware function to skip logging for specific requests
const logRequestMethod = (req, res, next) => {
    // Check if the request URL contains sensitive information
    const checkUrl = req.url.split('?')
    let log;
    switch(checkUrl[0]){ // only log these requests - omit src files loaded on each rendering aswell as auth url w encryption
        case '/chatClient.html':
        case '/chatClient':
        case '/':
        case '/index.html':
        case '/chatServer':
        case '/admin':
        case '/signin':
        case '/createUser':
        case '/gif':
            log = checkUrl[0];
            break;
    }
    if(log){
        let colour = '\x1b[0m';
        switch(Math.floor(res.statusCode / 100)){
            case 2:
                colour = '\x1b[32m'; // success
                break;
            case 4:
                colour = '\x1b[31m'; // client err
                break;
            case 5:
                colour = '\x1b[33m'; // server err
                break;
        }
        const status = colour + res.statusCode + '\x1b[0m'
        console.log(`${req.method} ${log} ${status}`)
    }
    next();
};

app.use(logRequestMethod); // custom logging
app.use(favicon(path.join(__dirname, 'client', 'favicon.ico')));
app.use(express.static(__dirname + '/client')); // static server -> client data

// gif api fetch
app.get('/gif*', (req, res) => {
    if(S_DEBUG)console.log('\nGIF request: ' + req.url);
    routesAPI.getGIF(req, res); // const bad_gif = {title: 'BADRESPONSE', url: ''} // if no wifi or api server access
                        
});

// main landing
app.get(['/','/chatClient.html', '/chatClient', '/index.html'], function (req, res) {
    if(S_DEBUG)console.log('\nSERVER get /chatClient rendering landing page')
    res.render('v1'); // render main landing page
});

app.use(express.json()); // for parsing json
app.post('/createUser', async function(req, res){ // get create user
  if(S_DEBUG)console.log('\nSERVER post /createUser')
  try{
      const allUsers = await routesClients.getAllUsers();
      const { user } = req.body; // user: {userid, password}
      const createUserResObj = routesClients.authenticateUser(user.userid,allUsers); // named authUser should be named something else only checks if username already exists in db
      if(S_DEBUG)console.log('createUser response code: ' + createUserResObj.code );
      if(createUserResObj.register){
          await routesClients.registerUser(user); // register in db user {userid,password}
      }
      const resCode = createUserResObj.code;
      res.status(200).json({ resCode });
  } catch(error){
      console.error('createUser error: ' + error);
      res.status(500);
  }
});

app.use(routesClients.authenticateMiddleware); // protects pages from being navigated to when they shouldnt
app.post('/signin',routesClients.signin);

app.get('/chatServer*', function(req, res) {
    if(S_DEBUG)console.log('\nSERVER get /chatServer')
    res.render('v2',{username:req.user_id}); // Render the view for authenticated users
});
app.get('/admin*', routesClients.allUserData);
app.use(logRequestMethod); // custom logging

// when a client enters chat server page, src file waitingClient.js is loaded, socket connected and paired with that userid their authentication to interact with server
io.on('connection', function(socket) {
        /*
        client socket connects to server and all code outside a socket.on event executes
        */
        console.log(PRINT_BREAK_S);
        console.log('* INITIALIZING CLIENT SOCKET CONNECTION *')
        clientCount++; // increment number of connected clients

        socket.emit('initClient',activeUserCount); // send the active user count as a socket event

        const allClientSockets = Object.keys(allUsersServer);
        // load client side socket.id : username linked pair user data
        for(let i = 0; i < allClientSockets.length; i++){
            socket.emit('updateAllUsersClient',allClientSockets[i],allUsersServer[allClientSockets[i]]);
        }

        /*
            socket.on events executes when the corresponding socket event id is emitted
        */
        // post response to initClient recieved when client loads username data and sends their constant global USERID value
        socket.on('initClientResponse',async function(clientUsername){
            console.log(`   ... new waiting client: ${clientUsername}`)
            allUsersServer[socket.id] = clientUsername; // store active users in global table

            // broadcast to all users in server a new user entered and they can communicate with them (private communication enabled)
            socket.broadcast.emit('updateAllUsersClient',socket.id,clientUsername);

            // get session id of this user for final response
            const userSessionData = await routesMessages.getUserSession(clientUsername)
            // returns obj[] of obj = {mid, userid, msg, type, access}
            if(userSessionData){
                // LOAD USER SESSION HERE
                console.log(`   ... loading ${clientUsername} previous session returned ${userSessionData.length} messages`)
                socket.emit('loadUserSession', userSessionData)
            }
            else{
                console.log('SERVERio getUserSession returned nothing')
                const err = 'server failed to load previous user session from db';
                socket.emit('serverSaysError',err)
            }
            activeUserCount++; // increment number of users
            console.log(`   ... client ${clientUsername} has successfully connected to CHAT SERVER`)
            console.log('\n* UPDATED SERVER - current active user count: ' + activeUserCount )
            console.log('                 - current active users are : ' + Object.values(allUsersServer) );
            console.log(PRINT_BREAK_E);
        })

        /*
            one function from client to evaluate message type and content exluding gifs, to log data, return priviledged message data ONLY to valid recipient
        */
        socket.on('clientSays', async function (clientSender,message) {
            console.log(`\n  message *FROM: ${clientSender}`)
            if(S_DEBUG)console.log(`socketCmp *FROM: ${allUsersServer[socket.id]}`)
            console.log(`   message     : ${message}\n`)
            try {
                /*
                *** evaluatedMsg  ***
                ->disects the user message
                ->logs message in the server database
                ->constructs an object to be returned based on contents of the message and the unique message id in the database

                ->message data: {publicData | recipientData | senderData} has the following attributes:
                            mid: mid number,
                            sender: sender of message,
                            messageBody: message body with bolding
                */

                const evaluatedMsg = await routesMessages.evaluateMessage(clientSender,message,allUsersServer); // see /routes/serverMessageData.js for implementation
                if(S_DEBUG)console.log(PRINT_BREAK_S);
                if(S_DEBUG)console.log('msgData LOGGED:')
                if(S_DEBUG)console.log(evaluatedMsg)
                if(S_DEBUG)console.log(PRINT_BREAK_S);

                switch(evaluatedMsg.type){

                    case PRIVATE: // message is Private type
                        if(!evaluatedMsg.senderData){
                            throw new Error('PRIVATE w. NO evaluatedMsg.senderData');
                        }
                        // emit unformatted message to sender first
                        socket.emit('serverSaysPrivateToSender', evaluatedMsg.senderData); // send formatted w. no other users in pm group shown
                        // if recipients of private message (pm not failed completely)
                        if(evaluatedMsg.recipientData && evaluatedMsg.recipients){
                            const recipients = evaluatedMsg.recipients; // == array of socket ids
                            for(let i = 0; i<recipients.length; ++i){ // emitting directly to socket no io.emit for security
                                io.to(recipients[i]).emit('serverSaysPrivate', evaluatedMsg.recipientData); // send formatted w. no other users in pm group shown
                            }
                        }
                        break;

                    case PUBLIC: // message is public type
                        if(!evaluatedMsg.publicData){
                            throw new Error('PUBLIC w. NO evaluatedMsg publicData');
                        }
                        // emit to all users puplic socket event
                        io.emit('serverSaysPublic',evaluatedMsg.publicData);
                        break;

                    default: // error message type is not assigned and error occurring
                        const err = 'evaluatedMsg.type INVALID'
                        socket.emit('serverSaysError',err);
                        throw new Error(err);
                        break;
                }
                if(S_DEBUG)console.log(PRINT_BREAK_S);

            } catch (error) {
                console.error('clientSays error occurred:', error);
                console.error(error.stack); // all nested catch errors
            }
        });

        // this event comes right from api response from CLIENT not server api event
        socket.on('displayGifs', async function(clientSender,gifs,gifName){
            console.log(`\ngif FROM: ${clientSender}`)
            console.log(`gif     : ${gifName}\n`)
            try{
                const evaluatedGIF = await routesMessages.evaluateGIF(clientSender,gifs,gifName); // see /routes/serverMessageData.js for implementation
                //const gifData = {mmid: mMID, msg: message, gmid: gMID, sender: clientSender, gifs: gifs, giftype: type}; // return is both messages data
                if(evaluatedGIF){
                    io.emit('serverDisplayGifs', evaluatedGIF)
                } else{
                    let err = 'evaluatedGIF ERROR'
                    socket.emit('serverSaysError',err)
                }
            }catch(error){
                console.error('displayGifs error: ',error)
                socket.emit('serverSaysError', error)
            }
        });

        // delete all rows in user_visibility db with this userid -> does not affect logged messages in chat_data just visibile messages for one user
        socket.on('clearUserSession', async function(clientUsername){
            if(allUsersServer[socket.id]===clientUsername){ // priviledged handling
                console.log('\nSERVER ' + clientUsername + ' clears chat history')
                await routesMessages.clearUserSession(clientUsername)
            } else{
                console.log('\nSERVER invalid socket event: clearUserSession')
            }
        });

        // on client unloading chat server page, all visible messages at exit stored (see activeUser.js)
        socket.on('storeUserSession', async function(clientUsername, midStore){
            if(S_DEBUG)console.log(PRINT_BREAK_S);
            if(S_DEBUG)console.log('STORING USER SESSION')
            if(S_DEBUG)console.log('   user: ' + clientUsername)
            if(S_DEBUG)console.log(midStore)
            if(S_DEBUG)console.log(PRINT_BREAK_E)
            await routesMessages.storeUserSession(clientUsername,midStore)
        });

        //event emitted when a client disconnects
        socket.on('disconnect', function(data) {
            if(S_DEBUG)console.log('\nSERVER io.on.disconnect')

            // indexing global(scope=server) key=socketid value=userName object table
            let clientUsername = allUsersServer[socket.id];

            console.log(PRINT_BREAK_S);
            // clientUsername is undefined if they have not created a username
            if(!clientUsername){
                console.log(`    waiting client disconnected`);
            }else{
                routesClients.signOutUser(clientUsername); // remove from current chat session
                console.log(`    ${clientUsername} disconnected from chat session`);
            }
            console.log(PRINT_BREAK_E);
            // if client has username = authenticated user
            // otherwise they are at username entry stage and are a 'waiting client'
            if(clientUsername && activeUserCount>0){

                delete allUsersServer[socket.id]; // remove form table (safe as userName !== undefined)

                activeUserCount--;//decrement number of connected active users
                if(activeUserCount == 0 && Object.keys(allUsersServer).length == 1){ // if user disconnecting is last user in server
                    allUsersServer = {}; // clear all serverside user data
                } else{
                    socket.broadcast.emit('updateAllUsersClient',socket.id,DELETE); // update users by deleting user socket data for all clients
                }
            }
            clientCount--; // decrement number of connected clients
        });

});


console.log(PRINT_BREAK_S)
console.log(`Server Running at port ${PORT}  CNTL-C to quit`)
console.log(`To Test:`)
console.log(`Open several browsers to: http://localhost:${PORT}/chatClient.html`)
console.log(`To Quit:`)
console.log(`CTRL+C at any time`)
console.log(`\nnote: storing of user session occurs only on window unload event
    while the server application is running`)
console.log(PRINT_BREAK_E)
