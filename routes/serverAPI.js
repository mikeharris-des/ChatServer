//serverApi.js - server side file handles all api data. API fetch handled here to avoid clutter in server.js

const url = require('url')
const fs = require('fs')
const http = require('http');

const KEY = 'MvvlKLvuFhWaXnDI4ZkJ0Rq8ODNAJFxq'  // giphy beta key allows access to server. If key expired or too many requests, response will be errored request
const GIF_COUNT = 4; // number of search results in search table (gifs displayed in chat)
const ERROR_GIF_URL = 'https://media3.giphy.com/media/1VT3UNeWdijUSMpRL4/100.gif?cid=3837e08cuox7sk4vtiiz0bx6w0d7ks7b1rw909ovcemla7u1&ep=v1_gifs_search&rid=100.gif&ct=g'; // default gif
const error_gif = {title: 'egif', url: ERROR_GIF_URL} // if no responses (curse word etc)
const bad_gif = {title: 'bgif', url: '<img src="images/errorGifImg.jpg" height="100px"/>'} // if no wifi or api server access
const error_gifData = getDefaultGif(error_gif); // if response from api but 0 returns (server has no gifs of that title)
const bad_gifData = getDefaultGif(bad_gif); //if no response from api server // bad connection to internet

const S_API_DEBUG = 0;

// made as an array with duplicate entries to match the implemented api response format
function getDefaultGif(gif){
    let gifData = [];
    for(let i = 0; i< GIF_COUNT; ++i){
        gifData.push(gif);
    }
    return gifData;
}

/*
main handler for the GET request to fetch GIF data.
    It extracts the GIF title from the query parameters and validates it
    then calls fetchGIFData (in this file) to get the actual GIF data
    The response is then sent back to the client
*/
exports.getGIF = function(req,res){
    if(S_API_DEBUG)console.log('server API GET: ' + req.url);
    // Extract GIF title from the query parameters
    const gifTitle = req.query.title;

    // Validate GIF title
    if (!gifTitle) {
        // Send an error response if the GIF title is missing
        return res.status(400).json({ error: 'Please enter a gif name' });
    }

    // Fetch GIF data from the GIF API
    fetchGIFData(gifTitle)
        .then((gifData) => { // resolve
            // Check if the API response is empty or does not contain the expected data
            if(S_API_DEBUG)console.log('responses: ' + gifData.length)
            if (!gifData || !Array.isArray(gifData)) {
                res.status(500).json({ error: 'Failed to retrieve gif data from the API', badgif: bad_gifData});
            } else{
                if(S_API_DEBUG)console.log(gifData)
                res.status(200).json(gifData);
            }
        })
        .catch((error) => { // happens if no internet connection
            console.error(' Error fetching gif data for ' + gifTitle + ' gif | ERROR:', error);
            res.status(500).json({ error: 'Internal server error', badgif: bad_gifData }); // BAD GIF HERE ****************** // array of static images to replace gif
        });
}

/*
 function fetches GIF data from the Giphy API using the fetch function
    formats the URL, performs the API request, and processes the API response.
    * returns a promise that resolves with an array of GIF data where number of GIFs determined GIF_COUNT constant. GIFS are top hits for user gif query (gifTitle)
    * rejects with an error -> exports.getGIF handles reject error and responds to client with bad_gifData -> a default static image still of an error gif
*/
function fetchGIFData(gifTitle) {
    return new Promise((resolve, reject) => { // handle asynch function pass only resolve() return or reject()

        let gifNameWords = gifTitle.split(' ');
        let gifNameFormatted = gifNameWords.join('+');
        if(S_API_DEBUG)console.log('CLIENT requests GIF title: ' + gifNameFormatted);

        const hostname = 'api.giphy.com';
        const path = `/v1/gifs/search?api_key=${KEY}&q=${gifNameFormatted}&limit=${GIF_COUNT}&offset=0&rating=r&lang=en&bundle=messaging_non_clips`;

        let url = `https://${hostname}${path}`;
        if(S_API_DEBUG)console.log('SERVER fetching: ' + url)

        fetch(url)
            .then(response => response.json())
            .then(content => {
                //console.log(content.data); // array
                if(S_API_DEBUG)console.log('#results: ' + content.data.length); // important

                // no results from api
                if(content.data.length==0){
                    if(S_API_DEBUG)console.log('SERVER: No results for gif search')
                    resolve(error_gifData); // no responses from api server but response connection exist
                } else{
                    if(S_API_DEBUG)console.log('SERVER: results loaded');
                    if(S_API_DEBUG)console.log(content.meta); // 200 respons
                    //
                    let gifData = [];
                    for(let i = 0; i<content.data.length; i++){
                        gifData.push({title: content.data[i].title, url: content.data[i].images.fixed_height_small.url})
                    }
                    resolve(gifData); // done parse JSON
                }

            })
            .catch (error => {
            // Handle network errors or other exceptions
                console.error('SERVER: Error during api request: ', error);
                reject(error);
            });
    });
}
