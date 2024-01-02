
/**************************************************************************************************************************************

{ activeUser in Public Chat Server }

activeUser.js - activeUser in Public Chat Server
    all implementation of code and socket events for a user in the chat server page and authenticated

***************************************************************************************************************************************/
// client is an active user and the following is implemented for the public chat server interface

// this global oject table is used in almost every client side function for indexing socket.id : username key:value pairs
// is tethered dynamically to server side object table
let allUsersClient = {};

const MAX_MSG = 100;            // max message size for user to send in chat
const PRIVATE = 'PRIVATE';      // private message constant for neat display - used only in server message logging
const PUBLIC = 'PUBLIC';        // public message constant for neat display - used only in server message logging

const AUTH_DEBUG = 0;
const AU_DEBUG = 0;             // THIS file debugger
const SERVER_DEBUG = 0;
const error_gif = 'NORESPONSE'; // msg content of no api responses but response.ok instead of big url content
const bad_gif = 'BADRESPONSE';  // msg content of no api responses and !response.ok instead of big url content

const DM_VALID = 1;             // private message data threshold for active user including PM seperator ' : ' in message
const DM_MULTIPLE_USERS = 2;    // private message data threashold for uncluding multiple user's names in message
const BAD_PM = '...you attempted to send a private message';

const PRINT_BREAK_S = '\n\n------------------------------------------------------'
const PRINT_BREAK_E = '------------------------------------------------------'

// debug for seeing instant errors for the last user interacting with server event
socket.on('serverSaysError', function(error){
    if(SERVER_DEBUG)alert('SERVER ERROR EVENT: ' + error);
    console.log(PRINT_BREAK_S)
    console.log('SERVER ERROR EVENT: ' + error)
    console.log(PRINT_BREAK_E)
});

//This function is called after the browser has unloaded (exited current) web page
// any window change (refresh or exit or navigate away) with this src file the following runs
window.onunload = (event) => {
    // clear local storage
  localStorage.removeItem('auth'); // unauthenticate
  localStorage.removeItem('thisUser'); // remove userid

  try{
      let midStore = [];
      const messageChain = document.getElementById("messages");

      // iterate through all message nodes on client page and grab embedded mids to store message visibility in server db
      for(let i =0; i<messageChain.children.length; ++i){  //https://www.w3schools.com/jsref/prop_node_childnodes.asp
          midStore.push(messageChain.children[i].mid);
      }
      // essential for storing user session
      socket.emit('storeUserSession', USERID, midStore)
      console.log(`\non exit stored session for ${USERID} of ${midStore.length} messages`)
      if(AU_DEBUG)console.log(midStore)
  } catch(error){
      console.log('window.onunload session failed to store data: ' + error);
  }
};

/*
    on server socket event when a public message is sent in chat
        * io.emit('serverSaysPublic',evaluatedMsg.publicData);
*/
socket.on('serverSaysPublic',function(msgData){
    let msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>${msgData.sender}   </strong> ${msgData.messageBody}`; // formatting html with senderID and message

    if (USERID === msgData.sender) {
          msgDiv.classList.add('usersOwnMessage'); //https://www.w3schools.com/jsref/prop_element_classlist.asp -> span tag created huge formatting error used this instead for R3.3 requirement
          console.log(`\nyou sent     : ${msgData.messageBody}`)

    } else{
        console.log(`\nmessage FROM: ${msgData.sender}`)
        console.log(`message     : ${msgData.messageBody}\n`)
    }
    msgDiv.mid = msgData.mid; // embed unique message id! for user session saving of visible messages
    document.getElementById('messages').appendChild(msgDiv); // add message to msgDiv
});

/*
    on server socket event when a private message is sent in chat,
    sends the unformatted message to user that sent it for client affirming action purposes
        * socket.emit('serverSaysPrivateToSender', evaluatedMsg.senderData);
*/
socket.on('serverSaysPrivateToSender',function(msgData){
    let msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>${msgData.sender}   </strong> ${msgData.messageBody}`;

    msgDiv.classList.add('usersOwnPrivateMessage'); //https://www.w3schools.com/jsref/prop_element_classlist.asp -> span tag created huge formatting error used this instead for R3.3 requirement
    console.log(`\nyou sent     : ${msgData.messageBody}`)

    msgDiv.mid = msgData.mid; // embed unique message id! for user session saving of visible messages
    document.getElementById('messages').appendChild(msgDiv); // add message to msgDiv
});

