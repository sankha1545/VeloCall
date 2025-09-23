// server/public/client.js
(function () {
  // parse query params: ?room=room-abc&video=true
  const params = new URLSearchParams(location.search);
  const room = params.get("room") || "default-room";
  const startWithVideo = params.get("video") !== "false"; // default true

  document.getElementById("roomLabel").textContent = `Room: ${room}`;

  const localVideo = document.getElementById("localVideo");
  const videosDiv = document.getElementById("videos");

  // ws URL (same host)
  const wsUrl = ((location.protocol === "https:") ? "wss://" : "ws://") + location.host + "/ws";
  const ws = new WebSocket(wsUrl);
  let myId = null;

  // peers: remoteId -> RTCPeerConnection
  const peers = new Map();
  // remote video elements
  const remoteVideos = new Map();

  // Optional STUN servers - uncomment if you want better NAT traversal:
  // const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  const ICE_CONFIG = { iceServers: [] };

  const localStreamPromise = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: startWithVideo
  });

  function createRemoteVideoEl(id) {
    const v = document.createElement("video");
    v.autoplay = true;
    v.playsInline = true;
    v.id = `remote-${id}`;
    v.style.width = "30%";
    v.style.borderRadius = "8px";
    v.style.margin = "6px";
    videosDiv.appendChild(v);
    remoteVideos.set(id, v);
    return v;
  }

  ws.addEventListener("open", () => {
    console.log("ws open, joining room", room);
    ws.send(JSON.stringify({ type: "join", room }));
  });

  ws.addEventListener("message", async (ev) => {
    const msg = JSON.parse(ev.data);
    // console.log("ws msg", msg);
    if (msg.type === "joined") {
      myId = msg.id;
      const others = msg.others || [];
      const localStream = await localStreamPromise;
      localVideo.srcObject = localStream;

      // create offer to each existing peer
      others.forEach(async (otherId) => {
        await createOfferToPeer(otherId, localStream);
      });
    } else if (msg.type === "new-peer") {
      // a new peer joined - existing peers should create an offer to them
      const newId = msg.id;
      const localStream = await localStreamPromise;
      await createOfferToPeer(newId, localStream);
    } else if (msg.type === "signal") {
      const from = msg.from;
      const payload = msg.payload;
      await handleSignal(from, payload);
    } else if (msg.type === "peer-left") {
      const id = msg.id;
      closePeer(id);
    }
  });

  async function createOfferToPeer(remoteId, localStream) {
    if (peers.has(remoteId)) return;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peers.set(remoteId, pc);

    // add local tracks
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    // create remote video element set remote track when added
    const remoteVideo = createRemoteVideoEl(remoteId);

    // when remote track arrives
    pc.ontrack = (ev) => {
      // assign stream
      remoteVideo.srcObject = ev.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: "signal",
          room,
          to: remoteId,
          from: myId,
          payload: { type: "candidate", candidate: event.candidate }
        }));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({
      type: "signal",
      room,
      to: remoteId,
      from: myId,
      payload: { type: "offer", sdp: offer.sdp }
    }));
  }

  async function handleSignal(from, payload) {
    // if we don't have a peer for "from", create one (we are being offered)
    if (!peers.has(from)) {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      peers.set(from, pc);

      const remoteVideo = createRemoteVideoEl(from);

      pc.ontrack = (ev) => {
        remoteVideo.srcObject = ev.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({
            type: "signal",
            room,
            to: from,
            from: myId,
            payload: { type: "candidate", candidate: event.candidate }
          }));
        }
      };

      // attach local stream tracks
      const localStream = await localStreamPromise;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    const pc = peers.get(from);

    if (payload.type === "offer") {
      const desc = { type: "offer", sdp: payload.sdp };
      await pc.setRemoteDescription(desc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({
        type: "signal",
        room,
        to: from,
        from: myId,
        payload: { type: "answer", sdp: answer.sdp }
      }));
    } else if (payload.type === "answer") {
      const desc = { type: "answer", sdp: payload.sdp };
      await pc.setRemoteDescription(desc);
    } else if (payload.type === "candidate") {
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch (e) {
        console.warn("Failed to add candidate", e);
      }
    }
  }

  function closePeer(id) {
    const pc = peers.get(id);
    if (pc) {
      try { pc.close(); } catch(e) {}
      peers.delete(id);
    }
    const v = remoteVideos.get(id);
    if (v && v.parentNode) v.parentNode.removeChild(v);
    remoteVideos.delete(id);
  }

  // leave handler
  document.getElementById("btnLeave").addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "leave", room }));
    ws.close();
    // stop local stream
    localStreamPromise.then((s) => {
      s.getTracks().forEach((t) => t.stop());
    });
    // remove remote videos
    for (const id of Array.from(remoteVideos.keys())) closePeer(id);
    alert("Left the room");
  });

})();
