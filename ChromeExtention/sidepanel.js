
const messages = [
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
    { role: "assistant", content: "Sure! Why did the scarecrow win an award? Because he was outstanding in his field!" },
    { role: "user", content: "Haha, that's a good one!" },
    { role: "assistant", content: "I'm glad you liked it!" },
    { role: "user", content: "Can you give me some coding tips?" },
  ];

for (const message of messages) {
    displayMessage(message);
}

const form = document.getElementById('messageForm');
form.addEventListener('submit', handleFormSubmit);

function handleFormSubmit(event) {
    event.preventDefault();
    const message = document.getElementById('message').value;
    document.getElementById('message').value = '';

    displayMessage({ role: 'user', content: message });
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