63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
97
98
99
100
101
102
103
104
105
106
107
108
109
110
111
112
113
114
115
116
117
118
119
120
const BACKEND_URL = "https://camlive-backend.onrender.com"; // ton URL Render
  btnStart.disabled = false;
  enableInCall(false);
};

function cleanup() {
  currentRoom = null;
  if (pc) { try { pc.close(); } catch {} }
  pc = null;
  remoteVideo.srcObject = null;
}

socket.on("matched", async (room) => {
  currentRoom = room;
  enableInCall(true);
  setStatus("Connecté ! Préparation de l'appel…");

  createPeer();
  const stream = await ensureLocalStream();
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
  await applyVideoSendingParams();

  try {
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    socket.emit("offer", { room: currentRoom, sdp: offer });
    setStatus("Appel en cours…");
  } catch (e) {
    console.error("createOffer error", e);
  }
});

socket.on("offer", async (sdp) => {
  try {
    if (!pc) {
      createPeer();
      const stream = await ensureLocalStream();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await applyVideoSendingParams();
    }
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { room: currentRoom, sdp: answer });
  } catch (e) {
    console.error("handle offer error", e);
  }
});

socket.on("answer", async (sdp) => {
  try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }
  catch (e) { console.error("handle answer error", e); }
});

socket.on("candidate", async ({ candidate }) => {
  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
  catch (e) { console.error("ICE add error", e); }
});

Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
