function createPopup(toField, subjectContent, bodyContent) {
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'gmail-interceptor-popup';

  // Create popup content
  popup.innerHTML = `
    <div class="popup-content">
      <h2>Email Details</h2>
      <p><strong>To:</strong> ${toField}</p>
      <p><strong>Subject:</strong> ${subjectContent}</p>
      <div class="body-content">
        <strong>Body:</strong>
        <div class="scroll-content">${bodyContent}</div>
      </div>
      <div class="button-container">
        <button id="confirmSend">Send</button>
        <button id="cancelSend">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Add event listeners for buttons
  document.getElementById('confirmSend').addEventListener('click', () => {
    popup.remove();
    // Continue with the original send action
    originalSendFunction();
  });

  document.getElementById('cancelSend').addEventListener('click', () => {
    popup.remove();
  });
}

// Store the original send function
let originalSendFunction;

// Monitor DOM for the send button
function interceptSendButton() {
  const observer = new MutationObserver((mutations) => {
    const sendButton = document.querySelector('[aria-label="Send ‪(Ctrl-Enter)‬"]');
    if (sendButton && !sendButton.hasAttribute('intercepted')) {
      sendButton.setAttribute('intercepted', 'true');

      // Create the "ClickMe" button
      const clickMeButton = document.createElement('button');
      clickMeButton.textContent = 'ClickMe';
      clickMeButton.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';
      clickMeButton.style.marginRight = '10px';

      // Add click event listener to the "ClickMe" button
      clickMeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Store original send function for later use
        originalSendFunction = originalClick;

        // Get compose window content
        var allEmails = "";
        var toFields = document.getElementsByClassName('akl');
        for (var i = 0; i < toFields.length; i++) {
          allEmails = allEmails + " " + toFields[i].textContent;
        }

        const toField = allEmails;
        const subjectContent = document.querySelector('[name="subjectbox"][aria-label="Subject"]').value;

        const bodyContent = document.querySelector('[role="textbox"][aria-label="Message Body"]').innerHTML;

        // Show our popup
        createPopup(toField, subjectContent, bodyContent);
      });

      // Insert the "ClickMe" button before the Send button
      sendButton.parentNode.insertBefore(clickMeButton, sendButton);

      // Store original click handler
      const originalClick = sendButton.onclick;

      sendButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

      };
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize the interception
interceptSendButton();
