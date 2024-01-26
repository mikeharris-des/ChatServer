/*
        api.js - all client side api request response. 
            EVENT FLOW for gif request -> client sees gif:

            [clientControl]    [api.js]    [server]     [routes/serverApi]     [GIPHY]
            LCTRL+SPACE    ->  gifApi() -> GET /gif* ->  fetch(gif*)        -> GIPHY api request ->
            (+ gif query in text field)
		
            [GIPHY]               [routes/serverApi]                                 
            -> GIPHY  response -> parse & validate gifData response then json again -> 

            [api.js]							       [server]    
            -> parse response + emit socketIO event to server (displayGifs) -> route to database -> 
		
            [routes/serverMessageData]                     [server] 
            ->  sqlite insert+get mid+return GIF data obj -> broadcast socketIO event to clients w. GIF data ->
		
            [activeUser]
            -> browser display gifs to client

            NOTE: the implementation is set up here for the api response coming directly back to client so they may choose a specific gif then that gif is 
                  routed as a message. The gif request here needs to be logged as a message with the server and I wanted to have a working rest API implementation 
                  for expanding on a possible GIF selection, so I chose not to use socketIO for the client-server communication. 
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
