// Only accessible between matched users

import axios from "axios";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const API = "http://localhost:5000/api";

// Helper: Get JWT token from Supabase session
const getToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || "";
};

// Helper: Get current logged in user
const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};

// Conversation = an accepted match with chat info
type Conversation = {
  id: string;
  opponentName: string;
  opponentUniversity: string;
  opponentPhoto: string;
  postTitle: string;
  postId: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
};

// Individual chat message
type Message = {
  id: string;
  conversationId: string;
  sender: "me" | "opponent";
  senderName: string;
  text: string;
  createdAt: string;
  sender_id?: string;
};

export default function Chat() {
  const navigate = useNavigate();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Message delete / unsend states
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null
  );
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);

  // Ref for auto-scrolling to latest message
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize on mount
  useEffect(() => {
    initChat();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedConversationId) return;

    fetchMessages(selectedConversationId);
    const channel = subscribeToMessages(selectedConversationId);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, currentUser?.id]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hiddenMessageIds]);

  // Initialize: get current user and fetch all accepted matches
  const initChat = async () => {
    const user = await getCurrentUser();

    if (!user) {
      navigate("/login");
      return;
    }

    setCurrentUser(user);
    await fetchConversations(user);
    setLoading(false);
  };

  // Fetch accepted matches and convert to conversation format
  const fetchConversations = async (user: any) => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [incomingRes, outgoingRes] = await Promise.all([
        axios.get(`${API}/matches/incoming`, { headers }),
        axios.get(`${API}/matches/outgoing`, { headers }),
      ]);

      const allMatches = [...incomingRes.data, ...outgoingRes.data].filter(
        (m: any) => m.status === "accepted"
      );

      const convs: Conversation[] = allMatches.map((match: any) => {
        const isRequester = match.requester_id === user.id;
        const opponent = isRequester ? match.owner : match.requester;

        return {
          id: match.id,
          opponentName: opponent?.name || "Roomie",
          opponentUniversity: opponent?.university || "",
          opponentPhoto: opponent?.profile_photo || "",
          postTitle: match.posts?.district
            ? `${match.posts.post_type} · ${match.posts.district}`
            : "Matched Post",
          postId: match.post_id,
          lastMessage: "Click to start chatting",
          unreadCount: 0,
          updatedAt: new Date(match.created_at).toLocaleDateString(),
        };
      });

      setConversations(convs);

      if (convs.length > 0) {
        setSelectedConversationId(convs[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  // Fetch messages for a match from Express backend
  const fetchMessages = async (matchId: string) => {
    try {
      const token = await getToken();

      const { data } = await axios.get(`${API}/messages/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const formatted: Message[] = data.map((msg: any) => ({
        id: msg.id,
        conversationId: matchId,
        sender: msg.sender_id === currentUser?.id ? "me" : "opponent",
        senderName:
          msg.sender_id === currentUser?.id
            ? "Me"
            : msg.users?.name || "Roomie",
        text: msg.content,
        createdAt: new Date(msg.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sender_id: msg.sender_id,
      }));

      setMessages((prev) => [
        ...prev.filter((m) => m.conversationId !== matchId),
        ...formatted,
      ]);

      if (formatted.length > 0) {
        const last = formatted[formatted.length - 1];

        setConversations((prev) =>
          prev.map((c) =>
            c.id === matchId ? { ...c, lastMessage: last.text } : c
          )
        );
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // Subscribe to real-time new/deleted messages via Supabase Realtime
  const subscribeToMessages = (matchId: string) => {
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;

          const formatted: Message = {
            id: newMsg.id,
            conversationId: matchId,
            sender: newMsg.sender_id === currentUser?.id ? "me" : "opponent",
            senderName: newMsg.sender_id === currentUser?.id ? "Me" : "Roomie",
            text: newMsg.content,
            createdAt: new Date(newMsg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            sender_id: newMsg.sender_id,
          };

          // Avoid duplicates
          setMessages((prev) => {
            if (prev.find((m) => m.id === formatted.id)) return prev;
            return [...prev, formatted];
          });

          // Update sidebar last message and unread count
          setConversations((prev) =>
            prev.map((c) =>
              c.id === matchId
                ? {
                    ...c,
                    lastMessage: newMsg.content,
                    updatedAt: formatted.createdAt,
                    unreadCount:
                      selectedConversationId !== matchId
                        ? c.unreadCount + 1
                        : 0,
                  }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const deletedMsg = payload.old as any;

          setMessages((prev) =>
            prev.filter((message) => message.id !== deletedMsg.id)
          );

          updateConversationLastMessage(matchId, deletedMsg.id);
        }
      )
      .subscribe();

    return channel;
  };

  // Select conversation and clear unread count
  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSelectedMessageId(null);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
  };

  // Send message to Express backend
  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedText = inputValue.trim();

    if (!trimmedText || !selectedConversationId || sending) return;

    setSending(true);
    setInputValue("");

    try {
      const token = await getToken();

      await axios.post(
        `${API}/messages/${selectedConversationId}`,
        { content: trimmedText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Failed to send message", err);
      setInputValue(trimmedText);
    } finally {
      setSending(false);
    }
  };

  // Open / close IG-like message option menu
  const toggleMessageMenu = (messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? null : messageId));
  };

  // Delete for me: only hide from my current screen
  const deleteForMe = (message: Message) => {
    setHiddenMessageIds((prev) =>
      prev.includes(message.id) ? prev : [...prev, message.id]
    );

    setSelectedMessageId(null);
    updateConversationLastMessage(message.conversationId, message.id);
  };

  // Unsend: delete from backend DB, then remove from UI
  const unsendMessage = async (message: Message) => {
    if (message.sender !== "me") return;

    const confirmed = window.confirm(
      "Unsend this message? It will be removed from this conversation."
    );

    if (!confirmed) return;

    setDeletingMessageId(message.id);

    try {
      const token = await getToken();

      await axios.delete(`${API}/messages/${message.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setHiddenMessageIds((prev) => prev.filter((id) => id !== message.id));
      setSelectedMessageId(null);
      updateConversationLastMessage(message.conversationId, message.id);
    } catch (err) {
      console.error("Failed to unsend message", err);
      alert(
        "Failed to unsend this message. Please check whether DELETE /api/messages/:messageId exists in the backend."
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  const updateConversationLastMessage = (
    conversationId: string,
    removedMessageId?: string
  ) => {
    const visibleMessages = messages.filter(
      (message) =>
        message.conversationId === conversationId &&
        message.id !== removedMessageId &&
        !hiddenMessageIds.includes(message.id)
    );

    const lastMessage = visibleMessages[visibleMessages.length - 1];

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: lastMessage ? lastMessage.text : "No messages yet",
              updatedAt: lastMessage
                ? lastMessage.createdAt
                : conversation.updatedAt,
            }
          : conversation
      )
    );
  };

  // Computed values
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  const currentMessages = useMemo(() => {
    return messages.filter(
      (m) =>
        m.conversationId === selectedConversationId &&
        !hiddenMessageIds.includes(m.id)
    );
  }, [messages, selectedConversationId, hiddenMessageIds]);

  const totalUnreadCount = conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );

  // Render
  if (loading) {
    return (
      <div
        style={{
          ...styles.page,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'Georgia', serif",
            color: "#aaa",
            fontSize: 14,
          }}
        >
          Loading conversations...
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgAccent} />

      <nav style={styles.nav}>
        <p style={styles.brand}>roomies</p>

        <div style={styles.navRight}>
          <button style={styles.navLink} onClick={() => navigate("/browse")}>
            Browse
          </button>

          <button style={styles.navLinkActive} onClick={() => navigate("/chat")}>
            Chat
            {totalUnreadCount > 0 && (
              <span style={styles.navBadge}>{totalUnreadCount}</span>
            )}
          </button>

          <button style={styles.navLink} onClick={() => navigate("/profile")}>
            Profile
          </button>
        </div>
      </nav>

      <main style={styles.container}>
        <section style={styles.header}>
          <div>
            <p style={styles.kicker}>MESSAGING</p>
            <h1 style={styles.title}>Chat</h1>
            <p style={styles.description}>
              Talk with matched roommates in real time. Click a message to
              delete it or unsend your own message.
            </p>
          </div>
        </section>

        <section style={styles.chatPanel}>
          <aside style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <div>
                <p style={styles.sectionLabel}>Conversations</p>
                <h2 style={styles.sidebarTitle}>Active Matches</h2>
              </div>

              {totalUnreadCount > 0 && (
                <span style={styles.totalBadge}>{totalUnreadCount}</span>
              )}
            </div>

            {conversations.length === 0 ? (
              <div style={styles.emptySidebar}>
                <p style={styles.emptySidebarText}>
                  No conversations yet. Match with someone to start chatting!
                </p>

                <button
                  style={styles.sendButton}
                  onClick={() => navigate("/browse")}
                >
                  Browse Posts
                </button>
              </div>
            ) : (
              <div style={styles.conversationList}>
                {conversations.map((conversation) => {
                  const active = conversation.id === selectedConversationId;

                  return (
                    <button
                      key={conversation.id}
                      style={{
                        ...styles.conversationItem,
                        ...(active ? styles.activeConversation : {}),
                      }}
                      onClick={() => selectConversation(conversation.id)}
                    >
                      <div style={styles.avatar}>
                        {conversation.opponentPhoto ? (
                          <img
                            src={conversation.opponentPhoto}
                            alt={conversation.opponentName}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <span>{conversation.opponentName.slice(0, 1)}</span>
                        )}
                      </div>

                      <div style={styles.conversationContent}>
                        <div style={styles.conversationTop}>
                          <p style={styles.opponentName}>
                            {conversation.opponentName}
                          </p>

                          <span style={styles.updatedAt}>
                            {conversation.updatedAt}
                          </span>
                        </div>

                        <p style={styles.postTitle}>{conversation.postTitle}</p>
                        <p style={styles.lastMessage}>
                          {conversation.lastMessage}
                        </p>
                      </div>

                      {conversation.unreadCount > 0 && (
                        <span style={styles.unreadBadge}>
                          {conversation.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section style={styles.thread}>
            {selectedConversation ? (
              <>
                <div style={styles.threadHeader}>
                  <div style={styles.threadUser}>
                    <div style={styles.threadAvatar}>
                      {selectedConversation.opponentPhoto ? (
                        <img
                          src={selectedConversation.opponentPhoto}
                          alt=""
                          style={styles.threadAvatarImage}
                        />
                      ) : (
                        selectedConversation.opponentName.slice(0, 1)
                      )}
                    </div>

                    <div>
                      <h2 style={styles.threadName}>
                        {selectedConversation.opponentName}
                      </h2>

                      <p style={styles.threadMeta}>
                        {selectedConversation.opponentUniversity}
                      </p>
                    </div>
                  </div>

                  <button
                    style={styles.viewPostBtn}
                    onClick={() =>
                      navigate(`/post-detail/${selectedConversation.postId}`)
                    }
                  >
                    View Post
                  </button>
                </div>

                <div style={styles.matchInfoBox}>
                  <p style={styles.matchInfoTitle}>Matched Post</p>
                  <p style={styles.matchInfoText}>
                    {selectedConversation.postTitle}
                  </p>
                </div>

                <div
                  style={styles.messageList}
                  onClick={() => setSelectedMessageId(null)}
                >
                  {currentMessages.length === 0 ? (
                    <div style={styles.emptyMessageBox}>
                      <p style={styles.emptyMessageText}>
                        👋 Say hello to {selectedConversation.opponentName}!
                      </p>
                    </div>
                  ) : (
                    currentMessages.map((message) => {
                      const isMe = message.sender === "me";
                      const isMenuOpen = selectedMessageId === message.id;
                      const isDeleting = deletingMessageId === message.id;

                      return (
                        <div
                          key={message.id}
                          style={{
                            ...styles.messageRow,
                            flexDirection: isMe ? "row-reverse" : "row",
                          }}
                        >
                          {!isMe && (
                            <div style={styles.messageAvatar}>
                              {message.senderName.slice(0, 1)}
                            </div>
                          )}

                          <div
                            style={{
                              ...styles.messageActionWrap,
                              alignItems: isMe ? "flex-end" : "flex-start",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              style={{
                                ...styles.messageBubbleButton,
                                ...(isMe
                                  ? styles.myMessageBubble
                                  : styles.opponentMessageBubble),
                              }}
                              onClick={() => toggleMessageMenu(message.id)}
                              title="Message options"
                            >
                              <p style={styles.messageText}>{message.text}</p>

                              <p
                                style={{
                                  ...styles.messageTime,
                                  color: isMe
                                    ? "rgba(255,255,255,0.6)"
                                    : "#aaa",
                                }}
                              >
                                {message.createdAt}
                              </p>
                            </button>

                            {isMenuOpen && (
                              <div
                                style={{
                                  ...styles.messageMenu,
                                  ...(isMe
                                    ? styles.myMessageMenu
                                    : styles.opponentMessageMenu),
                                }}
                              >
                                <button
                                  type="button"
                                  style={styles.menuItem}
                                  onClick={() => deleteForMe(message)}
                                  disabled={isDeleting}
                                >
                                  Delete for me
                                </button>

                                {isMe && (
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.menuItem,
                                      ...styles.unsendMenuItem,
                                    }}
                                    onClick={() => unsendMessage(message)}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? "Unsending..." : "Unsend"}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  style={styles.cancelMenuItem}
                                  onClick={() => setSelectedMessageId(null)}
                                  disabled={isDeleting}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <form style={styles.inputArea} onSubmit={sendMessage}>
                  <input
                    style={styles.messageInput}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    disabled={sending}
                  />

                  <button
                    type="submit"
                    style={{
                      ...styles.sendButton,
                      opacity: inputValue.trim() ? 1 : 0.5,
                      cursor: inputValue.trim() ? "pointer" : "default",
                    }}
                    disabled={!inputValue.trim() || sending}
                  >
                    {sending ? "···" : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div style={styles.emptyThread}>
                <h2 style={styles.emptyTitle}>No conversation selected</h2>
                <p style={styles.emptyText}>
                  Choose a conversation from the left to start chatting
                </p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fafaf8",
    fontFamily: "'Georgia', serif",
    position: "relative",
    overflowX: "hidden",
    color: "#1a1a1a",
  },
  bgAccent: {
    position: "fixed",
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 48px",
    borderBottom: "1px solid #ebe9e4",
    background: "#fafaf8",
    position: "relative",
    zIndex: 1,
  },
  brand: {
    fontSize: 13,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: "#888",
    margin: 0,
  },
  navRight: {
    display: "flex",
    gap: 24,
    alignItems: "center",
  },
  navLink: {
    background: "none",
    border: "none",
    fontSize: 13,
    color: "#888",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    letterSpacing: "0.05em",
  },
  navLinkActive: {
    background: "none",
    border: "none",
    fontSize: 13,
    color: "#1a1a1a",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    letterSpacing: "0.05em",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  navBadge: {
    fontSize: 10,
    background: "#c0392b",
    color: "#fff",
    borderRadius: 10,
    padding: "1px 6px",
  },
  container: {
    maxWidth: 1200,
    margin: "48px auto",
    padding: "0 40px",
    position: "relative",
    zIndex: 1,
  },
  header: {
    background: "#ffffff",
    borderRadius: 2,
    boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
    padding: "40px 48px",
    marginBottom: 28,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#aaa",
    margin: "0 0 16px",
  },
  title: {
    fontSize: 32,
    fontWeight: 400,
    color: "#1a1a1a",
    margin: "0 0 10px",
  },
  description: {
    fontSize: 14,
    color: "#888",
    lineHeight: 1.7,
    maxWidth: 680,
    margin: 0,
  },
  chatPanel: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 28,
    minHeight: 680,
  },
  sidebar: {
    background: "#ffffff",
    borderRadius: 2,
    boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
    padding: 24,
    minHeight: 680,
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#aaa",
    margin: "0 0 10px",
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: 400,
    margin: 0,
    color: "#1a1a1a",
  },
  totalBadge: {
    minWidth: 24,
    height: 24,
    padding: "0 7px",
    borderRadius: 20,
    background: "#c0392b",
    color: "#fff",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySidebar: {
    padding: 24,
    textAlign: "center",
  },
  emptySidebarText: {
    color: "#aaa",
    fontSize: 13,
    fontFamily: "'Georgia', serif",
    marginBottom: 16,
  },
  conversationList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  conversationItem: {
    width: "100%",
    border: "1px solid #f0ede8",
    background: "#ffffff",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "46px 1fr auto",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
  },
  activeConversation: {
    background: "#fafaf8",
    border: "1px solid #ddd8cf",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "#e8e4dc",
    color: "#888",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    border: "2px solid #ebe9e4",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  conversationContent: {
    minWidth: 0,
  },
  conversationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  opponentName: {
    fontSize: 15,
    color: "#1a1a1a",
    margin: 0,
  },
  updatedAt: {
    fontSize: 11,
    color: "#aaa",
    whiteSpace: "nowrap",
  },
  postTitle: {
    fontSize: 11,
    color: "#aaa",
    margin: "5px 0 6px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lastMessage: {
    fontSize: 12,
    color: "#888",
    margin: 0,
    lineHeight: 1.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  unreadBadge: {
    alignSelf: "center",
    minWidth: 21,
    height: 21,
    padding: "0 6px",
    borderRadius: 20,
    background: "#c0392b",
    color: "#fff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  thread: {
    background: "#ffffff",
    borderRadius: 2,
    boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
    minHeight: 680,
    display: "flex",
    flexDirection: "column",
  },
  threadHeader: {
    padding: "24px 28px",
    borderBottom: "1px solid #f0ede8",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  threadUser: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "#e8e4dc",
    color: "#888",
    border: "3px solid #ebe9e4",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 20,
    overflow: "hidden",
  },
  threadAvatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },
  threadName: {
    fontSize: 20,
    fontWeight: 400,
    margin: "0 0 5px",
    color: "#1a1a1a",
  },
  threadMeta: {
    fontSize: 12,
    color: "#888",
    margin: 0,
  },
  viewPostBtn: {
    background: "transparent",
    border: "1.5px solid #1a1a1a",
    padding: "10px 18px",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    color: "#1a1a1a",
    borderRadius: 1,
    whiteSpace: "nowrap",
  },
  matchInfoBox: {
    margin: "22px 28px 0",
    padding: "16px 18px",
    background: "#fafaf8",
    border: "1px solid #f0ede8",
  },
  matchInfoTitle: {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#aaa",
    margin: "0 0 7px",
  },
  matchInfoText: {
    fontSize: 13,
    color: "#666",
    margin: 0,
    lineHeight: 1.5,
  },
  messageList: {
    flex: 1,
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
  },
  emptyMessageBox: {
    textAlign: "center",
    padding: 40,
  },
  emptyMessageText: {
    color: "#aaa",
    fontFamily: "'Georgia', serif",
    fontSize: 14,
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#e8e4dc",
    color: "#888",
    border: "2px solid #ebe9e4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    flexShrink: 0,
  },
  messageActionWrap: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    maxWidth: "68%",
  },
  messageBubbleButton: {
    width: "100%",
    border: "none",
    padding: "12px 15px",
    borderRadius: 2,
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    textAlign: "left",
  },
  myMessageBubble: {
    background: "#1a1a1a",
    color: "#ffffff",
  },
  opponentMessageBubble: {
    background: "#f0ede8",
    color: "#1a1a1a",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 1.6,
    margin: "0 0 6px",
    wordBreak: "break-word",
  },
  messageTime: {
    fontSize: 10,
    margin: 0,
    textAlign: "right",
  },
  messageMenu: {
    position: "absolute",
    top: "100%",
    marginTop: 8,
    width: 160,
    background: "#ffffff",
    border: "1px solid #e8e4dc",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    borderRadius: 2,
    padding: 6,
    zIndex: 20,
  },
  myMessageMenu: {
    right: 0,
  },
  opponentMessageMenu: {
    left: 0,
  },
  menuItem: {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: 12,
    color: "#1a1a1a",
  },
  unsendMenuItem: {
    color: "#c0392b",
  },
  cancelMenuItem: {
    width: "100%",
    background: "#fafaf8",
    border: "none",
    padding: "9px 12px",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontSize: 12,
    color: "#888",
  },
  inputArea: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 14,
    padding: "20px 28px",
    borderTop: "1px solid #f0ede8",
  },
  messageInput: {
    border: "none",
    borderBottom: "1.5px solid #ddd",
    padding: "10px 0",
    fontSize: 14,
    fontFamily: "'Georgia', serif",
    color: "#1a1a1a",
    background: "transparent",
    outline: "none",
    width: "100%",
  },
  sendButton: {
    background: "#1a1a1a",
    border: "none",
    padding: "12px 24px",
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    color: "#fff",
    borderRadius: 1,
  },
  emptyThread: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 400,
    margin: "0 0 10px",
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    margin: 0,
  },
};