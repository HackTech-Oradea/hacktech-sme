document.addEventListener('DOMContentLoaded', requestToken);
initializeMessages();

for (let message of getMessages()) {
    displayMessage(message);
}

const sendButton = document.getElementById('sendButton');
sendButton.addEventListener('click', handleFormSubmit);




async function requestToken() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getAuthToken' }, async function(response) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                reject(chrome.runtime.lastError);
            } 
            else {
                localStorage.setItem('token', response.token);

                const email = await requestEmail(response.token);
                localStorage.setItem('email', email);

                resolve(response.token);
            }
        });
    });
}

async function requestEmail(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to retrieve user information');
        }

        const userInfo = await response.json();
        const email = userInfo.email;

        return email;
    } catch (error) {
        console.error(error);
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function getEmail() {
    return localStorage.getItem('email');
}

function saveMessages(messages) {
    localStorage.setItem('messages', JSON.stringify(messages));
}

function initializeMessages() {
    if (!localStorage.getItem('messages')) {
        localStorage.setItem('messages', JSON.stringify([
    
        ]));
    }
}

function getMessages() {
    return JSON.parse(localStorage.getItem('messages'));
}

function handleFormSubmit(event) {
    console.log("Form submitted");
    event.preventDefault();
    const message = document.getElementById('message').value;

    if (message == '') {
        return;
    }

    document.getElementById('message').value = '';

    displayMessage({ type: 'human', content: message });
    console.log(message);
    if (localStorage.getItem('messages')) {
        saveMessages([...getMessages(), { type: 'human', content: message }]);
    fetch('http://127.0.0.1:8000/chat/invoke', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: { messages: [...getMessages(), { type: 'human', content: message }] } }),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        displayMessage({ type: 'ai', content: data.output });
        saveMessages([...getMessages(), { type: 'ai', content: data.output }]);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
    }
    else {
        saveMessages([{ type: 'human', contetnt: message }]);
    }
}

function displayMessage(message) {
    const container = document.getElementById('message-history');
    switch (message.type) {
        case 'human':
            container.appendChild(createUserMessage(message));
            break;
        case 'ai':
            container.appendChild(createAssistantMessage(message));
            break;
    }

    const containerWrapper = document.getElementsByClassName('message-history-wrapper')[0];
    containerWrapper.scrollTop = containerWrapper.scrollHeight;
}

function createUserMessage(message) {
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add('user-role');
    const value = document.createElement('span');
    value.classList.add('value');
    value.textContent = message.content;
    bubble.appendChild(value);
    return bubble;
}

function createAssistantMessage(message) {
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add('assistant-role');
    const value = document.createElement('span');
    value.classList.add('value');
    value.textContent = message.content;
    bubble.appendChild(value);
    return bubble;
}