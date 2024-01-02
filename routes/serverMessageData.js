
// server side file handles all message data and database

const url = require('url')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose() //verbose provides more detailed stack trace
// const db = new sqlite3.Database('data/db_1200iRealSongs')
const db = new sqlite3.Database('data/db_ChatServer.db')


/*

schema altered:
CREATE UNIQUE INDEX unique_mid_userid ON user_visibility (mid, userid);
https://www.w3schools.com/sql/sql_ref_create_unique_index.asp

TO RESET AUTO INCREMENT primary keys and delete all current messages FOR EACH TABLE
delete from chat_data;
delete from sqlite_sequence where name='chat_data';

delete from user_visibility;
delete from sqlite_sequence where name='user_visibility';


* table of usernames, passwords, and application role privilidge 'guest' or 'admin'
CREATE TABLE users (userid TEXT PRIMARY KEY, password TEXT, role text);

* primary message table with usernames, message sent by that user, the type of msg sent, the visibility off\ that message to other users
CREATE TABLE chat_data (
    mid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    userid TEXT NOT NULL,
    msg TEXT NOT NULL,
    type TEXT NOT NULL,
    access TEXT NOT NULL,
    UNIQUE (userid, mid)
);

* table showing which messages are visible to which users.
CREATE TABLE user_visibility (
    vid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    mid INTEGER NOT NULL,
    userid TEXT NOT NULL,
    FOREIGN KEY (mid) REFERENCES chat_data(mid) ON DELETE CASCADE,
    FOREIGN KEY (userid) REFERENCES chat_data(userid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX unique_mid_userid ON user_visibility (mid, userid);

*/

const UPLOAD_LOG_SIZE = 1;      // number of user messages before it is uploaded (buffer flush)
const MAX_MSG = 100;            // max message size
const SMD_DEBUG = 0             // debug for many print outs (minor)
const SMD_DEBUG2 = 0            // debug for major printouts
const SMD_DEBUG3 = 1            // debug for refactor printouts

const PRIVATE = 'PRIVATE';      // private message type
const PUBLIC = 'PUBLIC';        // public message type

// should all be one
const UNKNOWN = 'unknown';      // unknown message sender (can be found by prior message sender is for gifs but issue grabbing with asyncronous adds)
const EGIF = 'egif';            // type is error gif (no responses)
const BGIF = 'bgif';            // type is bad gif (no internet/api server connection)
const GIF = 'gif';              // type  is gif
const MSG = 'msg';              // type is message
const MSG_SENDER = 'msg_s';     // type is sender message meant only for sender to view unformatted
const gif = 'REGRESPONSE'       // message body replace gif
const error_gif = 'NORESPONSE'; // message body replace error_gif
const bad_gif = 'BADRESPONSE';  // message body replace bad_gif

const PUBLIC_MSG = 1;
const DM_VALID = 1;             // private message data threshold for active user including PM seperator ' : ' in message
const DM_MULTIPLE_USERS = 2;    // private message data threashold for uncluding multiple user's names in message
const BAD_PM = '...you attempted to send a private message';

const PRINT_BREAK_S = '\n------------------------------------------------------'
const PRINT_BREAK_E = '------------------------------------------------------\n'



/**************************************************************************************************************************************

{ serverMessageData.js }

***************************************************************************************************************************************/

/*
*** evaluatedMsg  ***
->disects the user message
->logs message in the server database
->constructs an object to be returned based on contents of the message and the unique message id in the database

->has the following attributes:
    *evaluatedMsg.type: PRIVATE | PUBLIC | undefined
        if(PRIVATE) has: evaluatedMsg.recipientData & evaluatedMsg.senderData & evaluatedMsg.recipients
        if(PUBLIC) has: evaluatedMsg.publicData

if(PRIVATE)
    *evaluatedMsg.senderData:
                  mid: mid number,
               sender: sender of message,
          messageBody: message body with bolding formatted without other users data

    *evaluatedMsg.recipientData:
                    mid: mid number,
                 sender: sender of message,
            messageBody: message body with bolding formatted without other users data

    *evaluatedMsg.recipients: array of valid 'socketIds' to recieve this formatted message

if(PUBLIC)
    *evaluatedMsg.publicData:
                mid: mid number,
                sender: sender of message,
                messageBody: message body with bolding
*/

