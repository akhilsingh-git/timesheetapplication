# To run the application locally, follow these steps:

Prerequisites
Python 3.10+
Node.js 16+
MongoDB (running locally or a cloud connection string)

# 1. Backend Setup
Navigate to the backend directory:
cd backend
Install dependencies:
pip install -r requirements.txt
Create a .env file in /backend with:
MONGO_URL="mongodb://localhost:27017"
DB_NAME="timesheet_db"
SECRET_KEY="your_secret_key"

Run the server:
python server.py
The API will run at http://localhost:8001

# 2. Frontend Setup
Navigate to the frontend directory:
cd frontend
Install dependencies:
yarn install
Create a .env file in /frontend with:
REACT_APP_BACKEND_URL=http://localhost:8001
Start the app:
yarn start
The app will open at http://localhost:3000

# Default Login
Email: admin@example.com
Password: admin
