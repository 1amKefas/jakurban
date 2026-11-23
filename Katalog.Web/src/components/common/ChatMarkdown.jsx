import { createMemo, For } from 'solid-js';

/**
 * Membersihkan em-dash / en-dash khas AI (— / –) di dalam teks prosa,
 * sambil tetap menjaga rentang angka (misal 15–20 -> 15-20).
 */
const cleanAiDashes = (text = '') =>
  String(text)
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/([A-Za-z0-9)])[—–]([A-Za-z0-9(])/g, '$1, $2');

const isTableSeparatorRow = (line) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

const splitTableCells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * Merender format inline: **bold**, *italic*, `code`, dan [link](url)
 * tanpa menampilkan karakter ** atau * mentah (termasuk saat sedang streaming).
 */
const renderInline = (rawLine, isStreaming = false) => {
  let line = cleanAiDashes(rawLine);

  // Sembunyikan ** gantung di ujung kalimat saat token masih mengalir (streaming)
  if (isStreaming) {
    line = line.replace(/\*\*$/, '');
  }

  const tokenRegex =
    /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\*[^\s*](?:[^*\n]*[^\s*])?\*|https?:\/\/[^\s<]+)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong class="chat-md-bold">{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code class="chat-md-code">{part.slice(1, -1)}</code>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = /^https?:\/\/|^mailto:|^tel:/i.test(linkMatch[2].trim())
        ? linkMatch[2].trim()
        : `https://${linkMatch[2].trim()}`;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" class="chat-md-link">
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em class="chat-md-italic">{part.slice(1, -1)}</em>;
    }

    if (/^https?:\/\/[^\s<]+$/i.test(part)) {
      return (
        <a href={part} target="_blank" rel="noopener noreferrer" class="chat-md-link">
          {part}
        </a>
      );
    }

    // Jika saat streaming ada ** pembuka yang belum tertutup di akhir baris, tetap tampilkan bold tanpa **
    if (isStreaming && part.includes('**')) {
      const [before, ...rest] = part.split('**');
      return (
        <>
          {before}
          <strong class="chat-md-bold">{rest.join('')}</strong>
        </>
      );
    }

    return part;
  });
};

export default function ChatMarkdown(props) {
  const blocks = createMemo(() => {
    const raw = String(props.text || '').replace(/\r\n/g, '\n');
    const lines = raw.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Tabel Markdown (Header + baris pemisah |---| + baris isi)
      if (
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        isTableSeparatorRow(lines[i + 1])
      ) {
        const headers = splitTableCells(trimmed);
        i += 2; // Lewati header & separator
        const rows = [];

        while (i < lines.length && lines[i].trim().includes('|')) {
          const rowLine = lines[i].trim();
          if (!isTableSeparatorRow(rowLine)) {
            rows.push(splitTableCells(rowLine));
          }
          i++;
        }

        result.push({ type: 'table', headers, rows });
        continue;
      }

      // 2. Garis pemisah (--- / ***)
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        result.push({ type: 'hr' });
        i++;
        continue;
      }

      // 3. Heading (# s.d. ######) tanpa memunculkan tanda #
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        result.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2]
        });
        i++;
        continue;
      }

      // 4. Unordered List (- / * / •) dirender sebagai <ul> rapi tanpa dash mentah
      const ulMatch = rawLine.match(/^(\s*)(?:[-*•])\s+(.*)$/);
      if (ulMatch) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)(?:[-*•])\s+(.*)$/);
          if (!m) break;
          items.push({
            nested: m[1].length >= 2,
            content: m[2]
          });
          i++;
        }
        result.push({ type: 'ul', items });
        continue;
      }

      // 5. Ordered List (1. / 1))
      const olMatch = rawLine.match(/^(\s*)\d+[.)]\s+(.*)$/);
      if (olMatch) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)\d+[.)]\s+(.*)$/);
          if (!m) break;
          items.push({
            nested: m[1].length >= 2,
            content: m[2]
          });
          i++;
        }
        result.push({ type: 'ol', items });
        continue;
      }

      // 6. Paragraf biasa (gabungkan baris yang masih satu paragraf)
      const paraLines = [trimmed];
      i++;
      while (i < lines.length) {
        const nextTrim = lines[i].trim();
        if (
          !nextTrim ||
          /^#{1,6}\s+/.test(nextTrim) ||
          /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrim) ||
          /^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i]) ||
          (nextTrim.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1]))
        ) {
          break;
        }
        paraLines.push(nextTrim);
        i++;
      }

      result.push({ type: 'paragraph', content: paraLines.join(' ') });
    }

    return result;
  });

  return (
    <div class="chat-md-root">
      <For each={blocks()}>
        {(block) => {
          if (block.type === 'hr') {
            return <hr class="chat-md-hr" />;
          }

          if (block.type === 'heading') {
            return (
              <div class={`chat-md-heading level-${Math.min(block.level, 4)}`}>
                {renderInline(block.content, props.isStreaming)}
              </div>
            );
          }

          if (block.type === 'table') {
            return (
              <div class="chat-md-table-wrap">
                <table class="chat-md-table">
                  <thead>
                    <tr>
                      <For each={block.headers}>
                        {(col) => <th>{renderInline(col, props.isStreaming)}</th>}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={block.rows}>
                      {(row) => (
                        <tr>
                          <For each={row}>
                            {(cell) => <td>{renderInline(cell, props.isStreaming)}</td>}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            );
          }

          if (block.type === 'ul') {
            return (
              <ul class="chat-md-list">
                <For each={block.items}>
                  {(item) => (
                    <li class={item.nested ? 'nested-item' : ''}>
                      {renderInline(item.content, props.isStreaming)}
                    </li>
                  )}
                </For>
              </ul>
            );
          }

          if (block.type === 'ol') {
            return (
              <ol class="chat-md-list ordered">
                <For each={block.items}>
                  {(item) => (
                    <li class={item.nested ? 'nested-item' : ''}>
                      {renderInline(item.content, props.isStreaming)}
                    </li>
                  )}
                </For>
              </ol>
            );
          }

          return (
            <p class="chat-md-paragraph">
              {renderInline(block.content, props.isStreaming)}
            </p>
          );
        }}
      </For>
    </div>
  );
}