import { useState, useEffect, useRef } from "react";
import { useAppStore } from "./store/useAppStore";
import { useSignaling, api } from "./hooks/useSignaling";
import { useWebRTC } from "./hooks/useWebRTC";

const API = `http://${window.location.hostname}:5000`;

function App() {
  const {
    user, setUser, activeTab, setActiveTab,
    currentRoom, setRoom, isMuted, isDeafened, toggleMute, toggleDeafen,
    friends, setFriends, pendingRequests, setPendingRequests,
    onlineUsers, messages, addMessage,
    dmTarget, setDmTarget, dmMessages, addDm,
    roomParticipants
  } = useAppStore();

  const { socket, joinRoom, leaveRoom, sendMessage, sendDm } = useSignaling();
  const { remoteStreams } = useWebRTC(socket, currentRoom);
  const [inviteCode, setInviteCode] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [dmInput, setDmInput] = useState("");
  const [friendTag, setFriendTag] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView(); }, [messages, dmMessages]);

  // Poll friends list
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [fl, pl] = await Promise.all([api.getFriends(user.token), api.getPending(user.token)]);
        if (fl.friends) setFriends(fl.friends);
        if (pl.pending) setPendingRequests(pl.pending);
      } catch {}
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [user, setFriends, setPendingRequests]);

  const handleAuth = async () => {
    if (!authUser || !authPass) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = authMode === 'register'
        ? await api.register(authUser, authPass)
        : await api.login(authUser, authPass);
      if (data.error) { setAuthError(data.error); }
      else { setUser({ username: data.username, discriminator: data.discriminator, token: data.token }); }
    } catch { setAuthError("Cannot connect to server"); }
    setAuthLoading(false);
  };

  const handleAddFriend = async () => {
    if (!friendTag || !user) return;
    const res = await api.sendFriendRequest(user.token, friendTag);
    if (res.error) alert(res.error);
    else { setFriendTag(""); alert("Friend request sent!"); }
  };

  const handleAcceptFriend = async (fromId: number) => {
    if (!user) return;
    await api.acceptFriend(user.token, fromId);
    const [fl, pl] = await Promise.all([api.getFriends(user.token), api.getPending(user.token)]);
    if (fl.friends) setFriends(fl.friends);
    if (pl.pending) setPendingRequests(pl.pending);
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !currentRoom) return;
    sendMessage(currentRoom, chatInput);
    addMessage({ from: `${user?.username}#${user?.discriminator}`, message: chatInput, timestamp: Date.now() });
    setChatInput("");
  };

  const handleSendDm = () => {
    if (!dmInput.trim() || !dmTarget) return;
    sendDm(dmTarget, dmInput);
    addDm(dmTarget, { from: `${user?.username}#${user?.discriminator}`, message: dmInput, timestamp: Date.now() });
    setDmInput("");
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    const res = await api.createRoom(user.token);
    if (res.code) {
      setInviteCode(res.code);
      joinRoom(res.code);
      setRoom(res.code);
      setActiveTab('voice');
    }
  };

  const userTag = user ? `${user.username}#${user.discriminator}` : "";

  // ===== AUTH SCREEN =====
  if (!user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="nova-card p-8 w-[340px] flex flex-col gap-4">
          <h1 className="text-xl font-bold text-center text-[var(--color-accent)]">scribble</h1>
          <p className="text-xs text-[var(--color-text-secondary)] text-center">
            {authMode === 'register' ? 'Create an account' : 'Welcome back'}
          </p>

          <input className="nova-input" placeholder="Username" value={authUser} onChange={e => setAuthUser(e.target.value)} />
          <input className="nova-input" placeholder="Password" type="password" value={authPass} onChange={e => setAuthPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()} />

          {authError && <div className="text-xs text-[var(--color-danger)]">{authError}</div>}

          <button className="nova-btn w-full" onClick={handleAuth} disabled={authLoading}>
            {authLoading ? '...' : authMode === 'register' ? 'Register' : 'Login'}
          </button>

          <button className="text-xs text-[var(--color-text-secondary)] text-center hover:text-[var(--color-accent)]"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError(""); }}>
            {authMode === 'register' ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN APP =====
  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] select-none">
      {/* Top Bar */}
      <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] justify-between shrink-0">
        <span className="font-semibold text-[15px] text-[var(--color-accent)]">scribble</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-secondary)]">{userTag}</span>
          <button className="text-xs text-[var(--color-danger)]"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setUser(null)}>Logout</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-14 flex flex-col items-center py-4 gap-3 border-r border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          {(['friends', 'chat', 'voice'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg
                ${activeTab === tab ? 'bg-[var(--color-accent)] text-black' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {tab === 'friends' ? '👥' : tab === 'chat' ? '💬' : '🎤'}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ===== FRIENDS ===== */}
          {activeTab === 'friends' && (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
              <h2 className="text-lg font-semibold">Friends</h2>

              <div className="flex gap-2">
                <input className="nova-input flex-1" placeholder="Username#1234" value={friendTag}
                  onChange={e => setFriendTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddFriend()} />
                <button className="nova-btn" onClick={handleAddFriend}>Add</button>
              </div>

              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <>
                  <div className="text-xs text-[var(--color-accent)] uppercase tracking-widest mt-2">Pending Requests</div>
                  {pendingRequests.map(p => (
                    <div key={p.id} className="nova-card flex items-center px-3 py-2 gap-3">
                      <span className="text-sm flex-1">{p.username}<span className="text-[var(--color-text-secondary)]">#{p.discriminator}</span></span>
                      <button className="nova-btn text-xs py-1 px-3" onClick={() => handleAcceptFriend(p.id)}>Accept</button>
                    </div>
                  ))}
                </>
              )}

              {/* Online Friends */}
              {(() => {
                const onlineFriends = friends.filter(f => onlineUsers.includes(`${f.username}#${f.discriminator}`));
                const offlineFriends = friends.filter(f => !onlineUsers.includes(`${f.username}#${f.discriminator}`));
                return (<>
                  {onlineFriends.length > 0 && (
                    <>
                      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mt-2">Online — {onlineFriends.length}</div>
                      {onlineFriends.map(f => (
                        <div key={f.id} className="nova-card flex items-center px-3 py-2 gap-3">
                          <div className="w-2 h-2 rounded-full bg-[var(--color-online)] shrink-0" />
                          <span className="text-sm font-medium flex-1">{f.username}<span className="text-[var(--color-text-secondary)]">#{f.discriminator}</span></span>
                          <button className="nova-btn-ghost text-xs" onClick={() => { setDmTarget(`${f.username}#${f.discriminator}`); setActiveTab('chat'); }}>DM</button>
                        </div>
                      ))}
                    </>
                  )}
                  {offlineFriends.length > 0 && (
                    <>
                      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mt-2">Offline — {offlineFriends.length}</div>
                      {offlineFriends.map(f => (
                        <div key={f.id} className="nova-card flex items-center px-3 py-2 gap-3">
                          <div className="w-2 h-2 rounded-full bg-[var(--color-offline)] shrink-0" />
                          <span className="text-sm font-medium flex-1">{f.username}<span className="text-[var(--color-text-secondary)]">#{f.discriminator}</span></span>
                          <button className="nova-btn-ghost text-xs" onClick={() => { setDmTarget(`${f.username}#${f.discriminator}`); setActiveTab('chat'); }}>DM</button>
                        </div>
                      ))}
                    </>
                  )}
                  {friends.length === 0 && <div className="text-sm text-[var(--color-text-secondary)] text-center py-8">No friends yet. Add someone above.</div>}
                </>);
              })()}
            </div>
          )}

          {/* ===== CHAT ===== */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col">
              <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] gap-2 shrink-0">
                {dmTarget ? (
                  <>
                    <button className="nova-btn-ghost text-xs py-1 px-2" onClick={() => setDmTarget(null)}>←</button>
                    <span className="font-medium text-sm">{dmTarget}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                      {onlineUsers.includes(dmTarget) ? '🟢 Online' : '⚫ Offline'}
                    </span>
                  </>
                ) : currentRoom ? (
                  <span className="font-medium text-sm">Room: {currentRoom}</span>
                ) : (
                  <span className="text-[var(--color-text-secondary)] text-sm">Select a friend to DM or join a voice room</span>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2">
                {dmTarget ? (
                  (dmMessages[dmTarget] || []).map((m, i) => (
                    <div key={i} className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.from === userTag ? 'bg-[var(--color-accent-dim)] ml-auto' : 'nova-card'}`}>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-1">{m.from === userTag ? 'You' : m.from}</div>
                      {m.message}
                    </div>
                  ))
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.from === 'System' ? 'text-[var(--color-text-secondary)] text-xs italic' : m.from === userTag ? 'bg-[var(--color-accent-dim)] ml-auto' : 'nova-card'}`}>
                      {m.from !== 'System' && <div className="text-xs text-[var(--color-text-secondary)] mb-1">{m.from === userTag ? 'You' : m.from}</div>}
                      {m.message}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {(dmTarget || currentRoom) && (
                <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex gap-2 shrink-0">
                  <input className="nova-input flex-1" placeholder="Type a message..."
                    value={dmTarget ? dmInput : chatInput}
                    onChange={e => dmTarget ? setDmInput(e.target.value) : setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (dmTarget ? handleSendDm() : handleSendChat())} />
                  <button className="nova-btn" onClick={dmTarget ? handleSendDm : handleSendChat}>Send</button>
                </div>
              )}
            </div>
          )}

          {/* ===== VOICE ===== */}
          {activeTab === 'voice' && (
            <div className="flex-1 flex flex-col p-4 gap-4">
              {!currentRoom ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <h2 className="text-lg font-semibold">Join Voice Room</h2>
                  <input className="nova-input max-w-[260px] text-center uppercase tracking-widest" placeholder="Room Code" maxLength={6}
                    value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && inviteCode.length === 6 && (joinRoom(inviteCode), setRoom(inviteCode))} />
                  <div className="flex gap-2">
                    <button className="nova-btn" disabled={inviteCode.length !== 6}
                      onClick={() => { joinRoom(inviteCode); setRoom(inviteCode); }}>Join</button>
                    <button className="nova-btn-ghost" onClick={handleCreateRoom}>Create Room</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Room: <span className="text-[var(--color-accent)]">{currentRoom}</span></h2>
                    <span className="text-xs text-[var(--color-text-secondary)]">Opus 48kHz · FEC+DTX</span>
                  </div>

                  <div className="nova-card p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-black font-bold text-xs">{user?.username[0]}</div>
                    <span className="text-sm font-medium flex-1">{userTag} <span className="text-[var(--color-text-secondary)]">(You)</span></span>
                    <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-online)]'}`} />
                  </div>

                  {roomParticipants.map(p => (
                    <div key={p.socketId} className="nova-card p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-text-secondary)] flex items-center justify-center text-black font-bold text-xs">{p.userTag[0]}</div>
                      <span className="text-sm font-medium flex-1">{p.userTag}</span>
                      <div className={`w-2 h-2 rounded-full ${p.isMuted ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-online)]'}`} />
                      
                      {remoteStreams[p.socketId] && !isDeafened && (
                        <audio
                          autoPlay
                          ref={a => { if (a && a.srcObject !== remoteStreams[p.socketId]) a.srcObject = remoteStreams[p.socketId] }}
                        />
                      )}
                    </div>
                  ))}

                  <div className="text-xs text-[var(--color-text-secondary)] text-center mt-2">
                    Share this code with friends: <span className="text-[var(--color-accent)] font-bold">{currentRoom}</span>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <button onClick={toggleMute}
                      className={`flex-1 py-3 rounded-lg font-semibold text-sm ${isMuted ? 'bg-[var(--color-danger)] text-white' : 'nova-card text-[var(--color-text)]'}`}
                      style={{ border: isMuted ? 'none' : '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isMuted ? '🔇 Muted' : '🎙 Mic On'}
                    </button>
                    <button onClick={toggleDeafen}
                      className={`flex-1 py-3 rounded-lg font-semibold text-sm ${isDeafened ? 'bg-[var(--color-danger)] text-white' : 'nova-card text-[var(--color-text)]'}`}
                      style={{ border: isDeafened ? 'none' : '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isDeafened ? '🔇 Deaf' : '🎧 Listen'}
                    </button>
                    <button onClick={() => { leaveRoom(currentRoom); setRoom(null); setInviteCode(""); }}
                      className="nova-btn-danger flex-1 py-3 rounded-lg font-semibold text-sm"
                      style={{ cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✕ Leave
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
