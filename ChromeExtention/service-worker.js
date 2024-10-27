chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log('User signed in:', account);
  } else {
    console.log('User signed out:', account);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthToken') {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      sendResponse({ token: token });
    });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );
  }
});
  