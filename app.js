const socket = io("https://camlive-backend.onrender.com");
const pc = new RTCPeerConnection();
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};

document.getElementById("start").onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  localVideo.srcObject = stream;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
};

socket.on("offer", async (offer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", async (answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("candidate", event.candidate);
  }
};

socket.on("candidate", async (candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding candidate", err);
  }
});
