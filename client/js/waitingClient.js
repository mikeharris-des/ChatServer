
/**************************************************************************************************************************************

{ waitingClient in Username Register }

***************************************************************************************************************************************/
// client is not an active user and the following is implemented for this client aquiring a username before entering the chat server


const socket = io() // connect when v2.hbs is rendered
const DELETE = '';
/*
AUTH, USERID constants on src file rendering, localStorage.getItem() will become unreliable in application later
    when loading multiple browsers sessions on the same device, issues arise with cookies and storing / setting local browser data
    making the auth constant for this client prevents undifined authentication bypass behavior

    after successful POST METHOD fetch of '/signin' in clientControl ~line 70 'auth' & 'thisUser' set
*/
const AUTH = localStorage.getItem('auth'); // local browser auth data stored on active user entering chat server
const USERID = localStorage.getItem('thisUser') // local browser auth data stored on active user entering chat server

const MSG = 'msg';              // type is message
const MSG_SENDER = 'msg_s';     // type is sender message meant only for sender to view unformatted
const BGIF = 'bgif';            // type is bad gif (no internet/api server connection)
const GIF = 'gif';              // type  is gif

const WC_DEBUG = 0

// update client side user data with server side user data when new active user connects or new client connects
socket.on('updateAllUsersClient',function(clientSocketID,clientUsername){
    if(clientUsername === DELETE){
        if(WC_DEBUG)console.log(`\nUSER: ${allUsersClient[clientSocketID]} left the server`)
        delete allUsersClient[clientSocketID];
    } else{
        if(WC_DEBUG)console.log(`\nUSER: ${clientUsername} entered the server`)
        allUsersClient[clientSocketID] = clientUsername;
    }
    if(WC_DEBUG)console.log('CLIENT - username list updated - ' + Object.values(allUsersClient));
})

socket.on('initClient',function(activeUserCount,clientCount){
    thisUser=USERID; // important for event listeners on key down events
    console.log(PRINT_BREAK_S)
    console.log('You have entered the chat server ' + USERID)
    console.log('CHAT SERVER - has ' + activeUserCount + ' active users: ' + Object.values(allUsersClient));
    console.log('            - now loading server data')
    allUsersClient[socket.id] = USERID;
    socket.emit('initClientResponse', USERID)
})

// socket event with returns obj[] of obj = {mid, userid, msg, type, access} of all messages the server marks visible for this user
socket.on('loadUserSession', function(userSessionData) {
    for(let i = 0; i<userSessionData.length; ++i){
        // returns obj[] of obj = {mid, userid, msg, type, access}
        if(WC_DEBUG)console.log(userSessionData[i])
        let msgElement = document.createElement('div');

        switch(userSessionData[i].type){
            case MSG:   // type is message
                createMsgElement(msgElement,userSessionData[i]);
                break;
            case MSG_SENDER: // type is sender message meant only for sender to view unformatted
                createSenderMsgElement(msgElement,userSessionData[i]);
                break;
            case BGIF:  // type is bad gif (no internet/api server connection) and inserts a static image file of a default error gif
                createBadGifElement(msgElement,userSessionData[i]);
                break;
            case GIF:   // type is gif
                createGifElement(msgElement,userSessionData[i])
                break;
            default:
                alert(`failed to load user session data #${userSessionData[i].mid}`)
                break;
        }
        msgElement.mid = userSessionData[i].mid; // embed unique message id! for user session saving of visible messages
        document.getElementById('messages').appendChild(msgElement); // add message to msgDiv
    }
    console.log(`restored previous session of ${userSessionData.length} messages`)
    console.log(PRINT_BREAK_E)
})

// type is message
function createSenderMsgElement(msgElement,msgData){
    msgElement.innerHTML = `<strong>${msgData.userid}   </strong> ${msgData.msg}`;
    msgElement.classList.add('privateOwnSessionData');
}

// type is sender message meant only for sender to view unformatted
function createMsgElement(msgElement,msgData){
    msgElement.innerHTML = `<strong>${msgData.userid}   </strong> ${msgData.msg}`;
    if(msgData.access===PRIVATE){
        if(msgData.userid===USERID){
            msgElement.classList.add('privateOwnSessionData');
        } else{
            msgElement.classList.add('privateSessionData');
        }
    } else{
        if(msgData.userid===USERID){
            msgElement.classList.add('userOwnSessionData');
        } else{
            msgElement.classList.add('userSessionData');
        }
    }
}

// type is bad gif (no internet/api server connection) and inserts a static image file of a default error gif
function createBadGifElement(msgElement,msgData){
    msgElement.style.display = 'flex'; // msgElement becomes container div element
    const imgData = msgData.msg.split(',')
    for(let j = 0; j<imgData.length; ++j){
        if(imgData[j]){
            const img = document.createElement('div');
            img.innerHTML = imgData[j];
            msgElement.appendChild(img);
        }
    }
}

// type is gif
function createGifElement(msgElement,msgData){
    msgElement.style.display = 'flex'; // msgElement becmes container
    const gifData = msgData.msg.split(',')
    for(let k = 0; k<gifData.length; ++k){
        if(gifData[k]){
            const gif = document.createElement('img');
            gif.src = gifData[k];
            msgElement.appendChild(gif);
        }
    }
}
