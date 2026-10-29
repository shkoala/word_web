/* Deterministic artwork: every visible letter uses the game's own coordinates. */
const fs = require('node:fs');
const path = require('node:path');
const siteRoot=fs.existsSync(path.join(__dirname,'../dist/core.js')) ? path.join(__dirname,'../dist') : path.join(__dirname,'..');
const {NODES} = require(path.join(siteRoot,'core.js'));
const points = NODES.map(({x,y}) => ({x,y}));
let rope = `M ${points[0].x} ${points[0].y}`;
for (let i=0; i<points.length; i++) {
  const a=points[i], b=points[(i+1)%points.length];
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const length=Math.hypot(770-mx,535-my);
  rope+=` Q ${+(mx+(770-mx)/length*42).toFixed(2)} ${+(my+(535-my)/length*42).toFixed(2)}, ${b.x} ${b.y}`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1491 1055" width="1491" height="1055" role="img" aria-labelledby="title">
<title id="title">Word Web: 26 big English letters</title>
<defs>
  <linearGradient id="rope" x2="0" y2="1"><stop stop-color="#ffe27c"/><stop offset=".35" stop-color="#e5a02c"/><stop offset=".7" stop-color="#b66519"/><stop offset="1" stop-color="#edb547"/></linearGradient>
  <radialGradient id="dot" cx=".3" cy=".25" r=".8"><stop stop-color="#e0a14c"/><stop offset=".35" stop-color="#9c4a18"/><stop offset="1" stop-color="#542209"/></radialGradient>
</defs>
<path d="${rope}" fill="none" stroke="#7c3b13" stroke-width="14" stroke-linejoin="round"/>
<path d="${rope}" fill="none" stroke="url(#rope)" stroke-width="9" stroke-linejoin="round"/>
<path d="${rope}" fill="none" stroke="#ffe9a3" stroke-width="2" stroke-linejoin="round" opacity=".8"/>
${NODES.map(n=>`<g data-letter="${n.letter}"><circle cx="${n.x}" cy="${n.y}" r="18" fill="url(#dot)" stroke="#fff2c4" stroke-width="3"/><circle cx="${n.x-5}" cy="${n.y-6}" r="4" fill="#fff2c4" opacity=".55"/><text x="${n.labelX}" y="${n.labelY}" text-anchor="middle" dominant-baseline="central" font-family="Comic Sans MS,Trebuchet MS,Arial,sans-serif" font-size="112" font-weight="900" fill="#18241e" stroke="#fffdf3" stroke-width="8" paint-order="stroke">${n.letter}</text></g>`).join('\n')}
</svg>\n`;
fs.writeFileSync(path.join(siteRoot,'assets/web-v3.svg'),svg);
console.log('Built web-v3.svg with 26 matching letter nodes.');
