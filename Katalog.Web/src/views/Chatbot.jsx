import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { apiService, getChatSessionId, resetChatSessionId, formatCompactRupiah, formatPublicLocation } from '../services/api';
import { INITIAL_CHAT_GREETING, getFallbackBotResponse } from '../constants/defaultData';
import { Icons } from '../components/common/Icons';
import ChatMarkdown from '../components/common/ChatMarkdown';
import '../styles/chatbot.css';


export function Chatbot(props) {
  const [messages, setMessages] = createSignal([INITIAL_CHAT_GREETING]);
  const [input, setInput] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);
  const [streamingText, setStreamingText] = createSignal('');
  const [sessionId, setSessionId] = createSignal(getChatSessionId());
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

  let messagesEndRef;

  const scrollToBottom = () => {
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  };

  createEffect(() => {
    messages();
    streamingText();
    isTyping();
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: streamingText() ? 'auto' : 'smooth' });
    }
  });

  onMount(async () => {
    const activeUuid = getChatSessionId();
    setSessionId(activeUuid);

    try {
      const historyData = await apiService.getChatHistory(activeUuid);
      if (historyData?.messages && historyData.messages.length > 0) {
        const restored = historyData.messages.map((m, idx) => ({
          id: m.id || Date.now() + idx,
          sender: m.sender || 'bot',
          text: m.text || '',
          recommendations: m.recommendations || []
        }));
        setMessages([INITIAL_CHAT_GREETING, ...restored]);
      }
    } catch (err) {
      console.warn('Belum ada riwayat sesi di server:', err.message);
    }

    if (props.initialPrompt) {
      const promptToRun = props.initialPrompt;
      props.onPromptConsumed?.();
      await sendMessage(promptToRun);
    }
  });

  let activeRequestId = 0;
  let activeAbortController = null;

  const stopTypingResponse = () => {
    activeRequestId++;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    const partial = streamingText().trim();
    if (partial) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: partial, recommendations: [] }
      ]);
    }
    setStreamingText('');
    setIsTyping(false);
  };

  const handleStartNewChat = async () => {
    stopTypingResponse();
    const oldUuid = sessionId();
    try {
      await apiService.clearChatHistory(oldUuid);
    } catch {
      // Abaikan jika server sedang offline
    }
    const newUuid = resetChatSessionId();
    setSessionId(newUuid);
    setMessages([{ ...INITIAL_CHAT_GREETING, id: Date.now() }]);
  };

  const sendMessage = async (textToSend) => {
    if (isTyping()) return;
    const trimmed = (typeof textToSend === 'string' ? textToSend : input()).trim();
    if (!trimmed) return;

    const currentReqId = ++activeRequestId;
    const controller = new AbortController();
    activeAbortController = controller;

    const userMessage = { id: Date.now(), sender: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    if (typeof textToSend !== 'string') setInput('');
    setStreamingText('');
    setIsTyping(true);
    props.onMessageSent?.();

    let accumulated = '';
    let finalMeta = null;

    try {
      await apiService.streamChatMessage(trimmed, {
        signal: controller.signal,
        onToken: (chunk) => {
          if (currentReqId !== activeRequestId) return;
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        onDone: (meta) => {
          if (currentReqId !== activeRequestId) return;
          finalMeta = meta;
          if (meta.sessionId) setSessionId(meta.sessionId);
        }
      });

      if (currentReqId !== activeRequestId) return;

      const replyText = accumulated.trim() || getFallbackBotResponse(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: replyText,
          recommendations: finalMeta?.recommendations || []
        }
      ]);
    } catch (err) {
      if (err?.name === 'AbortError' || currentReqId !== activeRequestId) return;
      console.warn('Streaming AI gagal, memakai respons fallback:', err.message);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: accumulated.trim() || getFallbackBotResponse(trimmed) }
      ]);
    } finally {
      if (currentReqId === activeRequestId) {
        activeAbortController = null;
        setStreamingText('');
        setIsTyping(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleQuickAsk = (question) => () => { 
    setIsSidebarOpen(false);
    sendMessage(question);
  };

  return (
    <div class="jakurban-layout">
      {/* TAMBAHKAN BACKDROP INI TEPAT DI ATAS <aside> */}
      <Show when={isSidebarOpen()}>
        <div class="chat-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>
      </Show>
      {/* SIDEBAR */}
      <aside class={`sidebar ${isSidebarOpen() ? 'open' : ''}`}>
        <div class="sidebar-header">
          <div class="brand">
            <div class="brand-icon">
              <Icons.Sparkles />
            </div>
            <span class="brand-name">JakHome AI</span>
          </div>
          <div class="sidebar-actions">
            <button
              class="icon-btn"
              aria-label="Tutup atau Kembali"
              onClick={() => {
                if (window.innerWidth <= 900) {
                  setIsSidebarOpen(false);
                } else {
                  props.setView?.('catalog');
                }
              }}
              title="Tutup / Kembali"
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        <div class="sidebar-nav">
          <button
            class="nav-item new-chat"
            onClick={() => {
              setIsSidebarOpen(false);
              handleStartNewChat();
            }}
          >
            <Icons.PlusCircle />
            <span>Percakapan Baru</span>
          </button>
          <button
            class="nav-item"
            onClick={handleQuickAsk('Tampilkan daftar project dan unit yang tersedia saat ini')}
          >
            <Icons.BuildingArea />
            <span>Cek Unit Tersedia</span>
          </button>
          <button
            class="nav-item"
            onClick={handleQuickAsk('Bagaimana simulasi perhitungan cicilan KPR?')}
          >
            <Icons.Calculator />
            <span>Simulasi KPR</span>
          </button>
          <button
            class="nav-item"
            onClick={() => {
              setIsSidebarOpen(false);
              props.setView?.('catalog');
            }}
          >
            <Icons.Grid />
            <span>Kembali ke Katalog</span>
          </button>
        </div>

        <div class="sidebar-history">
          <div class="history-section">
            <div class="section-title">Pertanyaan Cepat</div>
            <button
              class="history-item"
              onClick={handleQuickAsk('Rekomendasi rumah 3 kamar tidur yang masih tersedia')}
            >
              Rumah 3 Kamar Tidur
            </button>
            <button
              class="history-item"
              onClick={handleQuickAsk('Project properti di area Jakarta Selatan')}
            >
              Area Jakarta Selatan
            </button>
            <button
              class="history-item"
              onClick={handleQuickAsk('Ada hunian ramah kantong untuk keluarga muda?')}
            >
              Hunian Keluarga Muda
            </button>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar">
              <Icons.ShieldCheck />
            </div>
            <div class="session-meta">
              <span class="username">Sesi Privat</span>
              <span class="session-uuid">ID: {String(sessionId()).slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main class="chat-main">
        <header class="chat-header">
          <div class="chat-title">
            <button
              type="button"
              class="chat-burger-btn"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <Icons.Sparkles />
            <span>Asisten AI</span>
          </div>
          <button class="share-btn" onClick={handleStartNewChat}>
            Sesi Baru
          </button>
        </header>

        <div class="chat-scroll-area">
          <div class="chat-content">
            <For each={messages()}>
              {(msg) => (
                <div class={`message-wrapper ${msg.sender === 'user' ? 'is-user' : 'is-bot'}`}>
                  <Show when={msg.sender === 'bot'}>
                    <div class="bot-avatar">
                      <Icons.Sparkles />
                    </div>
                  </Show>
                  <div class="message-content">
                    <Show
                      when={msg.sender === 'bot'}
                      fallback={<div style={{ 'white-space': 'pre-wrap' }}>{msg.text}</div>}
                    >
                      <ChatMarkdown text={msg.text} />
                    </Show>

                    {/* Daftar kartu rekomendasi unit hasil pencarian RAG */}
                    <Show when={msg.recommendations && msg.recommendations.length > 0}>
                      <div class="rec-cards-grid">
                        <For each={msg.recommendations}>
                          {(rec) => (
                            <div class="rec-card">
                              <div class="rec-card-meta">
                                {rec.projectName} • {formatPublicLocation(rec.location)}
                              </div>
                              <strong class="rec-card-title">{rec.name}</strong>
                              <div class="rec-card-price">
                                {formatCompactRupiah(rec.price)}
                              </div>
                              <div class="rec-card-specs">
                                LT {rec.landArea || '-'}m² • LB {rec.buildArea || '-'}m² • {rec.beds} KT
                              </div>
                              <div class="rec-card-actions">
                                <button
                                  type="button"
                                  class="rec-btn-outline"
                                  onClick={() =>
                                    sendMessage(`Tolong hitung simulasi KPR untuk unit ${rec.name} di ${rec.projectName}`)
                                  }
                                >
                                  Hitung KPR
                                </button>
                                <Show when={props.onSelectRecommendedUnit}>
                                  <button
                                    type="button"
                                    class="rec-btn-solid"
                                    onClick={() => props.onSelectRecommendedUnit(rec)}
                                  >
                                    Lihat Unit
                                  </button>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>

            <Show when={isTyping()}>
              <div class="message-wrapper is-bot">
                <div class="bot-avatar">
                  <Icons.Sparkles />
                </div>
                <Show
                  when={streamingText().length > 0}
                  fallback={
                    <div class="message-content typing">
                      Berpikir...
                    </div>
                  }
                >
                  <div class="message-content">
                    <ChatMarkdown text={streamingText()} isStreaming={true} />
                  </div>
                </Show>
              </div>
            </Show>
            <div ref={messagesEndRef} class="scroll-anchor"></div>
          </div>
        </div>

        <div class="input-container">
          <div class="input-pill">  
            <input
              type="text"
              class="message-input"
              placeholder="Tanyakan lokasi, tipe unit, luas tanah, atau simulasi KPR..."
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <div class="input-actions">
              <span class="model-selector">JakHome</span>
              <button
                type="button"
                class="send-btn"
                onClick={() => (isTyping() ? stopTypingResponse() : sendMessage())}
                aria-label={isTyping() ? 'Hentikan Respons' : 'Kirim Pesan'}
                title={isTyping() ? 'Hentikan Respons' : 'Kirim Pesan'}
              >
                <Show when={!isTyping()} fallback={<div class="stop-icon"></div>}>
                  <Icons.Send />
                </Show>
              </button>
            </div>
          </div>
          <div class="disclaimer">
            Setiap sesi menggunakan UUID unik agar percakapan anda tetap privat dan faktual.
          </div>
        </div>
      </main>
    </div>
  );
}

export default Chatbot;