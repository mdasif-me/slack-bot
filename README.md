# Slack Bot

A lightweight Node.js application that integrates with Slack to send/receive messages, manage channels, and handle webhooks. Built with Express and Slack Bolt for seamless communication with the Slack API.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Setup](#environment-setup)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)

---

## 🎯 Project Overview

**Slack Bot** is a REST API server that acts as a bridge between your applications and Slack. It provides endpoints to:

- Send messages to Slack channels
- Retrieve message history
- List and manage channels
- Handle incoming webhooks
- Support threaded conversations and rich message formatting

The bot uses **Slack Bolt** framework for reliable event handling and the **Express.js** web framework to expose HTTP endpoints that other services can call.

---

## 🛠 Tech Stack

| Technology      | Purpose                                |
| --------------- | -------------------------------------- |
| **Node.js**     | JavaScript runtime environment         |
| **Express.js**  | Web framework for HTTP API endpoints   |
| **@slack/bolt** | Official Slack SDK for bot development |
| **dotenv**      | Environment variable management        |
| **axios**       | HTTP client (dependency ready)         |

---

## ✨ Features

### Message Management

- ✅ **Send Messages** - Post messages to channels with optional threads, blocks, and attachments
- ✅ **Retrieve Messages** - Fetch message history from channels with pagination support
- ✅ **Thread Support** - Reply to specific messages in threads

### Channel Operations

- ✅ **List Channels** - Get all available channels (public & private)
- ✅ **Channel Info** - Retrieve detailed information about a specific channel
- ✅ **Smart Channel Lookup** - Resolve channel names to IDs automatically

### Webhook Integration

- ✅ **Incoming Webhooks** - Accept POST requests to post messages via webhook

### Error Handling

- ✅ **Comprehensive Error Messages** - Clear feedback on what went wrong and how to fix it
- ✅ **Scope Validation** - Helpful hints when bot permissions are missing
- ✅ **Channel Resolution** - Automatic fallback from channel names to IDs

---

## 🚀 Getting Started

### Prerequisites

- Node.js 14+ installed
- Slack workspace with bot app created at https://api.slack.com/apps
- Bot token and signing secret from Slack

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd slack-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables** (see [Environment Setup](#environment-setup))

4. **Start the server**

   ```bash
   node app.js
   ```

   You should see:

   ```
   ⚡️ Slack bot is running!
   🌐 Web interface: http://localhost:5000
   ```

---

## 🔐 Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Slack API Credentials (get from https://api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# Optional
SLACK_DEFAULT_CHANNEL=#general
PORT=5000
```

### How to Get Slack Credentials

1. Go to https://api.slack.com/apps
2. Create a new app or select your existing app
3. Navigate to **OAuth & Permissions**
4. Copy your **Bot Token** (starts with `xoxb-`)
5. Go to **Basic Information** → **App Credentials** → Copy **Signing Secret**
6. Add required scopes (see [Scopes Needed](#scopes-needed))

### Required Scopes

Add these scopes in **OAuth & Permissions > Bot Token Scopes**:

- `chat:write` - Send messages
- `channels:read` - List and get channel info
- `channels:join` - Join channels
- `conversations:history` - Read message history

---

## 🔗 API Endpoints

### 1. Send Message to Channel

**POST** `/api/send-message`

Send a message to a Slack channel.

**Request Body:**

```json
{
  "channel": "#general",
  "message": "Hello Slack!",
  "thread_ts": "1234567890.123456", // Optional: reply in thread
  "blocks": [], // Optional: rich formatting
  "attachments": [] // Optional: attachments
}
```

**Response:**

```json
{
  "success": true,
  "message": "Sent to #general",
  "timestamp": "1234567890.123456",
  "channel": "C1234567890"
}
```

---

### 2. Get Messages from Channel

**POST** `/api/get-messages`

Retrieve message history from a channel.

**Request Body:**

```json
{
  "channel": "#general", // Required
  "limit": 10, // Optional: 1-100, default 10
  "cursor": "dXNlcjpVMDZSVkpWVFQ=" // Optional: for pagination
}
```

**Response:**

```json
{
  "success": true,
  "channel": "#general",
  "channel_id": "C1234567890",
  "message_count": 10,
  "messages": [
    {
      "timestamp": "1234567890.123456",
      "user": "U1234567890",
      "text": "Hello!",
      "type": "message",
      "reply_count": 0
    }
  ],
  "has_more": true,
  "next_cursor": "dXNlcjpVMDZSVkpWVFQ="
}
```

---

### 3. List All Channels

**GET** `/api/list-channels`

Get all public and private channels the bot has access to.

**Response:**

```json
{
  "success": true,
  "channel_count": 5,
  "channels": [
    {
      "id": "C1234567890",
      "name": "general",
      "is_private": false,
      "is_member": true,
      "num_members": 25
    }
  ]
}
```

---

### 4. Get Channel Info

**GET** `/api/channel-info?channel=general`

Get detailed information about a specific channel.

**Query Parameters:**

- `channel` (required) - Channel name or ID

**Response:**

```json
{
  "success": true,
  "channel": {
    "id": "C1234567890",
    "name": "general",
    "created": 1234567890,
    "is_private": false,
    "num_members": 25
  }
}
```

---

### 5. Webhook Integration

**POST** `/webhook`

Accept incoming webhooks and post messages to Slack.

**Request Body:**

```json
{
  "text": "Alert message", // Required
  "channel": "#alerts", // Optional
  "username": "alert-bot", // Optional
  "icon_emoji": ":warning:", // Optional
  "attachments": [] // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Message posted to Slack",
  "channel": "#alerts",
  "ts": "1234567890.123456"
}
```

---

## 💡 Usage Examples

### Example 1: Send a Simple Message

```bash
curl -X POST http://localhost:5000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#general",
    "message": "Hello team! 👋"
  }'
```

### Example 2: Retrieve Last 5 Messages

```bash
curl -X POST http://localhost:5000/api/get-messages \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#general",
    "limit": 5
  }'
```

### Example 3: List All Channels

```bash
curl http://localhost:5000/api/list-channels
```

### Example 4: Post via Webhook (from another service)

```bash
curl -X POST http://localhost:5000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Production deployment completed",
    "channel": "#deployments",
    "username": "DeployBot"
  }'
```

---

## 📝 Notes for Developers

- **Channel Names vs IDs**: The API handles both. Use `#general` or `C1234567890` interchangeably
- **Error Messages**: All errors include helpful hints on how to resolve the issue
- **Scopes**: If you get a `missing_scope` error, add the required scope to your bot and reinstall
- **Rate Limits**: Slack has rate limits. Implement exponential backoff for production use
- **Threading**: Use `thread_ts` from a message to reply in threads

---

## 📄 License

ISC

---

**Built with ❤️ for seamless Slack integration**
