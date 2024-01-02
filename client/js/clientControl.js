
/**************************************************************************************************************************************

{ Client Control }

clientControl.js - all handling of when user navigates to main landing page /chatServer
    includes event listeners on button and key events at the bottom. I could not seperate the pages with sockets caused issues
***************************************************************************************************************************************/

const CONSTRAINT_1 = 1;     //Username first character is a letter
const CONSTRAINT_2 = 2;     //Username consists of only letters and numbers
const CONSTRAINT_3 = 4;     //Username is unique and is not the same as an existing user
const CONSTRAINT_4 = 8;     //Username is less than MAX_CHAR characters
const VALID_USERID = CONSTRAINT_1+CONSTRAINT_2+CONSTRAINT_3+CONSTRAINT_4;
const MAX_CHAR = 50; // max username
const CC_DEBUG = 0;
const CHATSERVER_URL = 'http://localhost:3000/chatServer'
const ADMIN_URL = 'http://localhost:3000/admin'
let thisUser; // a variable to control if the client rendering this file has an associated/registered/authenticated username
// let auth;

// any window change (refresh or navigate to) with this src file the following runs
window.onload = (event) => {
    const currUrl = window.location.href;
    const currPath = currUrl.split('?')

    if(currPath[0]===CHATSERVER_URL){
        if(CC_DEBUG)console.log('\nUSER loaded chatServer page')
        window.history.pushState({}, document.title, CHATSERVER_URL); // changes url to not include auth
    }
    if(currPath[0]===ADMIN_URL){
        if(CC_DEBUG)console.log('\nUSER loaded admin page')
        window.history.pushState({}, document.title, ADMIN_URL); // changes url to not include auth
    }
};

const invalidDiv = document.createElement('div');
let invalidDivNode = document.getElementById('usernameInvalid');
if(invalidDivNode){
    invalidDivNode.appendChild(invalidDiv);
}

async function clientSignIn() {
  let userid = prompt('Please enter your userid', 'guest');
  if (!userid) {
    return;
  }
  let password = prompt('Please enter your password', 'password');

  // Encode credentials to base64
  let base64Credentials = btoa(`${userid}:${password}`);

  try {
    const response = await fetch('/signin', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      // Body can be empty for Basic Auth, or you can send additional data
      // body: JSON.stringify({ user: { userid, password } }),
    });

    if (response.ok) {
      localStorage.setItem('auth', base64Credentials); //REMOVE in activeUser.js on page unload
      localStorage.setItem('thisUser', userid); //REMOVE in activeUser.js on page unload
      // Authentication successful

      console.log('\nCLIENT signin successful')
      if(CC_DEBUG)console.log('RESPONSE.ok')
      if(CC_DEBUG)console.log(response)
      if(CC_DEBUG)console.log(response.headers)
      if(CC_DEBUG)console.log('AUTH:')

      if(CC_DEBUG)console.log(localStorage.getItem('auth'))

      // get request with auth encryption
      const get = `/chatServer?auth=${localStorage.getItem('auth')}`;
      window.location.href = get;
      } else{
          const result = await response.json();
          alert(result.error)
      }
  } catch (error) {
    // Handle network errors or other exceptions
    console.error('Error during authentication:', error);
  }
}