//allUsersServer: global socketid:username key:value store from server.js
exports.evaluateMessage = async function(clientSender,message,allUsersServer) {

    try{
        let evaluatedMsg = {}; // building final message data object

        //check if referencing other user for direct/private message ( i chose to name it direct message == dm ) if they included ' > ' character in message
        //  mike > hey  ->  [mike,hey]
        const directMessageData = message.split(/\>+/g); // split usernames and message into partitioned strings (trim happens when emiting clientSaysPrivate)

        if(directMessageData.length==PUBLIC_MSG){ // if ==public message size of split array -> build public message object

            // GET publicData MID
            try {
                const pSQL = `INSERT INTO chat_data (userid, msg, type, access) VALUES ('${clientSender}', '${message}', '${MSG}', '${PUBLIC}')`
                const pMID = await runInsertQuery(pSQL)
                if(SMD_DEBUG)console.log('\npSQL: ' + pSQL + ' | pMID: ' + pMID);

                const publicData = {mid: pMID, sender: clientSender, messageBody: message};
                evaluatedMsg = {type: PUBLIC, publicData: publicData};
            } catch (error) {
              console.error('ERROR runInsertQuery pMID :', error);
              throw new Error('ERROR runInsertQuery pMID :' + error)
            }

        } else{
            // is private message attempt -> build private message object
            // if there exists a '>' char then a dm attempt is made (explicitly or implicitly, both cases handled here)
            let directMessage = '';

            // handle if partition char '>' exists in message
            if(directMessageData.length > 2){
                //'mike,user2 > hey>s'  -> ['mike,user2','hey','s'] -> 'hey>s'
                directMessage = directMessageData.slice(1,directMessageData.length).join('>');  // new array with just messsage no users join the remaining on > char
            } else{
                //[mike,hey] -> 'hey'
                directMessage = directMessageData.pop(); // remove the last element (just message no users)
            }

            // get all users to send a private message to
            let directMessageUsers = directMessageData[0].split(/[,]/); // returns og array if no partition

            // get all usernames in allUsersServer global socketid:username key:value store
            const allSocketsServer = Object.keys(allUsersServer);
            /*
            event invalidDM
              counter for indicating invalid private message. If all included users to dm were non existing users
              then there is a printout to all users that the sending user was attempting to send a private message.
            */
            let invalidDM = 0;
            let invalidUsers = []; // users not found in allUsersServer populate an array of usernames to tell sender these were not users on pm attempt
            let recipients = [];    // array of valid socket ids corrsponding to active users in server

            let recipientData = {}; // message data obj to send to directed user
            let senderData = {};    // message data obj to send back to user sender of the private message

            // loop through all users selected for dm and send: sendingUser (thisClientUsername), private message , recipient's username (dMRecipientUsername)
            for(let i = 0; i<directMessageUsers.length;i++){
                let user = directMessageUsers[i].trim();
                const socketId = allSocketsServer.find((key) => allUsersServer[key] === user); // if userid exists in current chat session get their socket id
                if(socketId){
                    recipients.push(socketId); // add socket id to array of recipients to directly send socket event to that user instead of socket broadcast
                } else{
                    invalidDM++;
                    invalidUsers.push(user);
                }
            }
            // if there were invalid users directed in a pm
            if(invalidUsers.length){
                let invalidUsersStr = invalidUsers.join(', ');
                message = `${message}<br>NOTE: <strong>${invalidUsersStr}</strong> not valid user(s) in chat`;
            }
            // if all directed users were not invalid build recipient message to indicate failed pm event
            if(invalidDM==directMessageUsers.length){
                if(SMD_DEBUG)console.log('\nINVALID PM SENT FROM: ' + clientSender)
            } else{
                //try: insert recipient message & get recipient mid
                try {
                    const rSQL = `INSERT INTO chat_data (userid, msg, type, access) VALUES ('${clientSender}', '${directMessage}', '${MSG}', '${PRIVATE}')`;
                    const rMID = await runInsertQuery(rSQL)
                    if(SMD_DEBUG)console.log('\nrSQL: ' + rSQL + ' | rMID: ' + rMID);
                    // const rmsgData = {mid: rMID, sender: clientSender, messageBody: directMessage}
                    recipientData = {mid: rMID, sender: clientSender, messageBody: directMessage};
                } catch (error) {
                    console.error('ERROR runInsertQuery rMID :', error);
                    throw new Error('ERROR runInsertQuery rMID :' + error)
                }
            }
            //try: insert sender message & get sender mid
            try {
                const sSQL = `INSERT INTO chat_data (userid, msg, type, access) VALUES ('${clientSender}', '${message}', '${MSG_SENDER}', '${PRIVATE}')`;
                const sMID = await runInsertQuery(sSQL)
                if(SMD_DEBUG)console.log('\nsSql:' + sSQL + ' | sMID: ' + sMID);
                senderData = {mid: sMID, sender: clientSender, messageBody: message};
            } catch (error) {
                console.error('ERROR runInsertQuery sMID :', error);
                throw new Error('ERROR runInsertQuery sMID :' + error)
            }
            // final return
            evaluatedMsg = {type: PRIVATE, senderData: senderData, recipientData: recipientData, recipients: recipients};
        }
        return evaluatedMsg;
    } catch(error){
        console.error('*** evaluateMessage error occurred: ', error);
        return {type: undefined};
    }
}

