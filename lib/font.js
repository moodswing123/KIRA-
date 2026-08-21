// lib/font.js — V12 bot-wide reply styling
// WhatsApp cannot change its UI font; these presets style bot-generated text only.

const STYLE_ALIASES = {
  plain: 'plain', normal: 'plain', off: 'plain', reset: 'plain',
  bold: 'bold', italic: 'italic', bolditalic: 'bolditalic', bi: 'bolditalic',
  double: 'double', math: 'double', sans: 'sans', sansbold: 'sansbold',
  sansitalic: 'sansitalic', mono: 'mono', monospace: 'mono',
  fullwidth: 'fullwidth', wide: 'fullwidth', bubble: 'bubble', circled: 'bubble',
  squared: 'squared', smallcaps: 'smallcaps', small: 'smallcaps',
  gothic: 'gothic', fraktur: 'gothic'
};

const STYLE_NAMES = [
  'plain', 'bold', 'italic', 'bolditalic', 'double', 'sans',
  'sansbold', 'sansitalic', 'mono', 'fullwidth', 'bubble',
  'squared', 'smallcaps', 'gothic'
];

function normalizeStyle(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return STYLE_ALIASES[key] || null;
}

function mapMath(text, upper, lower, digits) {
  return [...String(text)].map(ch => {
    const cp = ch.codePointAt(0);
    if (cp >= 65 && cp <= 90 && upper) return String.fromCodePoint(upper + cp - 65);
    if (cp >= 97 && cp <= 122 && lower) return String.fromCodePoint(lower + cp - 97);
    if (cp >= 48 && cp <= 57 && digits) return String.fromCodePoint(digits + cp - 48);
    return ch;
  }).join('');
}

function replaceChars(text, table) {
  return [...String(text)].map(ch => table[ch] || ch).join('');
}

const SMALL = { a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'ᑫ',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ' };
const SQUARED = { A:'🅰',B:'🅱',C:'🅲',D:'🅳',E:'🅴',F:'🅵',G:'🅶',H:'🅷',I:'🅸',J:'🅹',K:'🅺',L:'🅻',M:'🅼',N:'🅽',O:'🅾',P:'🅿',Q:'🆀',R:'🆁',S:'🆂',T:'🆃',U:'🆄',V:'🆅',W:'🆆',X:'🆇',Y:'🆈',Z:'🆉' };

function styleText(text, style) {
  const name = normalizeStyle(style) || 'plain';
  const input = String(text == null ? '' : text);
  switch (name) {
    case 'bold': return mapMath(input, 0x1D400, 0x1D41A, 0x1D7CE);
    case 'italic': return mapMath(input, 0x1D434, 0x1D44E, null);
    case 'bolditalic': return mapMath(input, 0x1D468, 0x1D482, null);
    case 'double': return mapMath(input, 0x1D538, 0x1D552, 0x1D7D8);
    case 'sans': return mapMath(input, 0x1D5A0, 0x1D5BA, 0x1D7E2);
    case 'sansbold': return mapMath(input, 0x1D5D4, 0x1D5EE, 0x1D7EC);
    case 'sansitalic': return mapMath(input, 0x1D608, 0x1D622, null);
    case 'mono': return mapMath(input, 0x1D670, 0x1D68A, 0x1D7F6);
    case 'fullwidth': return [...input].map(ch => { const cp = ch.codePointAt(0); if (cp >= 33 && cp <= 126) return String.fromCodePoint(cp + 0xFEE0); if (ch === ' ') return '　'; return ch; }).join('');
    case 'bubble': return [...input].map(ch => { const cp = ch.toUpperCase().codePointAt(0); if (cp >= 65 && cp <= 90) return String.fromCodePoint(0x24B6 + cp - 65); if (cp >= 49 && cp <= 57) return String.fromCodePoint(0x2460 + cp - 49); if (cp === 48) return '⓪'; return ch; }).join('');
    case 'squared': return replaceChars(input.toUpperCase(), SQUARED);
    case 'smallcaps': return replaceChars(input.toLowerCase(), SMALL);
    case 'gothic': return mapMath(input, 0x1D504, 0x1D51E, null);
    default: return input;
  }
}

function styleOutgoingContent(content, style) {
  if (!content || typeof content !== 'object') return content;
  const next = { ...content };
  if (typeof next.text === 'string') next.text = styleText(next.text, style);
  if (typeof next.caption === 'string') next.caption = styleText(next.caption, style);
  return next;
}

function describeStyles() {
  return STYLE_NAMES.map(name => `${name}: ${styleText('Kira MD', name)}`).join('\n');
}

module.exports = { STYLE_NAMES, normalizeStyle, styleText, styleOutgoingContent, describeStyles };