async function clientCreateUser() {

    let usernameInput = document.getElementById('usernameInput').value;
    let passwordInput = document.getElementById('passwordInput').value;
    if(!usernameInput || !passwordInput){
        alert('Input a username and password!')
        return;
    }

    let newUser = usernameInput.trim()
    let newPassword = passwordInput.trim()
    if(newUser === '' || newPassword  === '') return; //do nothing
    document.getElementById('usernameInput').value = ''
    document.getElementById('passwordInput').value = ''
    let user = { userid: newUser, password: newPassword}
    try {
        const response = await fetch('/createUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 'include' if dealing with cookies
            credentials: 'include',
            body: JSON.stringify({ user }),
        });

        if (response.ok) {
            // If the response is OK, it means the user is authenticated
            if(CC_DEBUG)console.log('\nCLIENT server has response');

            const result = await response.json();
            if(CC_DEBUG)console.log('result is: ' + result.resCode)

            switch(result.resCode){
                case VALID_USERID: // valid username no constraints hit
                    console.log('\nCLIENT Entered Valid Username')
                    invalidDiv.textContent = '';
                    alert(`Username created now sign in! ${user.userid}`)
                    break;

                case (VALID_USERID-CONSTRAINT_1): //Username first character is a letter
                    if(CC_DEBUG)console.log('\nCLIENT Entered Invalid Username 1')
                    alert(`Username first character must be a letter: ${user.userid}`)
                    break;

                case (VALID_USERID-CONSTRAINT_2): //Username consists of only letters and numbers
                    if(CC_DEBUG)console.log('\nCLIENT Entered Invalid Username 2')
                    alert(`Username must consists of only letters and numbers: ${user.userid}`)
                    break;

                case (VALID_USERID-CONSTRAINT_3):  //Username is unique and is not the same as an existing user
                    if(CC_DEBUG)console.log('\nCLIENT Entered Invalid Username 3')
                    alert(`Username already exists: ${user.userid}`)
                    break;

                case (VALID_USERID-CONSTRAINT_4): // username too long
                    if(CC_DEBUG)console.log('\nCLIENT Entered Invalid Username 4')
                    alert(`Username is over ${MAX_CHAR} characters: ${user.userid}`)
                    break;

                default:    // combination of any or all (but unique existing) constraints
                    if(CC_DEBUG)console.log('\nCLIENT Entered Invalid Username')
                    alert(`Username Invalid: ${user.userid}
                        * multiple contraints on this username *`)
                    break;
            }
        } else {
            // If the response is not OK, handle authentication failure
            console.error('CLIENT: clientCreateUser failed');
            alert('SERVER ERROR CREATING USER')
        }
    } catch (error) {
        // Handle network errors or other exceptions
        console.error('CLIENT: Error during clientCreateUser:', error);
    }
}

async function getBack(){
    console.log('/nCLIENT redirected to home page')
    try {
        const get = `/chatClient.html`;
        window.location.href = get;
    } catch (error) {
        console.error('CLIENT Error during Back Event: ', error);
    }
}


/**************************************************************************************************************************************

{ Event listeners }

***************************************************************************************************************************************/
// event listeners when browser first loads application for client and for client application interfacing

document.addEventListener('DOMContentLoaded', function() {
  //This function is called after the browser has loaded the web page

  document.addEventListener('click', async function(e){
      //console.log("YOU ARE SIGNING IN")
      e.stopPropagation();
      e.preventDefault();
      if(e.target.id === 'existing_as'){
          if(CC_DEBUG)console.log('SIGNIN')
          await clientSignIn();
      }
      if(e.target.id === 'send_button'){
          if(CC_DEBUG)console.log('SEND MESSAGES BUTTON')
          sendMessage();
      }
      if(e.target.id === 'clear_button'){
          if(CC_DEBUG)console.log('CLEAR MESSAGES BUTTON')
          clearLocalMessages();
      }
      if(e.target.id === 'connect_as'){
          if(CC_DEBUG)console.log('CREATE USER BUTTON')
          await clientCreateUser();
      }
      if(e.target.id === 'admin_button'){
          if(CC_DEBUG)console.log('ADMIN BUTTON')
          // this is the admin navigation button to get all user data
          await getUserData();
      }
      if(e.target.id === 'back_button'){
          if(CC_DEBUG)console.log('BACK BUTTON')
          await getBack();
      }
  })

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
})

let map = {};
function handleKeyUp(e){
    // reset map (see handleKeyDown)
    map = {};
}


/*
    handles button event press
        enter -> if on home landing page ChatCLient.html will be to enter data inputted in text field to create new user
        enter -> if in chat server and a defined user page will enter message

        SPACE+LCTRL -> will prompt for gif field entry to display gifs
*/
function handleKeyDown(e){
  const ENTER_KEY = 13 //keycode for enter key
  const SPACE_KEY = 32;     //keycode for g key
  const L_CTRL_KEY = 17; //keycode for space key
  e = e || event; // to deal with IE
  map[e.keyCode] = e.type == 'keydown'; //https://stackoverflow.com/questions/5203407/how-to-detect-if-multiple-keys-are-pressed-at-once-using-javascript
  if(map[SPACE_KEY] && map[L_CTRL_KEY] && thisUser){ // lctrl+space
      if(CC_DEBUG)console.log('\nCLIENT keydown gif prompt')
      gifApi(); // prompt user for gif query search in chat server
      map = {}

  } else if(map[ENTER_KEY]){
      if(thisUser){ // if this user is declared with value then user exists and is in chat server
          if(CC_DEBUG)console.log('\nCLIENT keydown send msg')
          sendMessage();
      } else{
          if(CC_DEBUG)console.log('\nCLIENT keydown create user')
          clientCreateUser();
      }
      map = {}
  }
  return false // dont propogate
}