/*
    takes gif data fetched from API and logs it consistently to db like a message, returns mid to embed on client browser

    *   gif data can be a 'bad gif' where there is no response from api fetch due to api Key issues or connections issues
        so a static image will take the place of a gif url

    *   otherwise it will be a gif and the url for the gifs will be stored to load on a user session along with an additional
        title message outlining the appropriate gif message data:
            * GIF 'Guest Jumping Gif' if user Guest typed 'Jumping Gif' into gif message prompt
            * EGIF 'Guest no responses for GIF: Jumping Gif' if user Guest typed 'Jumping Gif' but api server had no gif responses
                    from that search query but still a response from api server. Case could also be a swear word entered in prompt
            * BGIF 'Guest no connection for GIF: Jumping Gif' if user Guest typed 'Jumping Gif' but no connection / no response from
                    api server that search query
*/
exports.evaluateGIF = async function(clientSender,gifs,gifName){
    if(SMD_DEBUG)console.log('\nmSQL evaluateGIF')
    let message;
    let type;

    switch(gifs[0].title){
        case BGIF:
            type = BGIF;
            message = `no connection for GIF: ${gifName}`
            break;
        case EGIF: // important only for message content
            type = GIF; // make it a gif type important for how gifs are appended into message div element
            message = `no responses for GIF: ${gifName}`
            break;
        default:
            type = GIF;
            message = gifName
            break;
    }

    // the following are two consecutive inserts into db of gif message public data (sender and title of gif query) then the gif itself
    let gifEntry = ''   // urls stored as single string for all gifs loaded on api fetch
    let mMID;           // pregif message id return logged in visibility db
    let gMID;           // gif message id return logged in visibility db

    // insert message before gif display showing who sent gif with information about gif (is a public message)
    try {
        const mSQL = `INSERT INTO chat_data (userid, msg, type, access) VALUES ('${clientSender}', '${message}', '${MSG}', '${PUBLIC}')`;
        mMID = await runInsertQuery(mSQL)
        if(SMD_DEBUG)console.log('\nmSQL: ' + mSQL + ' | mMID: ' + mMID);
    } catch (error) {
        console.error('ERROR runInsertQuery mMID :', error);
        throw new Error('ERROR runInsertQuery mMID :' + error)
    }
    // create a single string of all gifs
    for(let i = 0; i < gifs.length;i++){
        gifEntry = gifEntry + gifs[i].url + ',';
    }
    if(SMD_DEBUG)console.log('evaluated gif: ' + gifEntry)
    // insert all gif display data
    try {
        const gSQL = `INSERT INTO chat_data (userid, msg, type, access) VALUES ('${clientSender}', '${gifEntry}', '${type}', '${PUBLIC}')`;
        gMID = await runInsertQuery(gSQL)
        if(SMD_DEBUG)console.log('\ngSQL: ' + gSQL + ' | gMID: ' + gMID);
    } catch (error) {
        console.error('ERROR runInsertQuery gMID :', error);
        throw new Error('ERROR runInsertQuery gMID :' + error)
    }

    // RETURN FINAL GIF OBJECT with data for both messages
    const gifData = {mmid: mMID, msg: message, gmid: gMID, sender: clientSender, gifs: gifs, giftype: type}; // return is both messages data
    return gifData;
}


