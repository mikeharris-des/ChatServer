// client API request response here
/*
file handles client side interaction in chat server to request GIFs
    *   Valid requests sent to server.js
    *   server routes file serverAPI.js makes fetch to retrieve GIF data, returns response with gif data or static default image on error
        (note i made the api implementation without a database and before the socket implementation, this step and next step is large redundancy
        it can be redone to be done as a single socket event staying on the server side for the logging and broadcasting - must be redone for high traffic application)
    *   this socket(active user) emits socket event back to server for logging the gif data then server broadcasts to all users with mid fro db to update the chat application's
        interface with gifData obj containing top gif hits for user's gifName
*/
const DEBUG_cAPI = 0;

// on valid keydown event in chat server, user is prompted to enter gif query for the api to return hits from that query
function gifApi() {
    let gifName = prompt("Please enter a GIF", "it works!"); // user prompt with default query
    if(!gifName){
        return;
    }
    document.getElementById('msgBox').value = ''
    if(DEBUG_cAPI)console.log('gifName: ' + gifName);

    let xhr = new XMLHttpRequest();
    let gifNameWords = gifName.split(' ');

    let gifNameFormatted = gifNameWords.join('+'); // format request to match api server format
    xhr.open('GET', `/gif?title=${gifNameFormatted}`, true); // api get request made here to server
    xhr.send();
    // here is listening for response from this server.js
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            console.log(PRINT_BREAK_S);
            if(DEBUG_cAPI)console.log(xhr.status)
            if(DEBUG_cAPI)console.log(xhr)
            if (xhr.status == 200) {
                // if valid response from api server (from server.js passes same status response)
                let gifData = JSON.parse(xhr.responseText);
                console.log('xhr response:', gifData[0].title);
                socket.emit('displayGifs',USERID,gifData,gifName); // back to server with data
            }
            else{
                // on response error from api server request, a static image (/image/errorGifImg.jpg) is loaded as url to replace gif data
                // happens on internet issues or beta key issues
                const badresponse = JSON.parse(xhr.responseText);
                if(DEBUG_cAPI)console.log(badresponse.error)
                if(DEBUG_cAPI)console.log(badresponse.badgif)
                const gifData = badresponse.badgif;

                if(DEBUG_cAPI)console.log(gifData)
                console.log('xhr response: ', gifData[0].title);
                socket.emit('displayGifs',allUsersClient[socket.id],gifData,gifName);
                console.log(PRINT_BREAK_E);
            }
        }
    }
}
