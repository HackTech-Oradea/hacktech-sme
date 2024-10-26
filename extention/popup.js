document.addEventListener('DOMContentLoaded', function() {
  const loginButton = document.getElementById('login');
  const loginContainer = document.getElementById('login-container');
  const filesContainer = document.getElementById('files-container');
  const filesList = document.getElementById('files-list');

  loginButton.addEventListener('click', async () => {
    try {
      // Request token through background script
      chrome.runtime.sendMessage({ action: 'getAuthToken' }, async function(response) {
        if (response && response.token) {
          loginContainer.style.display = 'none';
          filesContainer.style.display = 'block';
          
          // Fixed: Using response.token instead of re.token
          const re = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10', {
            headers: {
              'Authorization': `Bearer ${response.token}`
            }
          });
          
          const data = await re.json();
          
          // Display files
          filesList.innerHTML = data.files
            .map(file => `<div class="file-item">${file.name}</div>`)
            .join('');
        } else {
          console.error('Authentication failed', response);
        }
      });
    } catch (error) {
      console.error('Error:', error);
    }
  });
});
