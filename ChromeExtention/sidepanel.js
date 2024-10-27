document.addEventListener('DOMContentLoaded', requestToken);
initializeMessages();

for (let message of getMessages()) {
    displayMessage(message);
}

const form = document.getElementById('messageForm');
form.addEventListener('submit', handleFormSubmit);




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
            { role: "user", content: "Hello, how are you?" },
            { role: "assistant", content: "I'm good, thank you! How can I help you today?" },
            { role: "user", content: "What is the weather like?" },
            { role: "assistant", content: "It's sunny with a light breeze today." },
            { role: "user", content: "Can you tell me a joke?" },
            { role: "assistant", content: "Sure! Why did the scarecrow win an award? Because he was outstanding in his field!" },
            { role: "user", content: "Haha, that's a good one!" },
            { role: "assistant", content: "I'm glad you liked it!" },
            { role: "user", content: "Can you give me some coding tips?" },
            { role: "assistant", content: "Absolutely! Start by writing clean, readable code and make use of functions to keep things modular." },  
            { role: "assistant", content: "It's sunny with a light breeze today." },
            { role: "user", content: "Can you tell me a joke?" },
            { role: "assistant", content: "Sure! Why did the scarecrow win an award? Because he was outstanding in his field!" },
            { role: "user", content: "Haha, that's a good one!" },
            { role: "assistant", content: "I'm glad you liked it!" },
            { role: "user", content: "Can you give me some coding tips?" },
            { role: "assistant", content: "Absolutely! Start by writing clean, readable code and make use of functions to keep things modular." },
            { role: "assistant", content: "Sure! Why did the scarecrow win an award? Because he was outstanding in his field!" },
            { role: "user", content: "Haha, that's a good one!" },
            { role: "assistant", content: "I'm glad you liked it!" },
            { role: "user", content: "Can you give me some coding tips?" },
            { role: "assistant", content: "Absolutely! Start by writing clean, readable code and make use of functions to keep things modular." },  { role: "assistant", content: "It's sunny with a light breeze today." },
            { role: "user", content: "Can you tell me a joke?" },
            { role: "assistant", content: "Sure! Why did the scarecrow win an award? Because he was outstanding in his field!" },
            { role: "user", content: "Haha, that's a good one!" },
            { role: "assistant", content: "I'm glad you liked it!" },
            { role: "user", content: "Can you give me some coding tips?" },
            { role: "assistant", content: "Absolutely! Start by writing clean, readable code and make use of functions to keep things modular." },
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
    document.getElementById('message').value = '';

    displayMessage({ role: 'user', content: message });
    console.log(message);
    if (localStorage.getItem('messages')) {
        saveMessages([...getMessages(), { role: 'user', content: message }]);
    }
    else {
        saveMessages([{ role: 'user', contetnt: message }]);
    }
}

function displayMessage(message) {
    const container = document.getElementById('message-history');
    switch (message.role) {
        case 'user':
            container.appendChild(createUserMessage(message));
            break;
        case 'assistant':
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