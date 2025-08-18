const BACKEND_URL = "https://camlive-backend.onrender.com"; // ton URL Render

const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnStart    = document.getElementById("start");
const btnLeave    = document.getElementById("leave");
const statusEl    = document.getElementById("status");

const socket = io(BACKEND_URL, { path: "/socket.io", transports: ["websocket"] });

let pc, localStream, currentRoom = null;
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const setStatus = (t) => statusEl.textContent = t;
const enableInCall = (b) => { btnLeave.disabled = !b; };

async function ensureLocalStream() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({
    video: isIOS
      ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });
  localVideo.srcObject = localStream;
  return localStream;
}

async function applyVideoSendingParams() {
  const vSender = pc.getSenders().find(s => s.track && s.track.kind === "video");
  if (!vSender) return;
  const vTrack = vSender.track;
  if (vTrack && "contentHint" in vTrack) vTrack.contentHint = "motion";
  const params = vSender.getParameters();
  params.degradationPreference = "balanced";
  params.encodings = [{ maxBitrate: isIOS ? 600_000 : 1_200_000, maxFramerate: isIOS ? 24 : 30 }];
  await vSender.setParameters(params);
}

function createPeer() {
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
    ]
  });
  pc.oniceconnectionstatechange = () => console.log("ICE:", pc.iceConnectionState);
  pc.onconnectionstatechange   = () => console.log("PC:", pc.connectionState);
  pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };
  pc.onicecandidate = (e) => {
    if (e.candidate && currentRoom) socket.emit("candidate", { room: currentRoom, candidate: e.candidate });
  };
}

btnStart.onclick = async () => {
  btnStart.disabled = true;
  setStatus("En file d'attente… clique Start aussi sur l'autre appareil");
  socket.emit("join");
};

btnLeave.onclick = () => {
  cleanup();
  setStatus("Appel terminé.");
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
