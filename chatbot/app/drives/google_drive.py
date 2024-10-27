import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
from PyPDF2 import PdfReader



class GoogleDriveHandler:
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

    def __init__(self, credentials_path=".credentials/credentials.json"):
        self.credentials_path = credentials_path
        self.creds = self.authenticate()
        self.service = build('drive', 'v3', credentials=self.creds)

    def authenticate(self):
        with open(self.credentials_path, 'r') as file:
            creds_dict = json.load(file)
        creds = Credentials.from_service_account_info(creds_dict, scopes=self.SCOPES)
        return creds

    def list_files(self, page_size=10):
        results = self.service.files().list(pageSize=page_size, fields="nextPageToken, files(id, name, mimeType)").execute()
        items = results.get('files', [])
        items = [item for item in items if item['mimeType'] != 'application/vnd.google-apps.folder']
        if not items:
            print('No files found.')
            return []
        else:
            print('Files:')
            for item in items:
                print(f"{item['name']} ({item['id']}) - {item['mimeType']}")
        return items

    def extract_text(self, file_id, file_name, mime_type):
        export_mime_types = {
            'application/vnd.google-apps.document': 'text/plain',
            'application/vnd.google-apps.spreadsheet': 'text/csv',
            'application/vnd.google-apps.presentation': 'text/plain'
        }
        print(f"Starting text extraction for file: {file_name} ({file_id}) with MIME type: {mime_type}")

        try: 
            if mime_type.startswith('application/vnd.google-apps.'):
                if mime_type in export_mime_types:
                    export_mime_type = export_mime_types[mime_type]
                    request = self.service.files().export_media(fileId=file_id, mimeType=export_mime_type)
                else:
                    print(f'Skipping unsupported Google Apps file type: {file_name} ({mime_type})')
                    return None
            else:
                request = self.service.files().get_media(fileId=file_id)

            file_stream = io.BytesIO()
            downloader = MediaIoBaseDownload(file_stream, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            file_stream.seek(0)
            
            # Handle PDF files
            if mime_type == 'application/pdf':
                try:
                    pdf_reader = PdfReader(file_stream)
                    text_content = ""
                    for page in pdf_reader.pages:
                        text_content += page.extract_text() + "\n"
                    print(f"Successfully extracted text from PDF {file_name} with {len(text_content)} characters")
                    return text_content
                except Exception as e:
                    print(f'Error processing PDF {file_name}: {str(e)}')
                    return None
            
            # Handle other text files
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            text_content = None
            
            for encoding in encodings:
                try:
                    
                    text_content = file_stream.read().decode(encoding)
                    file_stream.seek(0)  # Reset position for next attempt if needed
                    break
                except UnicodeDecodeError:
                    continue
            
            if text_content is None:
                print(f'Could not decode {file_name} with any supported encoding')
                return None
                
            print(f'Successfully extracted text from {file_name}')
            return text_content
            
        except Exception as e:
            print(f'Error processing {file_name}: {str(e)}')
            return None

    def call(self):
        # List files - call list_files with self instead of service
        files = self.list_files()

        texts = []
        # Read files
        for file in files:
            text = self.extract_text(file['id'], file['name'], file['mimeType'])
            print(f"Extracted text from {file['name']}: {text}")
            if text:
                texts.append(text)
        print(f"Extracted {len(texts)} texts from {len(files)} files")
        metadatas = []
        for file in files:
            metadatas.append({
            'title': file['name'],
            'url': f"https://drive.google.com/file/d/{file['id']}/view",
            })
        return texts, metadatas
        