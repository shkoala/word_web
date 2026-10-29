const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let Core;
try { Core = require('../dist/core.js'); } catch (_) { Core = require('../core.js'); }
const {parseWords, Session, shuffled, NODES, NODE_MAP, threadPath} = Core;

test('normalises case, CRLF, extra whitespace and short phrases; preserves practice repetitions', () => {
  const input = '  KITE  \r\n\r\nA\tCAT\nbook\nbook\n';
  assert.deepEqual(parseWords(input), {words:['kite','a cat','book','book'],errors:[],valid:true});
});
test('rejects punctuation, non-English letters, overlong phrases, empty lists and excess entries', () => {
  assert.equal(parseWords('cat\nкот').errors[0].line,2);
  assert.equal(parseWords("don't").errors[0].code,'characters');
  assert.equal(parseWords('<img src=x>').valid,false);
  assert.equal(parseWords('a'.repeat(33)).errors[0].code,'length');
  assert.equal(parseWords('a'.repeat(32)).valid,true);
  assert.equal(parseWords(' \n\n').errors[0].code,'empty');
  assert.equal(parseWords(Array(201).fill('cat').join('\n')).errors[0].code,'count');
  assert.throws(() => new Session(['Cat']),TypeError);
  assert.throws(() => new Session([]),TypeError);
});
test('wrong clicks stay visible, never win, and can be undone before correct completion', () => {
  const session = new Session(['cat']);
  assert.deepEqual(session.add('c'),{accepted:true,correct:true,solved:false});
  assert.equal(session.add('o').correct,false);
  assert.equal(session.typed,'co');
  assert.equal(session.prefixLength,1);
  session.add('t');
  assert.equal(session.solved,false);
  assert.equal(session.caught.size,0);
  session.undo(); session.undo();
  session.add('a');
  assert.equal(session.add('t').solved,true);
  assert.equal(session.caught.size,1);
  assert.equal(session.add('x').accepted,false);
});
test('consecutive identical letters and centre spaces are actual input characters', () => {
  const session = new Session(['book','a cat']);
  for (const char of 'book') session.add(char);
  assert.equal(session.typed,'book');
  assert.equal(session.solved,true);
  session.next();
  for (const char of 'a cat') session.add(char);
  assert.equal(session.solved,true);
  assert.equal(session.letters[1],' ');
  assert.equal(session.caught.size,2);
  session.next();
  assert.equal(session.finished,true);
  assert.equal(session.add('a').accepted,false);
});
test('reset and undo after a win revoke that catch and allow replay without double scoring', () => {
  const session = new Session(['a','a']);
  session.add('a');
  assert.equal(session.caught.size,1);
  session.resetWord();
  assert.equal(session.typed,'');
  assert.equal(session.caught.size,0);
  session.add('a'); session.undo();
  assert.equal(session.caught.size,0);
  session.add('a'); session.next(); session.add('a');
  assert.equal(session.caught.size,2);
});
test('Next skips an unfinished word, clears its trail and handles the final word once', () => {
  const session = new Session(['kite','bone']);
  session.add('x'); session.next();
  assert.equal(session.word,'bone');
  assert.equal(session.typed,'');
  assert.equal(session.caught.size,0);
  for (const char of 'bone') session.add(char);
  assert.equal(session.next(),false);
  assert.equal(session.index,2);
  session.next();
  assert.equal(session.index,2);
  assert.equal(session.caught.size,1);
});
test('all 26 hotspots are unique, match the supplied image and include their dot', () => {
  assert.equal(NODES.length,26);
  assert.equal(NODES.map(node=>node.letter).sort().join(''),'abcdefghijklmnopqrstuvwxyz');
  for (const node of NODES) {
    assert.ok(node.x>=node.left && node.x<=node.right);
    assert.ok(node.y>=node.top && node.y<=node.bottom);
    assert.ok(node.left>=0 && node.right<=1491 && node.top>=0 && node.bottom<=1055);
  }
  assert.equal(NODE_MAP.get(' ').letter,' ');
});
test('thread coordinates follow clicked dots and repeated letters make a visible loop', () => {
  assert.equal(threadPath(NODE_MAP.get('a'),NODE_MAP.get('b')),'M 1267 263 L 1034 138');
  const loop = threadPath(NODE_MAP.get('o'),NODE_MAP.get('o'));
  assert.match(loop,/ C /);
  assert.ok(!loop.includes('NaN'));
  assert.ok(!threadPath(NODE_MAP.get(' '),NODE_MAP.get(' ')).includes('NaN'));
});
test('shuffle keeps every entry and does not mutate the teacher list', () => {
  const original = ['a','cat','book','a'];
  const result = shuffled(original,()=>.1);
  assert.deepEqual(original,['a','cat','book','a']);
  assert.deepEqual(result.slice().sort(),original.slice().sort());
  assert.notDeepEqual(result,original);
});
