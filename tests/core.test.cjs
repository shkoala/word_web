const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
let Core;
try { Core = require('../dist/core.js'); } catch (_) { Core = require('../core.js'); }
const {parseWords, Session, shuffled, NODES, NODE_MAP, threadPath, buildThreadSegments, buildWebSegments} = Core;

test('preserves case and practice repetitions while normalising whitespace', () => {
  const input = '  KITE  \r\n\r\nA\tCAT\nbook\nbook\n';
  assert.deepEqual(parseWords(input), {words:['KITE','A CAT','book','book'],errors:[],valid:true});
});
test('rejects unsupported punctuation, non-English letters, overlong phrases, empty lists and excess entries', () => {
  assert.equal(parseWords('cat\nкот').errors[0].line,2);
  assert.equal(parseWords("don't").errors[0].code,'characters');
  assert.equal(parseWords('<img src=x>').valid,false);
  assert.equal(parseWords('a'.repeat(33)).errors[0].code,'length');
  assert.equal(parseWords('a'.repeat(32)).valid,true);
  assert.equal(parseWords(' \n\n').errors[0].code,'empty');
  assert.equal(parseWords(Array(201).fill('cat').join('\n')).errors[0].code,'count');
  assert.equal(new Session(['Cat']).word,'Cat');
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

test('a cat can run accepts every return to a used letter and separates the repeated centre-to-c connection', () => {
  const session=new Session(['a cat can run']);
  for (const letter of 'a cat can run') assert.equal(session.add(letter).correct,true);
  assert.equal(session.solved,true);
  assert.equal(session.typed,'a cat can run');
  const segments=buildThreadSegments(session.letters);
  assert.equal(segments.length,12);
  const firstReturn=segments.find(s=>s.step===2);
  const secondReturn=segments.find(s=>s.step===6);
  assert.equal(firstReturn.from.letter,' ');
  assert.equal(firstReturn.to.letter,'c');
  assert.equal(secondReturn.to.letter,'c');
  assert.equal(secondReturn.occurrence,1);
  assert.notEqual(firstReturn.d,secondReturn.d);
  assert.match(secondReturn.d,/ Q /);
  assert.notEqual(segments.find(s=>s.step===3).d,segments.find(s=>s.step===7).d);
});
test('backtracking across the same pair uses distinct routes in either direction', () => {
  const segments=buildThreadSegments([...'cacac']);
  assert.deepEqual(segments.map(s=>s.occurrence),[0,1,2,3]);
  assert.equal(new Set(segments.map(s=>s.d)).size,4);
  assert.ok(segments.slice(1).every(s=>s.d.includes(' Q ')));
  assert.equal(new Set(buildThreadSegments([...'oooo']).map(s=>s.d)).size,3);
});
test('undo and reset rebuild lane counts from the remaining clicks only', () => {
  const session=new Session(['cacac']);
  for (const letter of 'caca') session.add(letter);
  const before=buildThreadSegments(session.letters);
  session.add('c');session.undo();
  assert.deepEqual(buildThreadSegments(session.letters),before);
  session.resetWord();
  assert.deepEqual(buildThreadSegments(session.letters),[]);
  session.add('c');session.add('a');
  assert.equal(buildThreadSegments(session.letters)[0].occurrence,0);
});

test('correct threads accumulate across six words without connecting word boundaries', () => {
  const session=new Session(['cat','cat','cat','cat','cat','cat']);
  for (let round=0;round<6;round++) {
    for (const char of 'cat') session.add(char);
    session.next();
    assert.equal(buildWebSegments(session.webTrails).length,(round+1)*2);
  }
  const segments=buildWebSegments(session.webTrails);
  assert.equal(session.caught.size,6);
  assert.deepEqual(segments.filter(s=>s.from.letter==='c').map(s=>s.occurrence),[0,1,2,3,4,5]);
  assert.equal(new Set(segments.map(s=>s.d)).size,12);
  assert.ok(segments.every(s=>s.archived));
});
test('reset and undo affect only the current attempt; replay starts a new empty web', () => {
  const session=new Session(['cat','car']);
  for(const char of 'cat') session.add(char);
  session.next();
  const saved=buildWebSegments(session.webTrails);
  for(const char of 'ca') session.add(char);
  session.undo(); session.resetWord();
  assert.deepEqual(buildWebSegments(session.webTrails),saved);
  assert.equal(session.caught.size,1);
  assert.equal(new Session(session.words).webTrails.length,0);
});
test('skipping keeps only the correct prefix, never a wrong red segment', () => {
  const session=new Session(['catch','cat']);
  for(const char of 'catx') session.add(char);
  session.next();
  assert.deepEqual(session.webTrails,[['c','a','t']]);
  assert.equal(buildWebSegments(session.webTrails).length,2);
  assert.equal(session.caught.size,0);
});
test('punctuation and case are preserved, required and represented by real central nodes', () => {
  const target='Cat, dog-bone.';
  assert.deepEqual(parseWords(target).words,[target]);
  assert.equal(parseWords('...').valid,false);
  const session=new Session([target]);
  session.add('c'); assert.equal(session.correctPrefix,false); session.undo();
  for(const char of target) session.add(char);
  assert.equal(session.solved,true);
  const segments=buildThreadSegments(session.letters);
  assert.equal(segments.length,target.length-1);
  assert.equal(segments[0].from.letter,'c');
  for(const char of ['.',',','-',' ']) assert.ok(NODE_MAP.has(char));
});
test('capital control applies to one next letter, is cancellable, and adds no character or thread', () => {
  const session=new Session(['A Cat.','Dog']);
  session.toggleCapital(); session.toggleCapital();
  assert.equal(session.capitalNext,false);
  session.toggleCapital(); session.add('a');
  assert.equal(session.typed,'A'); assert.equal(session.capitalNext,false);
  session.add(' '); session.toggleCapital();
  assert.equal(session.typed,'A ');
  session.add('c'); session.add('a'); session.add('t'); session.add('.');
  assert.equal(session.typed,'A Cat.'); assert.equal(session.solved,true);
  session.next(); assert.equal(session.capitalNext,false);
  session.toggleCapital(); session.resetWord(); assert.equal(session.capitalNext,false);
});
test('arming capital survives punctuation until a letter, while invalid input does not consume it', () => {
  const session=new Session(['a']);
  session.toggleCapital();
  assert.equal(session.add('!').accepted,false);
  session.add('.'); assert.equal(session.capitalNext,true);
  session.add('a'); assert.equal(session.typed,'.A'); assert.equal(session.capitalNext,false);
});
