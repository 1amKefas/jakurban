import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { apiService, getChatSessionId, resetChatSessionId, formatCompactRupiah, formatPublicLocation } from '../services/api';
import { INITIAL_CHAT_GREETING, getFallbackBotResponse } from '../constants/defaultData';
import { Icons } from '../components/common/Icons';
import '../styles/chatbot.css';

export function Chatbot(props) {
  const [messages, setMessages] = createSignal([INITIAL_CHAT_GREETING]);
  const [input, setInput] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);
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
    isTyping();
    scrollToBottom();
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

  const handleStartNewChat = async () => {
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
    const trimmed = (typeof textToSend === 'string' ? textToSend : input()).trim();
    if (!trimmed) return;

    const userMessage = { id: Date.now(), sender: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    props.onMessageSent?.();

    try {
      const data = await apiService.sendChatMessage(trimmed);
      if (data.sessionId) setSessionId(data.sessionId);

      const replyText =
        data.reply ||
        data.response ||
        data.answer ||
        data.message ||
        (typeof data === 'string' ? data : getFallbackBotResponse(trimmed));

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: replyText,
          recommendations: data.recommendations || data.properties || []
        }
      ]);
    } catch (err) {
      console.warn('Chat API belum terjangkau, memakai respons fallback:', err.message);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: getFallbackBotResponse(trimmed) }
      ]);
    } finally {
      setIsTyping(false);
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
            <span class="brand-name">JakUrban AI</span>
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
              <span class="username">Sesi Privat Aktif</span>
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
            <span>Asisten Katalog Properti NLP (RAG)</span>
          </div>
          <button class="share-btn" onClick={handleStartNewChat}>
            Reset Sesi
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
                    <div>{msg.text}</div>

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
                <div class="message-content typing">Menganalisis katalog properti via RAG...</div>
              </div>
            </Show>
            <div ref={messagesEndRef} class="scroll-anchor"></div>
          </div>
        </div>

        <div class="input-container">
          <div class="input-pill">
            <button class="add-btn" onClick={handleStartNewChat} title="Sesi Baru">
              <Icons.PlusCircle />
            </button>
            <input
              type="text"
              class="message-input"
              placeholder="Tanyakan lokasi, tipe unit, luas tanah, atau simulasi KPR..."
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <div class="input-actions">
              <span class="model-selector">JakUrban RAG</span>
              <button class="send-btn" onClick={() => sendMessage()} aria-label="Kirim Pesan">
                <Show when={!isTyping()} fallback={<div class="stop-icon"></div>}>
                  <Icons.Send />
                </Show>
              </button>
            </div>
          </div>
          <div class="disclaimer">
            Setiap sesi menggunakan UUID unik di Local Storage agar percakapan Anda tetap privat dan faktual.
          </div>
        </div>
      </main>
    </div>
  );
}

export default Chatbot;