NAME:
	MICHAEL ANASTASAKIS
	101047439
	COMP2406-A

PURPOSE:
	COMP 2406 - Fall 2023 FINAL PROJECT

    The application is a chat server designed to handle real-time communication between connected clients.
    Clients can send messages, including images and GIFs, to the server, which stores the chat data in a database.
    The server also manages temporary logs of messages for clients that have disconnected and aims to update the
    main chat database when clients reconnect. The server utilizes various events, such as 'storeClientData' and
    'waitForClientsResponse,' to coordinate actions between the server and clients, ensuring data consistency and
    integrity. Additionally, there are features to handle user exits, such as storing local message history
    and updating user visibility in the chat. The application focuses on maintaining a seamless and persistent
    chat experience for users.

TESTED:
	on MacOS Sonoma 14.1
    on Ubuntu 22.04
    on Microsoft Edge Version 120.0.2210.61 (Official build) (x86_64) 
    on latest version of Google Chrome

INSTALL INSTRUCTIONS:

	* in terminal enter following if npm is not installed (npm -version) in project directory and validate prompts if necessary:

        % npm install 

    * install sqlite for your system
        https://www.sqlite.org/download.html


    * in directory containing [ PATH -> …/2406FP/ ] server.js ensure the following files are present:

        …/package-lock.json
        …/package.json


    * in directory containing server.js [ PATH -> …/2406FP/ ] enter in terminal to download required npm modules and validate prompts if necessary:

        % npm install


LAUNCH INSTRUCTIONS:
	all programs are within this folder ( PATH -> …/2406FP/ ) can be accessed with the following paths:


	server.js :  	 [ PATH -> …/2406FP/ ]

    ensure the node_modules folder is present upon completion of INSTALL INSTRUCTIONS, otherwise see INSTALL INSTRUCTIONS ^^


	open command line interface, type and enter >> node server.js to launch js program

TEST INSTRUCTIONS:

            *Upon executing program the following will display to terminal:

                Server Running at port 3000  CNTL-C to quit
                To Test:
                Open several browsers to: http://localhost:3000/chatClient.html

            *please only copy, paste and the one url ‘ http://localhost:3000/chatClient.html ‘ into a chrome browser
                there is handling implemented for entering other urls navigable for this application

            *Accessing the Chat Interface:

                navigating to http://localhost:3000/chatClient.html to access the chat interface.
                Multiple clients can connect to the server using different browser tabs or windows.

                create users to sign in or use the preloaded guest

                *admin login*
                    userid: fisto
                    passwd: password

                *to see admin privilege data, be logged in as an admin in chat server and click 'USERS'
                 button at the bottom, this will also log you out.

                 here you can see all userids and their passwords and some* message history. Not all messages
                 store when you navigate.

                LCTL+SPACE to enter a gif
                'userid > message' to send private message
                'userid1, userid2, ... useridN > message' to send private message to N users

                clearing messages (CLEAR MESSAGES button) only clears the page on this session, it will not
                clear previous session data when loading again

			*You may terminate the server/program with the following command: CNTL-C at anytime

ISSUES:
        *most issues are how the visible message data is stored for each user - see routes/serverMessageData for a headache

        *other user data is not stored only messages you send excluding gif data.

        *repeat messages are stored in chat_data db and causes buggy fetches for session data when loading again

        *chrome browser is giving issues with styling please use Microsoft Outlook
        apparently it has no issue with the styling, i am taking fault if its not
        a virtual memory issue it is an error somewhere in my code.


FILES:

SERVER SIDE

server.js - main page for everything server including main implementation of server socket io and authentication

/routes
    serverClients.js // server side file handles all authentication and every helper function for server that doesnt involve messages or api
    serverMessageData.js // server side file handles all message data and database
    serverApi.js // server side file handles all api data




/views - handlebar html pages
    v1.hbs // main landing page only includes src = clientControl.js
    v2.hbs // chat server page
    v3.hbs // admin page where userdata is displayed
    v4.hbs // non authorized access to admin page
    v5.hbs // was supposed to handle multiple users trying to log in, when server disconnects and connects causes undefined response

/data - sqlite database
    db_ChatServer.db // data base storing server data

    SCHEMA

    *stores user authentication data
    CREATE TABLE users (userid TEXT PRIMARY KEY, password TEXT, role text);

    *stores all chat data
    CREATE TABLE chat_data (
        mid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        userid TEXT NOT NULL,
        msg TEXT NOT NULL,
        type TEXT NOT NULL,
        access TEXT NOT NULL,
        UNIQUE (userid, mid)
    );

    *stores all chat data visible to one user
    CREATE TABLE user_visibility (
        vid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        mid INTEGER NOT NULL,
        userid TEXT NOT NULL,
        FOREIGN KEY (mid) REFERENCES chat_data(mid) ON DELETE CASCADE,
        FOREIGN KEY (userid) REFERENCES chat_data(userid) ON DELETE CASCADE
    );

favicon.ico - image for tab display cu logo

/styles
    style.css page

CLIENT SIDE
/client
    /images/errorGifImg.jpg // standard gif(img) if api server response fails or no internet

    /js
        activeUser.js - activeUser in Public Chat Server
            all implementation of code and socket events for a user in the chat server page and authenticated

        api.js - all client side api request response

        clientControl.js - all handling of when user navigates to main landing page /chatServer
            includes event listeners on button and key events at the bottom

        waitingClient.js - client is not an active user but is authenticated and being loaded with data from the chat server
            here socket.io is initialized


VIDEOLINK:
    COMP 2406 - Fall 2023 FINAL PROJECT
    https://youtu.be/wtcX7uteig8


ADDITIONAL NOTES:

    not complete