/*
logging visible message history from collected mids of user when they exit chat server application page (onunload event)
    called from server.js as: routesMessages.storeUserSession(clientUsername,midStore)

    logging in TABLE user_visibility only with (mid,userid) pair inserts
*/
exports.storeUserSession = async function(clientUsername,midStore){
    if(SMD_DEBUG)console.log('\nmdSERVER storeUserSession')
    if(SMD_DEBUG)console.log('#messages to store ' + midStore.length + '\n')

    try{
        /*
        To store user session mids in user_visibility
            -> inserting all mids with unique constraint on table, db handles no duplicates
        */
        for(let i = 0; i< midStore.length; ++i){
            let sql = `INSERT OR IGNORE INTO user_visibility (mid, userid) VALUES ('${midStore[i]}', '${clientUsername}')` //https://stackoverflow.com/questions/35415469/sqlite3-unique-constraint-failed-error
            const result = await runInsertQuery(sql);
            if(result){
                if(SMD_DEBUG)console.log(`${clientUsername}: ${midStore[i]} : logged successfully`)
            } else{
                if(SMD_DEBUG)console.log(`${clientUsername}: ${midStore[i]} : not logging messsage from prior session`)
            }
        }
    } catch(err){
        console.error('* mdSERVER ERR storeUserSession: ' + err)
    }
}

// logging message before transfering to db (only transfering if user exits)
// returns obj[] of obj = {mid, userid, msg, type, access}
exports.getUserSession = async function(clientUsername){
    if(SMD_DEBUG)console.log(PRINT_BREAK_S)
    if(SMD_DEBUG)console.log('\nmdSERVER getUserSession for ' + clientUsername)

    try {
        let sql = `SELECT chat_data.mid, chat_data.userid, chat_data.msg, chat_data.type, chat_data.access
               FROM chat_data
               JOIN user_visibility ON chat_data.mid = user_visibility.mid
               WHERE user_visibility.userid = '${clientUsername}'
               ORDER BY chat_data.mid ASC`;
        let rows = await selectAsyncQuery(sql);
        if(SMD_DEBUG)console.log(sql);
        if(SMD_DEBUG)console.log(PRINT_BREAK_E)
        return rows;
    } catch (error) {
        console.error('getUserData failed: ' + error);
        if(SMD_DEBUG)console.log(PRINT_BREAK_E)
        return undefined;
    }
}

// helper function for selecting and returning from db
function selectAsyncQuery(sql) {
  if(SMD_DEBUG)console.log('\nmdSERVER selectAsyncQuery')
  return new Promise((resolve, reject) => {
    db.all(sql, function (err,rows) {
      if (err) {

        console.error("ERROR selectAsyncQuery: ", err);
        if(SMD_DEBUG)console.error(sql);
        reject(err);
      } else {
         if(SMD_DEBUG)console.log('selectAsyncQuery success: ' + sql);
        resolve(rows);
      }
    });
  });
}

// helper function for adding to db
function runInsertQuery(sql) {
  if(SMD_DEBUG)console.log('\nmdSERVER runInsertQuery')
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) {
        if(SMD_DEBUG)console.error("\nmdSERVER ERROR runInsertQuery: ", err);
        reject(err);
      } else {
        if(SMD_DEBUG)console.log('\nmdSERVER runInsertQuery success: ' + sql + ' lastID: ' + this.lastID);
        resolve(this.lastID); // resolve mid if chat_server, resolve vid if user_visibility
      }
    });
  });
}


exports.clearUserSession = async function(clientUsername){
    if(SMD_DEBUG)console.log('\nmdSERVER clearUserSession')
    try {
      // Delete rows from user_visibility
      const sql = `DELETE FROM user_visibility WHERE userid = '${clientUsername}'`;
      await runDeleteQuery(sql);

      if(SMD_DEBUG)console.log(`\nmdSERVER Deleted vid rows for userid: ${clientUsername}`);
    } catch (error) {
      if(SMD_DEBUG)console.log("\nmdSERVER ERROR clearUserSession");
      console.error("Error deleting rows:", error);
    }
}

// helper function for deleting in db
function runDeleteQuery(sql) {
    if(SMD_DEBUG)console.log('\nmdSERVER runDeleteQuery')
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) {
        if(SMD_DEBUG)console.error("\nmdSERVER ERROR runDeleteQuery: ", err);
        if(SMD_DEBUG)console.error(sql);
        reject(err);
      } else {
        if(SMD_DEBUG)console.log('\nmdSERVER runDeleteQuery success: ' + sql);
        resolve();
      }
    });
  });
}
