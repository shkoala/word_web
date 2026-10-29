/* Word Web — pure game rules. Also runnable in Node for tests. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WordWebCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LENGTH = 32;
  const MAX_WORDS = 200;
  const normaliseApostrophes = text => text.replace(/[\u2018\u2019\u02bc]/g, "'");
  const validEntry = text => typeof text === 'string' && /[a-z]/i.test(text) && /^[a-zA-Z .,'\-]+$/.test(text);

  function parseWords(source) {
    const words = [];
    const errors = [];
    String(source ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
      const text = normaliseApostrophes(line.trim().replace(/\s+/g, ' '));
      if (!text) return;
      if (!validEntry(text)) {
        errors.push({ line: index + 1, code: 'characters' });
      } else if (text.length > MAX_LENGTH) {
        errors.push({ line: index + 1, code: 'length' });
      } else words.push(text);
    });
    if (!words.length && !errors.length) errors.push({ line: 0, code: 'empty' });
    if (words.length > MAX_WORDS) errors.push({ line: 0, code: 'count' });
    return { words, errors, valid: errors.length === 0 };
  }

  function shuffled(words, random = Math.random) {
    const copy = words.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  class Session {
    constructor(words) {
      if (!Array.isArray(words) || !words.length || words.length > MAX_WORDS ||
          words.some(word => !validEntry(word) || word.length > MAX_LENGTH)) {
        throw new TypeError('Session requires a validated nonempty word list.');
      }
      this.words = words.slice();
      this.index = 0;
      this.letters = [];
      this.caught = new Set();
      this.webTrails = [];
      this.capitalNext = false;
    }
    get word() { return this.words[this.index] ?? null; }
    get typed() { return this.letters.join(''); }
    get finished() { return this.index >= this.words.length; }
    get correctPrefix() { return this.word !== null && this.word.startsWith(this.typed); }
    get solved() { return this.word !== null && this.typed === this.word; }
    get prefixLength() {
      let length = 0;
      while (length < this.letters.length && this.letters[length] === this.word?.[length]) length++;
      return length;
    }
    add(letter) {
      if (typeof letter === 'string') letter=normaliseApostrophes(letter);
      if (this.finished || this.solved || typeof letter !== 'string' || !/^[a-zA-Z .,'\-]$/.test(letter) || this.letters.length >= MAX_LENGTH + 1) {
        return { accepted: false, correct: false, solved: this.solved };
      }
      if (/[a-z]/i.test(letter)) {
        if (this.capitalNext) letter = letter.toUpperCase();
        this.capitalNext = false;
      }
      this.letters.push(letter);
      if (this.solved) this.caught.add(this.index);
      return { accepted: true, correct: this.correctPrefix, solved: this.solved };
    }
    undo() {
      if (!this.letters.length || this.finished) return false;
      this.caught.delete(this.index);
      this.letters.pop();
      this.capitalNext = false;
      return true;
    }
    resetWord() {
      if (this.finished) return;
      this.caught.delete(this.index);
      this.letters = [];
      this.capitalNext = false;
    }
    toggleCapital() {
      if (this.finished || this.solved) return false;
      this.capitalNext = !this.capitalNext;
      return this.capitalNext;
    }
    next() {
      if (!this.finished) {
        // Keep only the correct part. A skipped mistake must not leave red
        // strands in the shared web, and words never join across boundaries.
        this.webTrails.push(this.letters.slice(0, this.prefixLength));
        this.index++;
        this.letters = [];
        this.capitalNext = false;
      }
      return !this.finished;
    }
  }

  // Alternating common and less common letters; vowels span the whole web.
  // Artwork and hit areas share these exact coordinates (1491 × 1055).
  const LETTER_ORDER = 'ez tq nj ax sk iv rb cy ow dg up lf hm'.replace(/ /g,'');
  const NODES = [...LETTER_ORDER].map((letter,index) => {
    const angle=-Math.PI/2+index*Math.PI*2/26;
    const x=+(770+590*Math.cos(angle)).toFixed(2);
    const y=+(535+390*Math.sin(angle)).toFixed(2);
    const labelX=+(x+68*Math.cos(angle)).toFixed(2);
    const labelY=+(y+70*Math.sin(angle)).toFixed(2);
    const halfWidth='mw'.includes(letter)?62:'il'.includes(letter)?32:49;
    return {letter,x,y,labelX,labelY,
      left:Math.max(0,Math.min(x-24,labelX-halfWidth)),
      right:Math.min(1491,Math.max(x+24,labelX+halfWidth)),
      top:Math.max(0,Math.min(y-24,labelY-57)),
      bottom:Math.min(1055,Math.max(y+24,labelY+57))};
  });
  const SPACE_NODE = { letter: ' ', x: 790, y: 650 };
  const PUNCTUATION_NODES = [
    {letter:'.', x:430, y:410}, {letter:',', x:1090, y:760},
    {letter:'-', x:510, y:745}, {letter:"'", x:1180, y:470}
  ];
  const NODE_MAP = new Map([...NODES, SPACE_NODE, ...PUNCTUATION_NODES].map(node => [node.letter, node]));

  function threadPath(from, to, occurrence = 0) {
    if (from.letter !== to.letter) {
      if (!occurrence) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
      // A previously used connection needs its own lane, even when traversed
      // in the opposite direction. Otherwise the return stroke is invisible.
      const [a,b] = from.letter < to.letter ? [from,to] : [to,from];
      const dx=b.x-a.x, dy=b.y-a.y;
      const distance=Math.hypot(dx,dy);
      let nx=-dy/distance, ny=dx/distance;
      const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      if ((790-mx)*nx+(580-my)*ny < 0) { nx=-nx; ny=-ny; }
      // Gently fan the curves towards the interior. A bounded, increasing
      // bend keeps every visit distinct without drawing outside the board.
      const bend=52+200*occurrence/(occurrence+4);
      return `M ${from.x} ${from.y} Q ${mx+nx*bend} ${my+ny*bend}, ${to.x} ${to.y}`;
    }
    // A visible inward loop for consecutive identical letters: book, moon, see.
    const dx = 790 - from.x, dy = 580 - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = length === 1 ? 0 : dx / length;
    const uy = length === 1 ? -1 : dy / length;
    const vx = -uy, vy = ux;
    const depth = 82+18*occurrence, width = 60+14*occurrence;
    const c1 = [from.x + depth * ux + width * vx, from.y + depth * uy + width * vy];
    const c2 = [from.x + depth * ux - width * vx, from.y + depth * uy - width * vy];
    return `M ${from.x} ${from.y} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${from.x} ${from.y}`;
  }
  function buildThreadSegments(letters, visits = new Map()) {
    const segments=[];
    for (let step=1; step<letters.length; step++) {
      const from=NODE_MAP.get(letters[step-1].toLowerCase());
      const to=NODE_MAP.get(letters[step].toLowerCase());
      if (!from || !to) throw new TypeError('Unknown letter in thread history.');
      const key=[from.letter,to.letter].sort().join('|');
      const occurrence=visits.get(key) || 0;
      visits.set(key,occurrence+1);
      segments.push({step,from,to,occurrence,d:threadPath(from,to,occurrence)});
    }
    return segments;
  }
  function buildWebSegments(trails, letters = []) {
    const visits = new Map();
    const result = [];
    trails.forEach((trail, wordIndex) => {
      for (const segment of buildThreadSegments(trail, visits)) result.push({...segment, wordIndex, archived:true});
    });
    for (const segment of buildThreadSegments(letters, visits)) result.push({...segment, wordIndex:trails.length, archived:false});
    return result;
  }
  return { parseWords, shuffled, Session, LETTER_ORDER, NODES, SPACE_NODE, PUNCTUATION_NODES, NODE_MAP, threadPath, buildThreadSegments, buildWebSegments, MAX_LENGTH, MAX_WORDS };
}));
