chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for auth token changes
chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log('User signed in:', account);
  } else {
    console.log('User signed out:', account);
  }
});

// Handle any background messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthToken') {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      sendResponse({ token: token });
    });
    return true; // Will respond asynchronously
  }
});
