import { createSignal, createEffect, For, Show } from 'solid-js';
import { Icons } from './Icons';

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
    // Track messages length and typing state to trigger auto-scroll
    messages();
    isTyping();
    scrollToBottom();
  });

  const getBotResponse = (userText) => {
    const textLower = userText.toLowerCase();

    if (textLower.includes('lokasi') || textLower.includes('area') || textLower.includes('daerah') || textLower.includes('tempat') || textLower.includes('saran')) {
      return 'Berdasarkan preferensi Anda, saya merekomendasikan area Jakarta Selatan seperti Setiabudi dan Kemang yang memiliki akses strategis ke pusat bisnis.';
    }

    if (textLower.includes('kpr') || textLower.includes('hitung') || textLower.includes('cicil') || textLower.includes('bunga') || textLower.includes('simulasi')) {
      return 'Untuk simulasi KPR, saya memerlukan informasi harga properti dan tenor yang diinginkan. Rata-rata bunga KPR saat ini berkisar 7-9% per tahun.';
    }

    if (textLower.includes('ketersediaan') || textLower.includes('unit') || textLower.includes('stok') || textLower.includes('tersedia') || textLower.includes('ready')) {
      return 'Saat ini kami memiliki beberapa unit tersedia di berbagai cluster. Cluster Setiabudi memiliki 3 unit ready stock.';
    }

    return 'Terima kasih atas pertanyaan Anda. Tim kami akan segera menghubungi Anda untuk informasi lebih detail.';
  };

  const sendMessage = (textToSend) => {
    const trimmed = (textToSend || input()).trim();
    if (!trimmed) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmed
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const responseText = getBotResponse(trimmed);
      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: responseText
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleQuickAction = (question) => {
    sendMessage(question);
  };

  return (
    <div class="chatbot-fullpage">
      <div class="chat-container">
        <div class="chat-sidebar">
          <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '40px' }}>
            <h3 style={{ margin: 0 }}>JakUrban AI</h3>
            <button
              onClick={() => props.setView?.('catalog')}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
              aria-label="Tutup Chat"
            >
              <Icons.Close />
            </button>
          </div>

          <div style={{ display: 'flex', "flex-direction": 'column', gap: '15px', "font-size": '14px' }}>
            <div
              class="chat-sidebar-action"
              onClick={() => handleQuickAction('Bisa berikan saran lokasi properti terbaik?')}
            >
              Saran Lokasi
            </div>
            <div
              class="chat-sidebar-action"
              onClick={() => handleQuickAction('Bagaimana cara hitung KPR untuk properti ini?')}
            >
              Hitung KPR
            </div>
            <div
              class="chat-sidebar-action"
              onClick={() => handleQuickAction('Bisa cek ketersediaan unit properti saat ini?')}
            >
              Cek Ketersediaan
            </div>
          </div>
        </div>

        <div class="chat-main">
          <div class="chat-messages">
            <For each={messages()}>
              {(msg) => (
                <div class={`message-bubble ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
                  {msg.text}
                </div>
              )}
            </For>
            <Show when={isTyping()}>
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </Show>
            <div ref={messagesEndRef} />
          </div>

          <div class="chat-input-area">
            <input
              class="chat-input"
              type="text"
              placeholder="Tuliskan keinginan hunian Anda..."
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <button class="btn-primary" onClick={() => sendMessage()}>
              Kirim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;
