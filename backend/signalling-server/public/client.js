// public/client.js
(async function () {
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  const identity = params.get('identity') || `guest-${Math.random().toString(36).slice(2,6)}`;
  const wantOwner = params.get('owner') === '1';

  const titleEl = document.getElementById('title');
  const metaEl = document.getElementById('meta');
  const videos = document.getElementById('videos');
  const logEl = document.getElementById('log');

  function log(...args) {
    console.log(...args);
    logEl.innerText = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  }

  if (!room) {
    titleEl.innerText = 'Missing room';
    metaEl.innerText = 'Please provide ?room=... in the URL';
    return;
  }

  titleEl.innerText = `Room: ${room}`;
  metaEl.innerText = `Identity: ${identity} ${wantOwner ? '(owner)' : ''}`;

  // fetch ICE servers from server
  async function fetchIceServers() {
    try {
      const resp = await fetch('/api/ice-servers');
      return await resp.json();
    } catch (err) {
      console.warn('ICE fetch failed', err);
      return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    }
  }

  const { iceServers } = await fetchIceServers();

  const socket = io();
  const pcs = {}; // peerConnection map: socketId -> RTCPeerConnection
  let localStream;

  async function getLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // show local
      const localContainer = document.createElement('div');
      localContainer.className = 'participant';
      const label = document.createElement('div');
      label.innerText = `${identity} (you)`;
      localContainer.appendChild(label);

      const v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true;
      v.srcObject = localStream;
      localContainer.appendChild(v);
      videos.appendChild(localContainer);
    } catch (err) {
      console.error('getUserMedia failed', err);
      alert('Could not access camera/microphone: ' + err.message);
      throw err;
    }
  }

  function createVideoElementFor(id, labelText) {
    const container = document.createElement('div');
    container.className = 'participant';
    container.setAttribute('data-sid', id);

    const label = document.createElement('div');
    label.innerText = labelText;
    container.appendChild(label);

    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    container.appendChild(v);

    const controls = document.createElement('div');
    controls.className = 'controls';
    container.appendChild(controls);

    videos.appendChild(container);
    return container;
  }

  function attachTrack(container, track) {
    try {
      if (track.kind === 'video') {
        const el = track.attach();
        el.style.width = '320px';
        container.appendChild(el);
      } else if (track.kind === 'audio') {
        const el = track.attach();
        el.style.display = 'none';
        container.appendChild(el);
      }
    } catch (err) {
      console.warn('attach failed', err);
    }
  }

  function detachTracks(container) {
    const video = container.querySelector('video');
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(t => t.stop());
    }
    container.remove();
  }

  // create RTCPeerConnection with handlers
  function createPeerConnection(targetSocketId, remoteIdentity, isInitiator) {
    log('createPeerConnection', targetSocketId, 'initiator?', isInitiator);
    if (pcs[targetSocketId]) return pcs[targetSocketId];

    const pc = new RTCPeerConnection({ iceServers });
    pcs[targetSocketId] = pc;

    // add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // when remote track arrives, attach to UI
    const remoteContainer = createVideoElementFor(targetSocketId, remoteIdentity || targetSocketId);
    pc.ontrack = (ev) => {
      // use first stream
      const stream = ev.streams && ev.streams[0];
      const videoTag = remoteContainer.querySelector('video');
      if (videoTag) videoTag.srcObject = stream;
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit('signal', { to: targetSocketId, signal: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        log('PC closed for', targetSocketId);
        try { pc.close(); } catch (e) {}
        delete pcs[targetSocketId];
        const el = document.querySelector(`[data-sid="${targetSocketId}"]`);
        if (el) detachTracks(el);
      }
    };

    // If initiator create offer
    (async () => {
      try {
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { to: targetSocketId, signal: pc.localDescription });
        }
      } catch (err) {
        console.error('offer error', err);
      }
    })();

    return pc;
  }

  // handle incoming signals
  socket.on('signal', async (data) => {
    try {
      const from = data.from;
      const signal = data.signal;
      if (!pcs[from]) {
        // create pc (not initiator)
        createPeerConnection(from, data.fromIdentity || from, false);
      }
      const pc = pcs[from];
      if (!pc) return;

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, signal: pc.localDescription });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    } catch (err) {
      console.error('signal handler error', err);
    }
  });

  socket.on('connect', async () => {
    log('socket connect', socket.id);
    // ensure we have local media first
    await getLocalMedia();
    // join-room
    socket.emit('join-room', { roomId: room, identity, wantOwner });
  });

  socket.on('existing-participants', (list) => {
    // list: array of { socketId, identity }
    log('existing', list);
    (list || []).forEach(p => {
      // create peer and initiate offer TO each existing participant
      createPeerConnection(p.socketId, p.identity, true);
    });
  });

  socket.on('new-participant', (payload) => {
    // payload: { socketId, identity }
    log('new participant', payload);
    // create PC that will be answerer (isInitiator=false)
    createPeerConnection(payload.socketId, payload.identity, false);
  });

  socket.on('participant-left', (payload) => {
    log('participant-left', payload);
    const el = document.querySelector(`[data-sid="${payload.socketId}"]`);
    if (el) detachTracks(el);
    if (pcs[payload.socketId]) {
      try { pcs[payload.socketId].close(); } catch(e){}
      delete pcs[payload.socketId];
    }
  });

  socket.on('owner-changed', (payload) => {
    log('owner-changed', payload);
  });

  socket.on('kicked', (payload) => {
    alert('You were kicked: ' + (payload && payload.reason));
    // cleanup
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    Object.values(pcs).forEach(pc => { try { pc.close(); } catch (e) {} });
    socket.disconnect();
    location.href = '/';
  });

})();
