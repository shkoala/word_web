/* Word Web — buildless, offline-capable browser application. */
(() => {
  'use strict';
  const {parseWords, shuffled, Session, NODES, NODE_MAP, buildWebSegments} = window.WordWebCore;
  const $ = id => document.getElementById(id);
  const DEFAULT_WORDS = 'hop\nfly\nrun\njump\nswim\ndive\nbook\na cat';
  const STORAGE_KEY = 'shkoala.word-web.v1';
  const FLY_IMAGES = ['assets/fly-brown.png','assets/fly-green.png','assets/fly-blue.png','assets/fly-purple.png'];
  const ASSETS = ['assets/forest.png','assets/web-v3.svg','assets/spider-v3.png','assets/shkoala-logo.png',...FLY_IMAGES];
  const COPY = {
  "brandCaption": "Catch the word",
  "eyebrow": "A spelling adventure",
  "headline": "Read it.\nSpell it. Catch it!",
  "intro": "Read the word on the fly. Click the letters to catch it. Watch your web grow!",
  "littleNote": "Click the letters!",
  "step1": "Read",
  "step2": "Spell",
  "step3": "Catch!",
  "teacher": "For the teacher",
  "wordListTitle": "Your words",
  "inputLabel": "One word or short sentence per line.",
  "inputHint": "A–Z, spaces and . , - ' · Up to 32 characters per line. Capital letters stay capital.",
  "shuffle": "Mix the words",
  "example": "Example",
  "start": "Let's play!",
  "setupFootnote": "Click Words to change your list.",
  "wordsButton": "Words",
  "space": "space",
  "undo": "Undo",
  "reset": "Reset",
  "next": "Next word",
  "finish": "Finish",
  "keyboardHint": "Keyboard: A–Z · Shift · Space · . , - ' · ⌫",
  "roundFinished": "All done!",
  "finishTitle": "Great web!",
  "replay": "Play again",
  "changeWords": "New words",
  "wordCount": "Words: {n}",
  "round": "Word {n} / {total}",
  "caught": "Caught: {n}",
  "entering": "Here comes a fly!",
  "ready": "Click the letters. Space and the signs are inside the web.",
  "working": "Good! Keep going!",
  "mistake": "Oops! Check your letters. Try Undo or Reset.",
  "feeding": "Yes! A treat for the spider!",
  "solved": "Caught! Ready for the next word?",
  "resetMessage": "Try again! Your other threads are safe.",
  "finishSummary": "You caught {n} of {total} flies.",
  "finishAll": "All words done! Look at your web!",
  "finishSome": "Play again to catch more flies.",
  "letter": "Letter {letter}",
  "spaceAria": "Space",
  "answerAria": "Your word: {word}",
  "flyTarget": "Word on the fly: {word}",
  "emptyAnswer": "empty",
  "boardAria": "Web with English letters",
  "soundOn": "Turn sound off",
  "soundOff": "Turn sound on",
  "periodAria": "Full stop",
  "commaAria": "Comma",
  "hyphenAria": "Hyphen",
  "apostropheAria": "Apostrophe",
  "capitalAria": "Capital: next letter only",
  "capitalLabel": "1 letter",
  "capitalOn": "Click a letter. It will be a capital.",
  "fullscreen": "Full screen",
  "exitFullscreen": "Exit full screen",
  "fullscreenUnavailable": "Please play in this window.",
  "errorEmpty": "Add a word to start.",
  "errorCharacters": "Line {line}: add a word. Use A–Z, spaces and . , - ' only.",
  "errorLength": "Line {line}: use up to 32 characters.",
  "errorCount": "Please use up to 200 lines.",
  "loading": "Loading pictures…",
  "assetError": "Pictures did not load. Please refresh the page."
};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) { /* Storage can be unavailable. */ }
  let soundEnabled = saved.sound === true;
  let session = null;
  let currentScreen = 'setup';
  let phase = 'ready';
  let statusKey = 'ready';
  let assetsReady = false;
  let assetFailed = false;
  let epoch = 0;
  let flyX = 790, flyY = 330;
  let audioContext;
  let shakeAnimation = null;
  const animations = new Set();
  const timers = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nodeButtons = new Map();
  const specialButtons = new Map([[' ', $('spaceButton')],['.', $('periodButton')],[',', $('commaButton')],['-', $('hyphenButton')],["'", $('apostropheButton')]]);
  let drawnTrailSession = null, drawnTrailIndex = -1;
  if (typeof saved.words === 'string' && saved.words.length < 10000) $('wordsInput').value = saved.words;
  $('shuffleInput').checked = saved.shuffle === true;

  function t(key, values = {}) {
    return (COPY[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ language:'en', sound:soundEnabled, words:$('wordsInput').value, shuffle:$('shuffleInput').checked }));
    } catch (_) { /* The game still works without local storage. */ }
  }
  function motionTime(ms) { return reducedMotion.matches ? Math.min(60, ms) : ms; }
  function later(callback, ms) {
    const token = epoch;
    const timer = setTimeout(() => { timers.delete(timer); if (epoch === token) callback(); }, motionTime(ms));
    timers.add(timer);
    return timer;
  }
  function animate(element, frames, options) {
    if (!element.animate) return null;
    const animation = element.animate(frames, {...options, duration:motionTime(options.duration || 0)});
    animations.add(animation);
    animation.finished.then(() => {
      // Finished 'forwards' effects still affect the element. Keep them tracked
      // so Reset / Next / Undo can cancel them before showing another fly.
      if (options.fill !== 'forwards' && options.fill !== 'both') animations.delete(animation);
    }, () => animations.delete(animation));
    return animation;
  }
  function cancelRoundWork() {
    epoch++;
    timers.forEach(clearTimeout); timers.clear();
    animations.forEach(animation => animation.cancel()); animations.clear();
    shakeAnimation = null;
    $('spiderBubble').hidden = true;
    $('winSparkle').hidden = true;
  }
  function setPhase(value) { phase = value; $('board').dataset.phase = value; }
  function setStatus(key) {
    statusKey = key;
    $('gameStatus').textContent = t(key);
    $('gameStatus').classList.toggle('is-error', key === 'mistake');
    $('gameStatus').classList.toggle('is-success', key === 'feeding' || key === 'solved');
  }
  function setScreen(name) {
    currentScreen = name;
    $('setupScreen').hidden = name !== 'setup';
    $('gameScreen').hidden = name !== 'game';
    $('finishScreen').hidden = name !== 'finish';
    $('forestThreads').toggleAttribute('hidden', name !== 'game');
    document.body.dataset.screen = name;
    $('editWords').hidden = name === 'setup';
  }
  function updateSoundButton() {
    $('soundButton').setAttribute('aria-pressed', String(soundEnabled));
    $('soundButton').title = t(soundEnabled ? 'soundOn' : 'soundOff');
    $('soundButton').setAttribute('aria-label', $('soundButton').title);
  }
  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement);
    $('fullscreenButton').setAttribute('aria-pressed', String(active));
    $('fullscreenButton').title = t(active ? 'exitFullscreen' : 'fullscreen');
    $('fullscreenButton').setAttribute('aria-label', $('fullscreenButton').title);
  }
  function updateTranslation() {
    document.documentElement.lang = 'en';
    document.title = `Word Web · ${t('brandCaption')}`;
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    $('brandHome').setAttribute('aria-label', `Word Web — ${t('wordListTitle')}`);
    $('spaceButton').setAttribute('aria-label', t('spaceAria'));
    for (const [id, key] of [['periodButton','periodAria'],['commaButton','commaAria'],['hyphenButton','hyphenAria'],['apostropheButton','apostropheAria'],['capitalButton','capitalAria']]) {
      $(id).setAttribute('aria-label',t(key));
      $(id).title=t(key);
    }
    $('board').setAttribute('aria-label', t('boardAria'));
    nodeButtons.forEach((button, letter) => { button.setAttribute('aria-label', t('letter', {letter})); });
    updateSoundButton(); updateFullscreenButton(); updateInput();
    if (session && currentScreen === 'game') { render(); setStatus(statusKey); $('flyPosition').setAttribute('aria-label',t('flyTarget',{word:session.word})); }
    if (session && currentScreen === 'finish') renderFinish();
  }
  function updateInput() {
    const parsed = parseWords($('wordsInput').value);
    $('wordCount').textContent = t('wordCount', {n:parsed.words.length});
    let error = '';
    if (assetFailed) error = t('assetError');
    else if (!assetsReady) error = t('loading');
    else if (!parsed.valid) {
      const first = parsed.errors[0];
      error = t({empty:'errorEmpty',characters:'errorCharacters',length:'errorLength',count:'errorCount'}[first.code], {line:first.line});
    }
    $('inputError').textContent = error;
    $('wordsInput').setAttribute('aria-invalid', String(!parsed.valid));
    $('startButton').disabled = !parsed.valid || !assetsReady || assetFailed;
    return parsed;
  }

  NODES.forEach(node => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'letter-node';
    button.dataset.letter = node.letter;
    button.setAttribute('aria-label', t('letter', {letter:node.letter}));
    const width = node.right-node.left, height = node.bottom-node.top;
    button.style.cssText = `left:${node.left/1491*100}%;top:${node.top/1055*100}%;width:${width/1491*100}%;height:${height/1055*100}%;--dot-x:${(node.x-node.left)/width*100}%;--dot-y:${(node.y-node.top)/height*100}%`;
    button.addEventListener('click', () => choose(node.letter));
    nodeButtons.set(node.letter,button);
    $('letterNodes').append(button);
  });
  specialButtons.forEach((button, char) => {
    const node = NODE_MAP.get(char);
    button.style.left=`${node.x/1491*100}%`;
    button.style.top=`${node.y/1055*100}%`;
    button.addEventListener('click', () => choose(char));
  });

  function renderAnswer() {
    const typed = session.typed;
    const target = session.word || '';
    const length = Math.max(target.length, typed.length);
    const fragment = document.createDocumentFragment();
    for (let i=0; i<length; i++) {
      const slot = document.createElement('span');
      const entered = i<typed.length;
      const isSpace = (entered ? typed[i] : target[i]) === ' ';
      slot.className = 'answer-slot';
      slot.classList.toggle('is-empty', !entered);
      slot.classList.toggle('is-wrong', entered && i>=session.prefixLength);
      slot.classList.toggle('is-space', isSpace);
      slot.textContent = entered ? (typed[i] === ' ' ? '␣' : typed[i]) : (isSpace ? '␣' : '·');
      slot.setAttribute('aria-hidden','true');
      fragment.append(slot);
    }
    $('answerSlots').replaceChildren(fragment);
    $('answerSlots').classList.toggle('is-long', length>16);
    $('answerSlots').classList.toggle('is-complete', session.solved);
    $('answerSlots').dataset.value = typed;
    $('answerSlots').setAttribute('aria-label', t('answerAria',{word:typed || t('emptyAnswer')}));
  }
  function renderThreads(animateLast = false) {
    const group = $('threads');
    group.replaceChildren();
    const segments = buildWebSegments(session.webTrails, session.letters);
    if (drawnTrailSession !== session || drawnTrailIndex !== session.index) {
      const fragment=document.createDocumentFragment();
      for (const {d,wordIndex,occurrence} of segments.filter(segment=>segment.archived)) {
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        path.setAttribute('class','thread-archived');
        path.dataset.word=String(wordIndex);
        path.dataset.visit=String(occurrence);
        fragment.append(path);
      }
      $('archivedThreads').replaceChildren(fragment);
      drawnTrailSession=session; drawnTrailIndex=session.index;
    }
    for (const {step:i,d,occurrence} of segments.filter(segment=>!segment.archived)) {
      const latest=i===session.letters.length-1;
      const wrong=i>=session.prefixLength;
      for (const outline of [true,false]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        path.setAttribute('data-step',String(i));
        path.setAttribute('data-visit',String(occurrence));
        path.setAttribute('class', outline ? 'thread-outline' : `thread-stroke${wrong?' is-wrong':''}${latest?' is-latest':''}`);
        group.append(path);
        if (animateLast && latest && !reducedMotion.matches) {
          const length = path.getTotalLength();
          animate(path,[{strokeDasharray:`${length}`,strokeDashoffset:length},{strokeDasharray:`${length}`,strokeDashoffset:0}],{duration:420,easing:'ease-out'});
          if (!outline) traceThreadTip(path,wrong);
        }
      }
    }
  }
  function traceThreadTip(path,wrong) {
    const marker=document.createElementNS('http://www.w3.org/2000/svg','circle');
    marker.setAttribute('r','8');
    marker.setAttribute('fill',wrong ? '#c95148':'#b77926');
    marker.setAttribute('stroke','#fffbea');
    marker.setAttribute('stroke-width','3');
    marker.setAttribute('class','thread-tip');
    const length=path.getTotalLength();
    const token=epoch, started=performance.now();
    $('threads').append(marker);
    function frame(now) {
      if (token!==epoch || !marker.isConnected) return;
      const progress=Math.min(1,(now-started)/420);
      const point=path.getPointAtLength(length*progress);
      marker.setAttribute('cx',String(point.x));
      marker.setAttribute('cy',String(point.y));
      if (progress<1) requestAnimationFrame(frame);
      else marker.remove();
    }
    frame(started);
  }
  function renderControls() {
    const accepting = phase === 'ready';
    const last = session.letters[session.letters.length-1]?.toLowerCase();
    const used = session.letters.map(letter=>letter.toLowerCase());
    nodeButtons.forEach((button,letter) => {
      button.disabled = !accepting;
      button.classList.toggle('is-used',used.includes(letter));
      button.classList.toggle('is-last',letter===last);
      button.classList.toggle('is-wrong',letter===last && !session.correctPrefix);
    });
    specialButtons.forEach((button,char) => {
      button.disabled=!accepting;
      button.classList.toggle('is-last',last===char);
      button.classList.toggle('is-wrong',last===char && !session.correctPrefix);
    });
    $('capitalButton').disabled=!accepting;
    $('capitalButton').setAttribute('aria-pressed',String(session.capitalNext));
    $('undoButton').disabled = session.letters.length === 0;
    $('nextLabel').textContent = t(session.index === session.words.length-1 ? 'finish' : 'next');
    $('nextButton').classList.toggle('is-celebrating',session.solved);
    $('roundCounter').textContent = t('round',{n:session.index+1,total:session.words.length});
    $('caughtCounter').textContent = t('caught',{n:session.caught.size});
  }
  function render(animateLast=false) { renderAnswer(); renderThreads(animateLast); renderControls(); }
  function fitFlyText() {
    if (currentScreen!=='game') return;
    const label = $('flyWord');
    const scale = $('board').getBoundingClientRect().width/1491;
    let size = Math.min(86,150*scale);
    label.style.fontSize = `${size}px`;
    while ((label.scrollWidth>label.clientWidth+1 || label.scrollHeight>label.clientHeight+1) && size>6) {
      size-=.5;
      label.style.fontSize = `${size}px`;
    }
  }
  function fitBoard() {
    if (currentScreen!=='game') return;
    const rect = $('stage').getBoundingClientRect();
    const topReserve = window.innerWidth>1000 ? Math.max(0,$('answerArea').getBoundingClientRect().bottom-rect.top+12) : 0;
    $('stage').style.paddingTop=`${topReserve}px`;
    const width = Math.max(0, Math.min(rect.width, (rect.height-topReserve-4)*1491/1055, 1680));
    if (width<1) return;
    $('board').style.width = `${Math.floor(width)}px`;
    $('board').style.setProperty('--board-scale',String(width/1491));
    fitFlyText();
    renderForestThreads();
  }
  function renderForestThreads() {
    if (currentScreen!=='game') return;
    const rect=$('board').getBoundingClientRect();
    const width=window.innerWidth, height=window.innerHeight;
    const scale=rect.width/1491;
    const point=letter => { const node=NODE_MAP.get(letter); return {x:rect.left+node.x*scale,y:rect.top+node.y*scale}; };
    const paths=[];
    const treeX=side => width*(side==='left'?65/1672:1610/1672);
    for (const [letter,side,offset] of [[NODES[22].letter,'left',-80],[NODES[19].letter,'left',0],[NODES[17].letter,'left',-55],[NODES[4].letter,'right',-65],[NODES[7].letter,'right',0],[NODES[9].letter,'right',35]]) {
      const end=point(letter), x=treeX(side);
      const y=Math.max(80,Math.min(height-70,end.y+offset));
      paths.push(`M ${x} ${y} Q ${(x+end.x)/2} ${(y+end.y)/2+18*scale}, ${end.x} ${end.y}`);
    }
    // The spider sprite has no baked-in thread. Draw one up to the window edge.
    const spiderX=rect.left+155*scale;
    paths.push(`M ${spiderX} 0 L ${spiderX} ${rect.top+40*scale}`);
    $('forestThreads').setAttribute('viewBox',`0 0 ${width} ${height}`);
    const group=$('forestThreadPaths');
    group.replaceChildren();
    for (const d of paths) {
      for (const outline of [true,false]) {
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        path.setAttribute('class',outline?'anchor-outline':'anchor-strand');
        group.append(path);
      }
    }
  }
  if (window.ResizeObserver) { const observer=new ResizeObserver(fitBoard); observer.observe($('stage')); observer.observe($('answerArea')); }
  window.addEventListener('resize',fitBoard);

  function playTone(type) {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      const tones = type==='win' ? [[523,0],[659,.12],[784,.24]] : type==='bad' ? [[190,0]] : [[540,0]];
      tones.forEach(([frequency,delay]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type='sine'; oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(0,now+delay);
        gain.gain.linearRampToValueAtTime(.055,now+delay+.02);
        gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.15);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.start(now+delay); oscillator.stop(now+delay+.17);
      });
    } catch (_) { /* Audio is optional and never blocks play. */ }
  }

  function newRound(withEntrance=true) {
    cancelRoundWork();
    if (session.finished) { showFinish(); return; }
    $('flyPosition').hidden=false;
    $('flyImage').src=FLY_IMAGES[session.index%FLY_IMAGES.length];
    $('flyWord').textContent=session.word;
    $('flyPosition').setAttribute('aria-label',t('flyTarget',{word:session.word}));
    flyX=790+(session.index%3-1)*42;
    flyY=(session.word.length>8 ? 405:370)+(session.index%2)*8;
    const flyWidth=Math.min(760,550+Math.max(0,session.word.length-5)*13);
    $('flyPosition').style.left=`${flyX/1491*100}%`;
    $('flyPosition').style.top=`${flyY/1055*100}%`;
    $('flyPosition').style.width=`${flyWidth/1491*100}%`;
    setPhase(withEntrance ? 'entering':'ready');
    setStatus(withEntrance ? 'entering':'ready');
    render(); fitBoard();
    if (withEntrance) {
      const distance=$('board').getBoundingClientRect().width*.93;
      animate($('flyMotion'),[
        {transform:`translate(${distance}px,-70px) rotate(-12deg) scale(.8)`,opacity:0},
        {transform:`translate(${distance*.24}px,24px) rotate(7deg) scale(1)`,opacity:1,offset:.7},
        {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1}
      ],{duration:950,easing:'cubic-bezier(.2,.65,.3,1)',fill:'none'});
      later(() => { setPhase('ready'); setStatus('ready'); renderControls(); },970);
    }
  }
  function shakeFly() {
    if (shakeAnimation) shakeAnimation.cancel();
    shakeAnimation=animate($('flySprite'),[
      {transform:'translateX(0) rotate(0deg)'},
      {transform:'translateX(-10px) rotate(-6deg)'},
      {transform:'translateX(10px) rotate(5deg)'},
      {transform:'translateX(-8px) rotate(-4deg)'},
      {transform:'translateX(7px) rotate(4deg)'},
      {transform:'translateX(0) rotate(0deg)'}
    ],{duration:480,easing:'ease-in-out'});
  }
  function feedFly() {
    setPhase('feeding'); setStatus('feeding'); renderControls(); playTone('win');
    const scale=$('board').getBoundingClientRect().width/1491;
    const dx=(164-flyX)*scale,dy=(137-flyY)*scale;
    animate($('flyMotion'),[
      {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1},
      {transform:`translate(${dx*.5}px,${dy*.8-20}px) rotate(-12deg) scale(.65)`,opacity:1,offset:.55},
      {transform:`translate(${dx}px,${dy}px) rotate(-25deg) scale(.08)`,opacity:0}
    ],{duration:1000,easing:'ease-in-out',fill:'forwards'});
    later(() => {
      $('flyPosition').hidden=true;
      $('spiderBubble').hidden=false;
      $('winSparkle').hidden=false;
      animate($('spiderActor'),[{transform:'rotate(0deg)'},{transform:'rotate(-7deg) scale(1.06)'},{transform:'rotate(6deg) scale(1.06)'},{transform:'rotate(0deg) scale(1)'}],{duration:540,easing:'ease-in-out'});
      setPhase('solved'); setStatus('solved'); renderControls();
    },1020);
  }
  function choose(letter) {
    if (currentScreen!=='game' || phase!=='ready' || !session) return;
    const result=session.add(letter);
    if (!result.accepted) return;
    render(true);
    if (result.solved) feedFly();
    else if (!result.correct) { setStatus('mistake'); shakeFly(); playTone('bad'); }
    else { setStatus('working'); playTone('letter'); }
  }
  function undo() {
    if (currentScreen!=='game' || !session || !session.letters.length) return;
    cancelRoundWork();
    session.undo();
    $('flyPosition').hidden=false;
    setPhase('ready'); render();
    setStatus(!session.correctPrefix ? 'mistake' : session.letters.length ? 'working':'ready');
    fitFlyText();
  }
  function resetWord() {
    if (currentScreen!=='game' || !session) return;
    session.resetWord();
    newRound(false);
    setStatus('resetMessage');
  }
  function nextWord() {
    if (currentScreen!=='game' || !session) return;
    session.next();
    newRound();
  }
  function startGame(event) {
    event?.preventDefault();
    const parsed=updateInput();
    if (!parsed.valid || !assetsReady || assetFailed) { $('wordsInput').focus(); return; }
    saveSettings();
    session=new Session($('shuffleInput').checked ? shuffled(parsed.words) : parsed.words);
    setScreen('game');
    newRound();
    $('gameStatus').tabIndex=-1;
    $('gameStatus').focus({preventScroll:true});
  }
  function showSetup() {
    cancelRoundWork(); setScreen('setup'); updateInput();
    $('wordsInput').focus({preventScroll:true});
  }
  function renderFinish() {
    $('finishSummary').textContent=t('finishSummary',{n:session.caught.size,total:session.words.length});
    $('finishMessage').textContent=t(session.caught.size===session.words.length ? 'finishAll':'finishSome');
  }
  function showFinish() {
    cancelRoundWork();
    const fragment=document.createDocumentFragment();
    for (const {d} of buildWebSegments(session.webTrails)) {
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',d); path.setAttribute('class','thread-archived'); fragment.append(path);
    }
    $('finishWebThreads').replaceChildren(fragment);
    setScreen('finish'); renderFinish();
    $('finishTitle').tabIndex=-1; $('finishTitle').focus({preventScroll:true});
  }

  $('setupForm').addEventListener('submit',startGame);
  $('wordsInput').addEventListener('input',updateInput);
  $('demoButton').addEventListener('click',() => { $('wordsInput').value=DEFAULT_WORDS; updateInput(); $('wordsInput').focus(); });
  $('shuffleInput').addEventListener('change',saveSettings);
  $('capitalButton').addEventListener('click',() => {
    if (currentScreen!=='game' || phase!=='ready' || !session) return;
    session.toggleCapital(); renderControls();
    setStatus(session.capitalNext ? 'capitalOn' : !session.correctPrefix ? 'mistake' : session.letters.length ? 'working' : 'ready');
  });
  $('undoButton').addEventListener('click',undo);
  $('resetButton').addEventListener('click',resetWord);
  $('nextButton').addEventListener('click',nextWord);
  $('editWords').addEventListener('click',showSetup);
  $('changeWordsButton').addEventListener('click',showSetup);
  $('brandHome').addEventListener('click',event => { event.preventDefault(); showSetup(); });
  $('replayButton').addEventListener('click',startGame);
  $('soundButton').addEventListener('click',() => { soundEnabled=!soundEnabled; updateSoundButton(); saveSettings(); if (soundEnabled) playTone('letter'); });
  $('fullscreenButton').addEventListener('click',async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch (_) { if (currentScreen==='game') setStatus('fullscreenUnavailable'); }
  });
  document.addEventListener('fullscreenchange',() => { updateFullscreenButton(); requestAnimationFrame(fitBoard); });
  document.addEventListener('keydown',event => {
    if (currentScreen!=='game' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    const letterKey=/^[a-zA-Z]$/.test(event.key);
    if (!letterKey && ![' ','.',',','-',"'",'’','‘','ʼ','Backspace'].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.key==='Backspace') undo();
    else choose(event.key);
  });

  setScreen('setup'); updateTranslation();
  Promise.all(ASSETS.map(src => new Promise((resolve,reject) => {
    const image=new Image(); image.onload=resolve; image.onerror=reject; image.src=src;
  }))).then(() => { assetsReady=true; updateInput(); },() => { assetFailed=true; updateInput(); });
})();
