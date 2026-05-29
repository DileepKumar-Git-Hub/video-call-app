<h1 align="center">📹 Video Call App</h1>

<p align="center">
  <b>Real-time peer-to-peer video calling powered by WebRTC</b><br/>
  1-on-1 & group calls · Screen sharing · Live chat · Room-based joining
</p>

<p align="center">
  <a href="YOUR_LIVE_DEMO_LINK">
    <img src="https://img.shields.io/badge/Live_Demo-🚀_Click_Here-20232A?style=for-the-badge"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-brightgreen?style=flat"/>
  <img src="https://img.shields.io/badge/Made_With-WebRTC_+_Node.js-blue?style=flat"/>
  <img src="https://img.shields.io/badge/No_Framework-Pure_HTML_JS_CSS-orange?style=flat"/>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📞 **1-on-1 Video Calls** | Crystal clear peer-to-peer video calling between two users |
| 👥 **Group Video Calls** | Multi-participant video rooms with real-time streams |
| 🔗 **Room-based Joining** | Create or join a room instantly via a shareable link |
| 💬 **Live Text Chat** | Send messages alongside your video call in real time |
| 🖥️ **Screen Sharing** | Share your screen with all participants in one click |
| 🎙️ **Mute / Camera Toggle** | Control your mic and camera anytime during the call |

---

## 🛠️ Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)

### How it works

User A  ──────►  Signaling Server (Node.js + Socket.io)  ◄──────  User B
│
Exchange SDP & ICE
│
User A  ◄─────────── WebRTC P2P ───────────►  User B
(direct peer connection)

---

## 📸 Screenshots

> _Add screenshots here_
>
> ```
> ![Home / Join Room](screenshots/home.png)
> ![Video Call Room](screenshots/video-room.png)
> ![Screen Sharing](screenshots/screen-share.png)
> ![Live Chat](screenshots/chat.png)
> ```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome / Firefox / Edge)

---

### 1. Clone the Repository

```bash
git clone https://github.com/DileepKumar-Git-Hub/video-call-app.git
cd video-call-app
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Start the Server

```bash
node server.js
```

---

### 4. Open in Browser
http://localhost:3000

> Open in two different browser tabs or devices to test a call between two users.

---

## 📁 Project Structure

video-call-app/
├── public/
│   ├── index.html          # Landing / room join page
│   ├── room.html           # Video call room page
│   ├── style.css           # Global styles
│   └── script.js           # WebRTC logic & socket events
│
├── server.js               # Node.js signaling server
├── package.json
└── README.md

---

## ⚙️ How It Works
User creates or joins a room via a unique room ID
Node.js server acts as a signaling server using Socket.io
Peers exchange SDP offers/answers & ICE candidates via the server
Once connected, audio/video streams directly peer-to-peer via WebRTC
Text chat messages are relayed through the Socket.io server
Screen sharing uses browser's getDisplayMedia() API

---

## 🌐 Browser Support

| Browser | Supported |
|---------|-----------|
| ✅ Chrome | Full support |
| ✅ Firefox | Full support |
| ✅ Edge | Full support |
| ⚠️ Safari | Partial (some WebRTC limitations) |
| ❌ IE | Not supported |

---

## 🌐 Live Demo

🔗 **[Click here to try the live app](YOUR_LIVE_DEMO_LINK)**

> Works best on Chrome or Firefox. Allow camera & microphone permissions when prompted.

---

## 🗺️ Roadmap

- [x] 1-on-1 video calling
- [x] Group video calls
- [x] Room-based joining via shareable link
- [x] Live text chat
- [x] Screen sharing
- [ ] Recording support
- [ ] Virtual backgrounds
- [ ] Mobile responsive UI

---

## 🙋‍♂️ Author

**Dileep Kumar**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/dileep-kumar-dornala)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=flat&logo=gmail&logoColor=white)](mailto:dornaladileepkumar9090909090@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/DileepKumar-Git-Hub)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by Dileep Kumar · Hyderabad, India
</p>
