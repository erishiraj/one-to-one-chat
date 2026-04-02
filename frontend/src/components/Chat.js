import React, { useState, useEffect, useRef } from "react";
import CryptoJS from "crypto-js";
import "./Chat.css";

function Chat({
  selectedUser,
  messages,
  onSendMessage,
  onTyping,
  isTyping,
  currentUser,
}) {
  const [message, setMessage] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hiddenInputRef = useRef(null);
  // Decrypt message utility
  const ENCRYPTION_KEY = "message-encryption-key-change-this-too-987654321";
  const decryptMessage = (encryptedContent) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedContent, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || encryptedContent;
    } catch (error) {
      return encryptedContent;
    }
  };
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Always focus input on mount and after messages update
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (typingTimeout) clearTimeout(typingTimeout);
    onTyping(true);
    const timeout = setTimeout(() => {
      onTyping(false);
    }, 1000);
    setTypingTimeout(timeout);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
      onTyping(false);
      if (typingTimeout) clearTimeout(typingTimeout);
      // Use the keyboard hack for iOS, otherwise always focus input
      const isIOS =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && hiddenInputRef.current) {
        hiddenInputRef.current.focus();
        setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
        }, 50);
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Clean chat: soft-delete messages in backend and refresh
  const handleCleanChat = async () => {
    if (!currentUser || !selectedUser) return;
    const confirmed = window.confirm(
      `Are you sure you want to clean the chat with ${selectedUser.username}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `http://${window.location.hostname}:5001/api/messages/${selectedUser.username}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      // Emit a socket event to notify the other user to clear chat instantly
      if (window.socket) {
        window.socket.emit("chat_cleared", {
          sender: currentUser.username,
          receiver: selectedUser.username,
        });
      }
      // Clear messages in UI immediately
      if (typeof window.setMessages === "function") {
        window.setMessages([]);
      }
    } catch (err) {
      alert("Failed to clean chat. Please try again.");
    }
  };

  // Remove listeners that clear messages from UI on refresh or user switch

  return (
    <div
      className="chat"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxHeight: "100dvh",
      }}
    >
      <div
        className="chat-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          borderBottom: "1px solid #eee",
        }}
      >
        <div className="user-avatar">
          {selectedUser.username.charAt(0).toUpperCase()}
        </div>
        <div className="user-details">
          <h3>{selectedUser.username}</h3>
          <span
            className={`status ${selectedUser.isOnline ? "online" : "offline"}`}
          >
            {selectedUser.isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <button
          className="clean-btn"
          onClick={handleCleanChat}
          title="Clean chat (hide all messages)"
          style={{
            marginLeft: "auto",
            background: "#fff",
            border: "1px solid #e67e22",
            color: "#e67e22",
            borderRadius: "4px",
            padding: "6px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 500,
          }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#e67e22"
            strokeWidth="2"
            style={{ marginRight: 2 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582M19.418 19A9 9 0 1 1 21 12.34"
            />
          </svg>
          Clean
        </button>
      </div>

      <div
        className="messages-container"
        style={{ flex: 1, overflowY: "auto", paddingBottom: 0 }}
      >
        {(Array.isArray(messages) ? messages : []).map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.sender === currentUser.username ? "sent" : "received"}`}
          >
            <div className="message-content">{decryptMessage(msg.content)}</div>
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span>{selectedUser.username} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="message-form"
        style={{
          position: "sticky",
          bottom: 0,
          background: "#fff",
          zIndex: 10,
          borderTop: "1px solid #eee",
          padding: "8px 0",
        }}
      >
        <div
          className="input-container"
          style={{ display: "flex", gap: 8, padding: "0 8px" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="message-input"
            maxLength="500"
            style={{ flex: 1, minWidth: 0 }}
            autoComplete="off"
          />
          {/* Hidden input for mobile keyboard hack */}
          <input
            ref={hiddenInputRef}
            tabIndex={-1}
            style={{
              position: "absolute",
              opacity: 0,
              height: 0,
              width: 0,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
          <button type="submit" disabled={!message.trim()} className="send-btn">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
export default Chat;
