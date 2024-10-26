function createPopup() {
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'gmail-interceptor-popup';

  // Create popup content
  popup.innerHTML = `
    <div class="popup-content">
      <h2>Email Details</h2>
      <p><strong>To:</strong> $ToField value</p>
      <p><strong>Subject:</strong> subjectContent</p>
      <div class="body-content">
        <strong>Body:</strong>
        <textarea id="emailBody" rows="10" cols="50" class="scroll-content"></textarea>
      </div>
      <div class="button-container">
        <button id="confirmSend">Send</button>
        <button id="cancelSend">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Set the initial value of the textarea
  document.getElementById('emailBody').value = 'bodyContent';

  // Add event listeners for buttons
  document.getElementById('confirmSend').addEventListener('click', () => {
    // Get the updated email body content
    const updatedBody = document.getElementById('emailBody').value;
    // Here you can add logic to update the email body with the new content
    
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
      iconButton.src = chrome.runtime.getURL('botIcon.png');
      iconButton.className = 'Xy bot-icon-button';
      iconButton.style.width = '24px';
      iconButton.style.height = '24px';
      iconButton.style.cursor = 'pointer';
      iconButton.style.verticalAlign = 'middle';
      //iconButton.title = 'Click to review email';

      // Create the <a> element to wrap the icon button
      const iconLink = document.createElement('a');
      iconLink.className = 'FH';
      iconLink.href = '#';
      iconLink.appendChild(iconButton);

      // Create the pop-up banner
      const popupBanner = document.createElement('div');
      popupBanner.className = 'ai-chatbot-popup';
      popupBanner.textContent = 'Try our AI ChatBot';
      popupBanner.style.display = 'none';

      // Add event listeners for showing/hiding the pop-up banner
      iconLink.addEventListener('mouseenter', () => {
        popupBanner.style.display = 'block';
      });
      iconLink.addEventListener('mouseleave', () => {
        popupBanner.style.display = 'none';
      });

      // Add click event listener to the icon link
      iconLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get compose window content

        // Show our popup
        createPopup();
      });

      // Create the wrapper div for the icon link and pop-up banner
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'FI';
      iconWrapper.appendChild(iconLink);
      iconWrapper.appendChild(popupBanner);

      // Insert the wrapped icon link before the parent of the Support button
      const supportButtonParent = supportButton.parentNode;
      supportButtonParent.parentNode.insertBefore(iconWrapper, supportButtonParent);

      // Show the banner after a short delay
      setTimeout(() => {
        popupBanner.style.display = 'block';
        setTimeout(() => {
          popupBanner.style.display = 'none';
        }, 5000); // Hide the banner after 5 seconds
      }, 1000); // Show the banner 1 second after the icon is added

      // Stop observing once the button is added
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize the button addition after the page has loaded
window.onload = () => {
  setTimeout(addIconButton, 1000); // Wait for 1 second after the page load event
};
