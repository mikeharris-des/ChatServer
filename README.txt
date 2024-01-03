NAME:
	MICHAEL ANASTASAKIS
	mikeharris.des@gmail.com

CHATSERVER APPLICATION:

    This application is a chat server designed to handle user authentication followed by real-time communication 
    between connected clients. Clients can send messages and GIFs, to the server, which stores the message data 
    in a sqlite database before broadcasting the message to the directed users. 
    
    User Session data saved and retrieved when a user exits and logs back in to the application.

    Real-time communication is implemented with Socket IO framework.
    Authentication is handled mainly through the Express middleware framework.
    Browser pages rendered as a template through Handlebars framework.

TESTED:
    on MacOS Sonoma 14.1
    on Ubuntu 22.04
    on latest version of Google Chrome (though any browser should work)

ACKNOWLEDGEMENTS:
	I would like to express my gratitude to Louis D. Nel for providing the initial outline and specifications for several assignments during 
	my time at Carleton University. These assignments served as the foundation for the project presented here, showcasing the skills and 
	knowledge gained under Professor Nel's guidance.
--------------------------------------------------------------------------------------------------------------------------------------------------

INSTALL INSTRUCTIONS:

	* in terminal enter the following if npm is not installed (npm -version) in project directory and validate prompts if necessary:

        % npm install 

    * Have sqlite installed (sqlite3 -version) for your system (required for application database)
	
        https://www.sqlite.org/download.html

	LINUX
	wget https://www.sqlite.org/2022/sqlite-tools-linux-x64-3440200.zip


    * in directory containing [ PATH -> …/chatserver/ ] server.js ensure the following files are present:

        …/package-lock.json
        …/package.json


    * in directory containing server.js [ PATH -> …/chatserver/ ] enter in terminal to download required npm modules and validate prompts if necessary:

        % npm install

--------------------------------------------------------------------------------------------------------------------------------------------------

LAUNCH INSTRUCTIONS:
	all programs are within this folder ( PATH -> …/chatserver/ ) can be accessed with the following paths:


	server.js :  	 [ PATH -> …/chatserver/ ]

    ensure the node_modules folder is present upon completion of INSTALL INSTRUCTIONS, otherwise see INSTALL INSTRUCTIONS ^^


	open command line interface, type and enter >> node server.js to launch js program

--------------------------------------------------------------------------------------------------------------------------------------------------

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

                 here you can see all userids and their passwords and message history. Note messages will store even on clear message event

                *LCTL+SPACE to enter a gif

                'userid > message' to send private message
                'userid1, userid2, ... useridN > message' to send private message to N users (comma separated & space not needed)

                clearing messages (CLEAR MESSAGES button) only clears the history session for this user, it will not
                clear previous session data for other users

		*You may terminate the server/program with the following command: CNTL-C at anytime
		
            *HOTKEYS
		ENTER on main landing (/chatClient) invokes create user action -> will attempt to create a username with the data in the text 
		fields
		ENTER when participating in chat (/chatServer) will invoke message sending -> based on whatever text is in text field
		LCTL+SPACE to enter a gif
--------------------------------------------------------------------------------------------------------------------------------------------------

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
    v3.hbs // admin page where all userdata is displayed
    v4.hbs // non authorized access to admin page

/data - sqlite database
    db_ChatServer.db // data base storing server data

    SCHEMA

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

favicon.ico - image for tab display CU logo (go Ravens)

/styles
    style.css page

CLIENT SIDE
/client
    /images/errorGifImg.jpg // default gif(img) if api server response fails or no internet

    /js
        activeUser.js - activeUser in Public Chat Server
            all implementation to support an active user participating in chat server including user socket events are in this file 

        api.js - all client side api request response. 
	it can be redone to be done as a single socket io event staying on the server side after passing the client gif query then 
	the logging and broadcasting but I wanted to have a working example of a full client-server api request 

        clientControl.js - all handling of when user navigates to main landing page /chatClient.html
            includes event listeners on button and key events at the bottom

        waitingClient.js - client is not an active user but is authenticated and being loaded with data from the chat server including
	previous session data and is sharing user data before being able to participate in chat server
            *here socket.io is initialized 

--------------------------------------------------------------------------------------------------------------------------------------------------

VIDEOLINK:
    COMP 2406 - Fall 2023 FINAL PROJECT -> before it was finished with several bugs
    https://youtu.be/wtcX7uteig8


ADDITIONAL NOTES:


