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

// Monitor DOM for the support button and add our icon
function addIconButton() {
  const observer = new MutationObserver((mutations) => {
    const supportButton = document.querySelector('[aria-label="Support"]');
    if (supportButton && !document.querySelector('.bot-icon-button')) {
      // Create the icon button
      const iconButton = document.createElement('img');
      iconButton.src = chrome.runtime.getURL('botIcon.jpg');
      iconButton.className = 'Xy bot-icon-button';
      iconButton.style.width = '24px';
      iconButton.style.height = '24px';
      iconButton.style.cursor = 'pointer';
      iconButton.style.verticalAlign = 'middle';
      iconButton.title = 'Click to review email';

      // Create the <a> element to wrap the icon button
      const iconLink = document.createElement('a');
      iconLink.className = 'FH';
      iconLink.href = '#';
      iconLink.appendChild(iconButton);

      // Add click event listener to the icon link
      iconLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
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

      // Create the wrapper div for the icon link
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'FI';
      iconWrapper.setAttribute('data-tooltip', 'Support');
      iconWrapper.appendChild(iconLink);

      // Insert the wrapped icon link before the parent of the Support button
      const supportButtonParent = supportButton.parentNode;
      supportButtonParent.parentNode.insertBefore(iconWrapper, supportButtonParent);

      // Stop observing once the button is added
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize the button addition
addIconButton();
