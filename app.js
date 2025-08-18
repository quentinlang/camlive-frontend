// ----- Socket.IO vers ton backend Render -----
const socket = io("https://camlive-backend.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"]
});

// ----- RTCPeerConnection + STUN -----
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
  ]
});

const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;

// utilitaire: ouvre la cam/micro si pas déjà fait
async function ensureLocalStream() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    localVideo.srcObject = localStream;
  }
}

// debug utile
pc.oniceconnectionstatechange = () => console.log("ICE:", pc.iceConnectionState);
pc.onconnectionstatechange   = () => console.log("PC:", pc.connectionState);

// vidéo distante
pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };

// bouton démarrer : on devient "caller" => on crée l'offer
document.getElementById("start").onclick = async () => {
  await ensureLocalStream();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
};

// on reçoit une offer : on devient "callee" => on ouvre la cam PUIS on répond
socket.on("offer", async (offer) => {
  await ensureLocalStream();                        // <-- IMPORTANT
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// on reçoit une answer
socket.on("answer", async (answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// échange ICE
pc.onicecandidate = (e) => { if (e.candidate) socket.emit("candidate", e.candidate); };
socket.on("candidate", async (c) => {
  try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
  catch (err) { console.error("ICE add error", err); }
});


