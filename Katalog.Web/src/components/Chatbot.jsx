import { createSignal, createEffect, For, Show } from 'solid-js';
import { Icons } from './Icons'; // Pastikan komponen Icons lo punya icon dasar, atau ganti dengan teks/SVG sementara

export function Chatbot(props) {
  const [messages, setMessages] = createSignal([
    {
      id: 1,
      sender: 'bot',
      text: 'Selamat datang di asisten JakUrban AI! Saya dapat membantu Anda menemukan hunian impian di Jakarta. Tanyakan apa saja tentang properti kami.'
    }
  ]);
  const [input, setInput] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);

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

  const getBotResponse = (userText) => {
    const textLower = userText.toLowerCase();
    if (textLower.includes('lokasi') || textLower.includes('area')) {
      return 'Berdasarkan preferensi Anda, saya merekomendasikan area Jakarta Selatan seperti Setiabudi dan Kemang yang memiliki akses strategis ke pusat bisnis.';
    }
    if (textLower.includes('kpr') || textLower.includes('hitung')) {
      return 'Untuk simulasi KPR, saya memerlukan informasi harga properti dan tenor yang diinginkan. Rata-rata bunga KPR saat ini berkisar 7-9% per tahun.';
    }
    if (textLower.includes('unit') || textLower.includes('tersedia')) {
      return 'Saat ini kami memiliki beberapa unit tersedia di berbagai cluster. Cluster Setiabudi memiliki 3 unit ready stock.';
    }
    return 'Terima kasih atas pertanyaan Anda. Tim kami akan segera menghubungi Anda untuk informasi lebih detail.';
  };

  const sendMessage = (textToSend) => {
    const trimmed = (typeof textToSend === 'string' ? textToSend : input()).trim();
    if (!trimmed) return;

    const userMessage = { id: Date.now(), sender: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const responseText = getBotResponse(trimmed);
      const botMessage = { id: Date.now() + 1, sender: 'bot', text: responseText };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div class="jakurban-layout">
      {/* SIDEBAR */}
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand">
            <div class="brand-icon">✧</div>
            <span class="brand-name">JakUrban AI</span>
          </div>
          <div class="sidebar-actions">
            <button class="icon-btn" aria-label="Search">🔍</button>
            <button class="icon-btn" aria-label="Toggle Sidebar" onClick={() => props.setView?.('catalog')}>
              {/* Tutup chat kembali ke catalog */}
              ✕ 
            </button>
          </div>
        </div>

        <div class="sidebar-nav">
          <button class="nav-item new-chat">
            <span class="icon">✏️</span> New chat
          </button>
          <button class="nav-item"><span class="icon">📚</span> Library</button>
          <button class="nav-item"><span class="icon">💼</span> Projects</button>
        </div>

        <div class="sidebar-history">
          <div class="history-section">
            <div class="section-title">Pinned</div>
            <button class="history-item active">Review Katalog Kemang</button>
            <button class="history-item">Simulasi KPR Klien A</button>
          </div>
          
          <div class="history-section">
            <div class="section-title">Today</div>
            <button class="history-item">Cek Stok Unit Setiabudi</button>
            <button class="history-item">Draft Follow-up WA</button>
          </div>

          <div class="history-section">
            <div class="section-title">Yesterday</div>
            <button class="history-item">Pertanyaan Bunga KPR</button>
            <button class="history-item">Request Siteplan Cluster Baru</button>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="avatar">👨‍💼</div>
            <span class="username">Admin Marketing</span>
          </div>
          <button class="icon-btn">⚙️</button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main class="chat-main">
        <header class="chat-header">
          <div class="chat-title">
            Mencari Hunian Impian <span class="chevron">⌄</span>
          </div>
          <button class="share-btn">Share</button>
        </header>

        <div class="chat-scroll-area">
          <div class="chat-content">
            <For each={messages()}>
              {(msg) => (
                <div class={`message-wrapper ${msg.sender === 'user' ? 'is-user' : 'is-bot'}`}>
                  <Show when={msg.sender === 'bot'}>
                    <div class="bot-avatar">✧</div>
                  </Show>
                  <div class="message-content">
                    {msg.text}
                  </div>
                </div>
              )}
            </For>
            
            <Show when={isTyping()}>
              <div class="message-wrapper is-bot">
                <div class="bot-avatar">✧</div>
                <div class="message-content typing">
                  Generating recommendations...
                </div>
              </div>
            </Show>
            <div ref={messagesEndRef} style={{ height: '20px' }}></div>
          </div>
        </div>

        {/* FLOATING INPUT AREA */}
        <div class="input-container">
          <div class="input-pill">
            <button class="add-btn">+</button>
            <input
              type="text"
              class="message-input"
              placeholder="Ask anything"
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <div class="input-actions">
              <span class="model-selector">JakUrban AI <span class="chevron">⌄</span></span>
              <button class="mic-btn">🎙️</button>
              <button class="send-btn" onClick={() => sendMessage()}>
                <Show when={!isTyping()} fallback={<div class="stop-icon"></div>}>
                  ↑
                </Show>
              </button>
            </div>
          </div>
          <div class="disclaimer">
            JakUrban AI can make mistakes. Check important info.
          </div>
        </div>
      </main>

      {/* CSS STYLES - Lo bisa pindahkan ini ke file .css terpisah nanti */}
      <style>{`
        .jakurban-layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f9f9f9;
          color: #1a1a1a;
          overflow: hidden;
        }

        /* SIDEBAR STYLES */
        .sidebar {
          width: 260px;
          background-color: #f9f9f9;
          display: flex;
          flex-direction: column;
          padding: 16px;
          border-right: 1px solid #e5e5e5;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .brand-icon {
          background: #000;
          color: #fff;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 14px;
        }
        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #666;
          padding: 4px;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 24px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          padding: 8px 12px;
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          font-size: 14px;
          color: #444;
        }
        .nav-item:hover {
          background-color: #efefef;
        }
        .sidebar-history {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .history-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .section-title {
          font-size: 12px;
          font-weight: 600;
          color: #888;
          padding-left: 12px;
          margin-bottom: 4px;
          text-transform: capitalize;
        }
        .history-item {
          background: none;
          border: none;
          padding: 8px 12px;
          text-align: left;
          font-size: 13px;
          color: #444;
          cursor: pointer;
          border-radius: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .history-item:hover {
          background-color: #efefef;
        }
        .history-item.active {
          background-color: #efefef;
          font-weight: 500;
          color: #000;
        }
        .sidebar-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          margin-top: 16px;
        }
        .user-profile {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        /* MAIN CHAT AREA STYLES */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
        }
        .chat-title {
          font-weight: 500;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .chevron {
          font-size: 12px;
          color: #666;
        }
        .share-btn {
          background-color: #000;
          color: #fff;
          border: none;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 13px;
          cursor: pointer;
        }

        .chat-scroll-area {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
        }
        .chat-content {
          width: 100%;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 120px; /* Space for floating input */
        }

        .message-wrapper {
          display: flex;
          gap: 16px;
          max-width: 85%;
        }
        .message-wrapper.is-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .message-wrapper.is-bot {
          align-self: flex-start;
        }

        .bot-avatar {
          width: 28px;
          height: 28px;
          background-color: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .message-content {
          font-size: 15px;
          line-height: 1.6;
          color: #222;
        }
        
        .is-user .message-content {
          background-color: #e3e3e3;
          padding: 12px 18px;
          border-radius: 20px;
          color: #000;
        }

        .is-bot .message-content {
          padding-top: 4px;
        }
        .message-content.typing {
          color: #888;
          font-style: italic;
        }

        /* FLOATING INPUT STYLES */
        .input-container {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 0 24px;
          box-sizing: border-box;
        }

        .input-pill {
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 40px;
          padding: 8px 12px;
          width: 100%;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        }

        .add-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f4f4f4;
          border: none;
          font-size: 20px;
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .message-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          background: transparent;
        }

        .input-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .model-selector {
          font-size: 13px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .mic-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          opacity: 0.6;
        }

        .send-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #000;
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.2s;
        }
        
        .send-btn:hover {
          background-color: #333;
        }

        .stop-icon {
          width: 10px;
          height: 10px;
          background-color: #fff;
          border-radius: 2px;
        }

        .disclaimer {
          font-size: 12px;
          color: #888;
        }
      `}</style>
    </div>
  );
}

export default Chatbot;