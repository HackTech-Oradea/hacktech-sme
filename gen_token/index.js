import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import open from 'open';
import destroyer from 'server-destroy';

const clientId = '438721631317-kgjfdt709eu51vdiosurvcv1rmiavehc.apps.googleusercontent.com';
const clientSecret = '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';
const redirectUri = 'http://localhost:3000/oauth2callback';

const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

const scopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly'
];

async function getAuthenticatedClient() {
  return new Promise((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
    });

    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.indexOf('/oauth2callback') > -1) {
            const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
            const code = qs.get('code');
            console.log(`Code is ${code}`);
            res.end('Authentication successful! Please return to the console.');
            server.destroy();

            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        open(authorizeUrl, { wait: false }).then(cp => cp.unref());
      });
    destroyer(server);
  });
}

async function main() {
  try {
    const client = await getAuthenticatedClient();
    console.log('Authentication successful!');
    console.log('Access token:', client.credentials.access_token);
    console.log('Refresh token:', client.credentials.refresh_token);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

main();
