import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import Login from "./components/Login";
import Chat from "./components/Chat";
import "./App.css";

const backendHost = window.location.hostname;
const socket = io(`http://${backendHost}:5001`);
if (typeof window !== "undefined") {
  window.socket = socket;
}

function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  // Expose setMessages globally for clear event
  if (typeof window !== "undefined") {
    window.setMessages = setMessages;
    window.refreshMessages = async () => {
      if (!selectedUser) return;
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://${backendHost}:5001/api/messages/${selectedUser.username}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const messageHistory = await response.json();
        setMessages(messageHistory);
      } catch (error) {
        console.error("Error refreshing messages:", error);
      }
    };
  }

  const [isTyping, setIsTyping] = useState(false);

  // Listen for chat_cleared event to clear chat instantly for both users
  useEffect(() => {
    socket.on("chat_cleared", (data) => {
      console.log("[FRONTEND chat_cleared] event received", data, {
        user,
        selectedUser,
      });
      if (
        user &&
        selectedUser &&
        ((data.sender === user.username &&
          data.receiver === selectedUser.username) ||
          (data.sender === selectedUser.username &&
            data.receiver === user.username))
      ) {
        console.log(
          "[FRONTEND chat_cleared] Clearing messages for this chat window",
        );
        setMessages([]);
      } else {
        console.log(
          "[FRONTEND chat_cleared] Not clearing: user/selectedUser did not match",
        );
      }
    });
    return () => {
      socket.off("chat_cleared");
    };
  }, [user, selectedUser]);

  // Expose setMessages and refreshMessages globally for clear event
  if (typeof window !== "undefined") {
    window.setMessages = setMessages;
    window.refreshMessages = async () => {
      if (!selectedUser) return;
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://${backendHost}:5001/api/messages/${selectedUser.username}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const messageHistory = await response.json();
        setMessages(messageHistory);
      } catch (error) {
        console.error("Error refreshing messages:", error);
      }
    };
  }

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://${backendHost}:5001/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const usersData = await response.json();
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    // Load user from localStorage
    const savedUser = localStorage.getItem("chatUser");
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      socket.emit("join", userData.username);
      // Fetch users after joining
      fetchUsers();
    }
  }, []);

  // Fetch messages for selected user on initial load and when selectedUser changes
  useEffect(() => {
    if (!selectedUser || !user) return;
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://${backendHost}:5001/api/messages/${selectedUser.username}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const messageHistory = await response.json();
        setMessages(Array.isArray(messageHistory) ? messageHistory : []);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };
    fetchMessages();
  }, [selectedUser, user]);

  // Select the first user by default when users are loaded and no user is selected
  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      // Exclude current user from selection
      const filtered = users.filter((u) => u.username !== user?.username);
      if (filtered.length > 0) setSelectedUser(filtered[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, users, user?.username]);

  useEffect(() => {
    // Socket event listeners
    socket.on("user_status", (data) => {
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.username === data.username
            ? { ...user, isOnline: data.isOnline }
            : user,
        ),
      );
    });

    socket.on("private_message", (message) => {
      // Always append any message exchanged between the current user and selected user
      if (selectedUser) {
        setMessages((prevMessages) =>
          Array.isArray(prevMessages) ? [...prevMessages, message] : [message],
        );
      }
    });

    socket.on("typing", (data) => {
      if (data.sender === selectedUser?.username) {
        setIsTyping(data.isTyping);
      }
    });

    return () => {
      socket.off("user_status");
      socket.off("private_message");
      socket.off("typing");
    };
  }, [selectedUser, user]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("chatUser", JSON.stringify(userData));
    socket.emit("join", userData.username);
    // Fetch users after login
    fetchUsers();
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedUser(null);
    setMessages([]);
    localStorage.removeItem("chatUser");
    socket.disconnect();
  };

  const handleUserSelect = (selectedUserData) => {
    setSelectedUser(selectedUserData);
    // Do not clear messages here; useEffect will fetch correct history
  };

  const handleSendMessage = (content) => {
    if (selectedUser && content.trim()) {
      socket.emit("private_message", {
        receiver: selectedUser.username,
        content: content.trim(),
      });
    }
  };

  const handleTyping = (isTyping) => {
    if (selectedUser) {
      socket.emit("typing", {
        receiver: selectedUser.username,
        isTyping,
      });
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="user-info">
          <h3>Welcome, {user.username}</h3>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
        <div className="users-list">
          <h4>Users</h4>
          {users
            .filter((userData) => userData.username !== user.username)
            .map((userData) => (
              <div
                key={userData.username}
                className={`user-item ${selectedUser?.username === userData.username ? "active" : ""}`}
                onClick={() => handleUserSelect(userData)}
              >
                <div className="user-avatar">
                  {userData.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <span className="username">{userData.username}</span>
                  <span
                    className={`status ${userData.isOnline ? "online" : "offline"}`}
                  >
                    {userData.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
      <div className="chat-container">
        {selectedUser ? (
          <Chat
            selectedUser={selectedUser}
            messages={messages}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            isTyping={isTyping}
            currentUser={user}
          />
        ) : (
          <div className="no-chat">
            <h3>Select a user to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
