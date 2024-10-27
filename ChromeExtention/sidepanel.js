document.addEventListener('DOMContentLoaded', requestToken);
initializeMessages();

for (let message of getMessages()) {
    displayMessage(message);
}

const sendButton = document.getElementById('sendButton');
sendButton.addEventListener('click', handleFormSubmit);

const deleteButton = document.getElementById('delete');
deleteButton.addEventListener('click', deleteMessages);


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

function deleteMessages() {
    localStorage.removeItem('messages');
    document.getElementById('message-history').innerHTML = '';
}

function handleFormSubmit(event) {
    event.preventDefault();
    const message = document.getElementById('message').value;
    
    if (message == '') {
        return;
    }
    
    showLoadingIndicator();
    document.getElementById('message').value = '';

    displayMessage({ type: 'human', content: message });
    if (localStorage.getItem('messages')) {
        saveMessages([...getMessages(), { type: 'human', content: message }]);
        fetch('http://127.0.0.1:8000/chat/invoke', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ input: { messages: [...getMessages(), { type: 'human', content: message }] } }),
        })
        .then(response => response.json())
        .then(data => {
            displayMessage({ type: 'ai', content: data.output });
            saveMessages([...getMessages(), { type: 'ai', content: data.output }]);
            hideLoadingIndicator();
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }
    else {
        saveMessages([{ type: 'human', content: message }]);
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
    value.innerHTML = convertMarkdownToHTML(message.content);
    bubble.appendChild(value);
    return bubble;
}

function showLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'block';
}

function hideLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'none';
}

function convertMarkdownToHTML(markdown) {
    function escapeHTML(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    let html = markdown;

    html = html.replace(/mailto:([^\s\)]+)/g, '<a href="mailto:$1">$1</a>');
    html = html.replace(/(https?:\/\/[^\s\)]+)/g, '<a href="$1">$1</a>');
    html = html.replace(/### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ol>$&</ol>');
    html = html.replace(/^(?!<[oh])[^\n].*$/gm, '<p>$&</p>');
    html = html.replace(/<\/ol>\s*<ol>/g, '');
    
    return html;
}