/*
    on server socket event when a private message is sent in chat (directly to socket no broadcast),
    sends the formatted message to directed user omitting the other users paired in directed message
        * io.to(recipients[i]).emit('serverSaysPrivate', evaluatedMsg.recipientData);
*/
socket.on('serverSaysPrivate',function(msgData){
    let msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<strong>${msgData.sender}   </strong> ${msgData.messageBody}`;

    if (USERID === msgData.sender) {
        msgDiv.classList.add('usersOwnPrivateMessage'); //https://www.w3schools.com/jsref/prop_element_classlist.asp -> span tag created huge formatting error used this instead for R3.3 requirement
        console.log(`\nyou sent     : ${msgData.messageBody}`)

    } else{
        msgDiv.classList.add('usersPrivateMessage');
        console.log('\nyou recieved a private message')
    }
    msgDiv.mid = msgData.mid; // embed unique message id! for user session saving of visible messages
    document.getElementById('messages').appendChild(msgDiv); // add message to msgDiv
});

/*
function is called from event handler on keydown or click action when active user submits a message text (and not gif) into the message box field
function initiates path of message (not gif): client->server, server->routes, routes->db, db(return mid)->routes, routes->server, server->client(s)
*/
function sendMessage() {
    // get users message from message box
    let message = document.getElementById('msgBox').value.trim()
    if(message === ''){
        alert('try sending a message to the server');
        return; //do nothing
    }
    if(message.length > MAX_MSG) {
        alert(`messages restricted to ${MAX_MSG} characters please try again`);
        return; //do nothing including not clearing text field!
    }
    socket.emit('clientSays', USERID, message) // send to server
    document.getElementById('msgBox').value = ''
}

// this function clears all local message history visible to only this active user
function clearLocalMessages(){
    // apended child elements exist as nodes but have an array backing, removing and indexing is achieved uniquely
    const messageChain = document.getElementById("messages");
    let size = messageChain.children.length //https://www.w3schools.com/jsref/prop_node_childnodes.asp
    while(size>0){
        messageChain.removeChild(messageChain.children[size-1]);    // remove last message //https://www.w3schools.com/jsref/met_node_removechild.asp
        size = messageChain.children.length
    }
    socket.emit('clearUserSession',USERID); // clear server logs for rendering
    console.log('\nlocal message history cleared');
}

/*

    after api fetch and server logging messages in db, evaluatedGIF is a object containing
    gif data for two messages to append in chat
        * first is text containing sender username and info regarding the gifs display
        * the other is the gif or default image if gif fetch based on user query was unsuccessful

*/
socket.on('serverDisplayGifs', function(evaluatedGIF){
    console.log(`\n${evaluatedGIF.sender} sends a GIF`);
    if(AU_DEBUG)console.log(PRINT_BREAK_S)
    if(AU_DEBUG)console.log(`mmid: ${evaluatedGIF.mmid}`)
    if(AU_DEBUG)console.log(`msg: ${evaluatedGIF.msg}`)
    if(AU_DEBUG)console.log(`gmid: ${evaluatedGIF.gmid}`)
    if(AU_DEBUG)console.log(`sender: ${evaluatedGIF.sender}`)
    if(AU_DEBUG)console.log(`gifs[0]: ${evaluatedGIF.gifs[0].url}`)
    if(AU_DEBUG)console.log(`giftype: ${evaluatedGIF.giftype}`)
    if(AU_DEBUG)console.log(PRINT_BREAK_E)

    let msgDiv = document.createElement('div');
    msgDiv.mid = evaluatedGIF.mmid; // message id (from server db) of gif title message

    msgDiv.innerHTML = `<strong>${evaluatedGIF.sender}   </strong> ${evaluatedGIF.msg}`;    // format message to bolden username then append message
    if(USERID === evaluatedGIF.sender){
        msgDiv.classList.add('usersOwnGif');   // colour formatting see /styles/styles.css
    } else{
        msgDiv.classList.add('usersGif');  // colour formatting see /styles/styles.css
    }

    document.getElementById('messages').appendChild(msgDiv);

    let imgTagContainer;
    imgTagContainer = document.createElement('div');
    imgTagContainer.style.display = 'flex';
    imgTagContainer.mid = evaluatedGIF.gmid; // message id (from server db) of all the gif(s) embedded in one message

    const size = evaluatedGIF.gifs.length;

    // iterate through all gifs to be embedded in single message and append them to container element
    for (let i = 0; i < size; ++i) {
        let imgTag;

        if(evaluatedGIF.giftype===BGIF){ // bad gif is when no api server connection during fetch (no internet or connection related issue) = serves static default image
            imgTag = document.createElement('div');
            imgTag.innerHTML = evaluatedGIF.gifs[i].url;
            imgTagContainer.appendChild(imgTag);

        } else{ //
            imgTag = document.createElement('img');
            imgTag.src = evaluatedGIF.gifs[i].url;
            imgTagContainer.appendChild(imgTag);
        }
    }
    document.getElementById('messages').appendChild(imgTagContainer); // append to client browser page
})

// authentication encryption of userid and password is stored global constant
async function getUserData(){
    try {
        const get = `/admin?auth=${AUTH}`;
        window.location.href = get;
    } catch (error) {
        console.error('CLIENT Error during loading users: ', error);
    }
}
