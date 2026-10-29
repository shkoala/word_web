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

  function parseWords(source) {
    const words = [];
    const errors = [];
    String(source ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
      const text = line.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!text) return;
      if (!/^[a-z]+(?: [a-z]+)*$/.test(text)) {
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
          words.some(word => typeof word !== 'string' || !/^[a-z]+(?: [a-z]+)*$/.test(word) || word.length > MAX_LENGTH)) {
        throw new TypeError('Session requires a validated nonempty word list.');
      }
      this.words = words.slice();
      this.index = 0;
      this.letters = [];
      this.caught = new Set();
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
      if (this.finished || this.solved || !/^[a-z ]$/.test(letter) || this.letters.length >= MAX_LENGTH + 1) {
        return { accepted: false, correct: false, solved: this.solved };
      }
      this.letters.push(letter);
      if (this.solved) this.caught.add(this.index);
      return { accepted: true, correct: this.correctPrefix, solved: this.solved };
    }
    undo() {
      if (!this.letters.length || this.finished) return false;
      this.caught.delete(this.index);
      this.letters.pop();
      return true;
    }
    resetWord() {
      if (this.finished) return;
      this.caught.delete(this.index);
      this.letters = [];
    }
    next() {
      if (!this.finished) {
        this.index++;
        this.letters = [];
      }
      return !this.finished;
    }
  }

  // Coordinates are measured against the supplied 1491 × 1055 PNG.
  // x/y are the brown dot centres; hit includes both the printed letter and dot.
  const NODES = [
    ['t',748,80,715,5,786,108], ['d',893,100,864,15,932,130],
    ['b',1034,138,1000,58,1081,168], ['l',1158,202,1131,123,1204,234],
    ['a',1267,263,1231,190,1308,300], ['x',1350,354,1311,285,1420,391],
    ['o',1389,457,1354,405,1475,495], ['i',1410,561,1376,511,1467,603],
    ['u',1382,672,1344,632,1464,719], ['q',1330,771,1291,731,1405,833],
    ['f',1242,855,1207,815,1303,920], ['k',1121,909,1084,870,1190,981],
    ['p',993,949,951,910,1050,1042], ['s',850,974,812,933,905,1048],
    ['e',707,974,655,934,752,1050], ['j',439,914,394,877,474,1007],
    ['h',325,862,260,821,361,937], ['y',233,789,164,754,275,859],
    ['m',174,695,87,656,213,743], ['n',132,593,58,542,176,638],
    ['w',129,489,43,443,173,535], ['c',161,382,95,338,203,424],
    ['g',232,288,160,235,270,326], ['v',334,212,298,146,372,253],
    ['r',458,140,419,69,496,177], ['z',601,101,558,27,644,140]
  ].map(([letter,x,y,left,top,right,bottom]) => ({ letter,x,y,left,top,right,bottom }));
  const SPACE_NODE = { letter: ' ', x: 790, y: 580 };
  const NODE_MAP = new Map([...NODES, SPACE_NODE].map(node => [node.letter, node]));

  function threadPath(from, to) {
    if (from.letter !== to.letter) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    // A visible inward loop for consecutive identical letters: book, moon, see.
    const dx = 790 - from.x, dy = 580 - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = length === 1 ? 0 : dx / length;
    const uy = length === 1 ? -1 : dy / length;
    const vx = -uy, vy = ux;
    const c1 = [from.x + 82 * ux + 60 * vx, from.y + 82 * uy + 60 * vy];
    const c2 = [from.x + 82 * ux - 60 * vx, from.y + 82 * uy - 60 * vy];
    return `M ${from.x} ${from.y} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${from.x} ${from.y}`;
  }
  return { parseWords, shuffled, Session, NODES, SPACE_NODE, NODE_MAP, threadPath, MAX_LENGTH, MAX_WORDS };
}));
