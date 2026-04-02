# One-to-One Chat Application

A full-stack real-time chat application built with React, Node.js, Express, Socket.IO, and MongoDB.

## Features

- **Real-time messaging** with WebSocket connections
- **User authentication** with JWT tokens
- **One-to-one chat** interface
- **Online/offline status** indicators
- **Message encryption** for security
- **Typing indicators**
- **Message timestamps**
- **Responsive design** for mobile and desktop
- **Auto-scroll** to latest messages

## Tech Stack

### Frontend

- React 18 (Functional components with hooks)
- Socket.IO Client for real-time communication
- CSS3 with Flexbox/Grid for responsive design
- CryptoJS for message encryption/decryption

### Backend

- Node.js with Express
- Socket.IO for WebSocket server
- MongoDB with Mongoose ODM
- JWT for authentication
- bcryptjs for password hashing
- CryptoJS for message encryption

### Database

- MongoDB for storing users and messages
- Message encryption with AES

## Project Structure

```
chat-app/
├── backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Login.css
│   │   │   ├── Chat.js
│   │   │   └── Chat.css
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json      # Frontend dependencies
└── README.md
```

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** - [Download here](https://www.mongodb.com/try/download/community)
- **npm** or **yarn** package manager

## Installation & Setup

### 1. Clone or Download the Project

```bash
# If cloning from git
git clone <repository-url>
cd chat-app
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Install and start MongoDB (required for full functionality)
# On macOS with Homebrew:
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# On Windows/Linux, follow MongoDB installation instructions for your OS

# Start the backend server
npm run dev
```

The backend server will start on `http://localhost:5001`

### 3. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

The frontend will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your-super-secret-jwt-key-here
ENCRYPTION_KEY=your-message-encryption-key-here
PORT=5000
```

**Security Note:** Change the `JWT_SECRET` and `ENCRYPTION_KEY` to strong, unique values in production.

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Select User**: Click on any user from the sidebar to start a chat
3. **Send Messages**: Type your message and press Enter or click Send
4. **Real-time Updates**: Messages appear instantly for both users
5. **Online Status**: See when users come online/offline
6. **Typing Indicators**: See when someone is typing

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users

- `GET /api/users` - Get all users (authenticated)

### Messages

- `GET /api/messages/:username` - Get chat history with specific user

## WebSocket Events

### Client to Server

- `join` - User joins with username
- `private_message` - Send private message
- `typing` - Send typing indicator
- `message_read` - Mark messages as read

### Server to Client

- `user_status` - User online/offline status update
- `private_message` - Receive private message
- `typing` - Receive typing indicator

## Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Token-based authentication for API access
- **Message Encryption**: AES encryption for message content
- **Input Validation**: Server-side validation for all inputs
- **CORS Protection**: Configured CORS for frontend-backend communication

## Mobile Responsiveness

The application is fully responsive and works on:

- Desktop computers
- Tablets
- Mobile phones (iOS and Android)

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Backend Issues

- **MongoDB Connection Error**: Make sure MongoDB is running
- **Port Already in Use**: Change PORT in .env file
- **CORS Errors**: Check CORS configuration in server.js

### Frontend Issues

- **WebSocket Connection Failed**: Ensure backend is running on port 5000
- **API Errors**: Check network tab in browser dev tools
- **Build Errors**: Clear node_modules and reinstall dependencies

### Common Issues

- **Messages not appearing**: Check WebSocket connection and encryption keys
- **Login not working**: Verify JWT_SECRET in .env matches
- **Users not showing**: Check MongoDB connection and user collection

## Development

### Adding New Features

1. Backend changes: Modify `server.js` and restart server
2. Frontend changes: React hot-reload will update automatically
3. Database changes: Update Mongoose schemas as needed

### Code Style

- Use functional components with hooks in React
- Follow Express.js best practices for API routes
- Use async/await for asynchronous operations
- Add proper error handling and validation

## Deployment

### Backend Deployment

1. Set environment variables in production
2. Use a production MongoDB instance (MongoDB Atlas)
3. Set NODE_ENV=production
4. Use a process manager like PM2

### Frontend Deployment

1. Build the production bundle: `npm run build`
2. Serve static files from the `build` directory
3. Configure proxy for API calls in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please create an issue in the repository or contact the development team.
