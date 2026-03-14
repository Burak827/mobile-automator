import"./modulepreload-polyfill-B5Qt9EMX.js";const h=1400,v=900,M=72,F="#7dd3fc",z=40,q=200,c=document.getElementById("closed-bezier-curve-app");if(!c)throw new Error("closed bezier curve root bulunamadi.");function u(e,t){if(!e)throw new Error(t);return e}c.innerHTML=`
  <div class="curve-shell">
    <section class="curve-stage">
      <svg class="curve-svg" viewBox="0 0 ${h} ${v}" xmlns="http://www.w3.org/2000/svg" aria-label="Closed bezier editor"></svg>
      <div class="curve-overlay">
        <h1>Closed Bezier Curve</h1>
        <p>Boşluğa tıkla: yeni nokta. Noktaya tıkla: seç. Handle sürükle: yön değiştir.</p>
      </div>
    </section>
    <aside class="curve-panel">
      <section class="curve-card">
        <h2>Actions</h2>
        <div class="curve-actions">
          <button class="curve-button curve-button--primary" type="button" data-action="export-svg">Export SVG</button>
          <button class="curve-button curve-button--ghost" type="button" data-action="delete-selected">Delete Selected</button>
          <button class="curve-button curve-button--danger" type="button" data-action="clear-points">Delete All</button>
        </div>
      </section>

      <section class="curve-card">
        <h2>Selected Point</h2>
        <div class="curve-grid">
          <div class="curve-field">
            <label for="anchorX">Anchor X</label>
            <input id="anchorX" name="anchorX" type="number" step="1" />
          </div>
          <div class="curve-field">
            <label for="anchorY">Anchor Y</label>
            <input id="anchorY" name="anchorY" type="number" step="1" />
          </div>
          <div class="curve-field">
            <label for="inAngle">In Angle</label>
            <input id="inAngle" name="inAngle" type="number" step="0.1" />
          </div>
          <div class="curve-field">
            <label for="inLength">In Length</label>
            <input id="inLength" name="inLength" type="number" step="0.1" min="0" />
          </div>
          <div class="curve-field">
            <label for="outAngle">Out Angle</label>
            <input id="outAngle" name="outAngle" type="number" step="0.1" />
          </div>
          <div class="curve-field">
            <label for="outLength">Out Length</label>
            <input id="outLength" name="outLength" type="number" step="0.1" min="0" />
          </div>
          <div class="curve-field curve-field--full">
            <div class="curve-toggle-row">
              <input id="linkedHandles" name="linkedHandles" type="checkbox" />
              <label for="linkedHandles">Linked Handles</label>
            </div>
          </div>
        </div>
      </section>

      <section class="curve-card">
        <h2>Readout</h2>
        <pre class="curve-readout"></pre>
      </section>
    </aside>
  </div>
`;const s=u(c.querySelector(".curve-svg"),"closed bezier curve svg kurulamadı."),C=u(c.querySelector(".curve-readout"),"closed bezier curve readout kurulamadı."),N=u(c.querySelector('[data-action="export-svg"]'),"closed bezier curve export button kurulamadı."),R=u(c.querySelector('[data-action="delete-selected"]'),"closed bezier curve delete selected button kurulamadı."),T=u(c.querySelector('[data-action="clear-points"]'),"closed bezier curve clear points button kurulamadı."),k=u(c.querySelector("#anchorX"),"closed bezier curve anchorX input kurulamadı."),$=u(c.querySelector("#anchorY"),"closed bezier curve anchorY input kurulamadı."),y=u(c.querySelector("#inAngle"),"closed bezier curve inAngle input kurulamadı."),m=u(c.querySelector("#inLength"),"closed bezier curve inLength input kurulamadı."),L=u(c.querySelector("#outAngle"),"closed bezier curve outAngle input kurulamadı."),A=u(c.querySelector("#outLength"),"closed bezier curve outLength input kurulamadı."),f=u(c.querySelector("#linkedHandles"),"closed bezier curve linkedHandles input kurulamadı."),i={points:[],selectedPointId:null,dragState:null};function D(e,t){const r=i.points.length+1;return{id:`point-${Date.now()}-${r}`,x:e,y:t,inAngle:180,inLength:M,outAngle:0,outLength:M,linked:!0}}function I(e,t){return Math.max(0,Math.min(t,e))}function O(e){return e*Math.PI/180}function g(e){if(!Number.isFinite(e))return 0;const t=e%360;return t<0?t+360:t}function S(e,t){const r=t==="in"?e.inAngle:e.outAngle,o=t==="in"?e.inLength:e.outLength,n=O(r);return{x:e.x+Math.cos(n)*o,y:e.y+Math.sin(n)*o}}function P(e){if(e.length===0)return"";if(e.length===1)return`M ${e[0].x} ${e[0].y}`;const t=e[0];let r=`M ${t.x} ${t.y}`;for(let o=0;o<e.length;o+=1){const n=e[o],l=e[(o+1)%e.length],a=S(n,"out"),d=S(l,"in");r+=` C ${a.x} ${a.y}, ${d.x} ${d.y}, ${l.x} ${l.y}`}return r+=" Z",r}function w(){return i.points.find(e=>e.id===i.selectedPointId)??null}function X(){const e=w(),t=!e;for(const r of[k,$,y,m,L,A,f])r.disabled=t;if(R.disabled=t,!e){k.value="",$.value="",y.value="",m.value="",L.value="",A.value="",f.checked=!1;return}k.value=`${Math.round(e.x)}`,$.value=`${Math.round(e.y)}`,y.value=`${Number(e.inAngle.toFixed(2))}`,m.value=`${Number(e.inLength.toFixed(2))}`,L.value=`${Number(e.outAngle.toFixed(2))}`,A.value=`${Number(e.outLength.toFixed(2))}`,f.checked=e.linked}function j(){const e=w(),t=P(i.points);C.textContent=[`points: ${i.points.length}`,`selected: ${e?.id??"none"}`,e?`anchor=(${e.x.toFixed(1)}, ${e.y.toFixed(1)}) in=${e.inAngle.toFixed(1)}deg/${e.inLength.toFixed(1)} out=${e.outAngle.toFixed(1)}deg/${e.outLength.toFixed(1)}`:"anchor: none",`path: ${t||"empty"}`].join(`
`)}function Y(){const e=[];for(let t=0;t<=h;t+=z){const r=t%q===0;e.push(`<line x1="${t}" y1="0" x2="${t}" y2="${v}" stroke="${r?"rgba(125,211,252,0.12)":"rgba(255,255,255,0.05)"}" stroke-width="1" />`)}for(let t=0;t<=v;t+=z){const r=t%q===0;e.push(`<line x1="0" y1="${t}" x2="${h}" y2="${t}" stroke="${r?"rgba(125,211,252,0.12)":"rgba(255,255,255,0.05)"}" stroke-width="1" />`)}return e.join("")}function b(){const e=w(),t=P(i.points),r=e?(()=>{const n=S(e,"in"),l=S(e,"out");return`
          <g>
            <line x1="${e.x}" y1="${e.y}" x2="${n.x}" y2="${n.y}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 6" />
            <line x1="${e.x}" y1="${e.y}" x2="${l.x}" y2="${l.y}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 6" />
            <circle cx="${n.x}" cy="${n.y}" r="8" fill="#f59e0b" stroke="#fff" stroke-width="2" data-role="in-handle" data-point-id="${e.id}" />
            <circle cx="${l.x}" cy="${l.y}" r="8" fill="#38bdf8" stroke="#fff" stroke-width="2" data-role="out-handle" data-point-id="${e.id}" />
          </g>
        `})():"",o=i.points.map((n,l)=>{const a=n.id===i.selectedPointId;return`
        <g>
          <circle cx="${n.x}" cy="${n.y}" r="12" fill="${a?"#eef2f6":"#111827"}" stroke="${a?"#38bdf8":"#7dd3fc"}" stroke-width="3" data-role="anchor" data-point-id="${n.id}" />
          <text x="${n.x}" y="${n.y-18}" fill="#eef2f6" font-size="18" font-weight="700" text-anchor="middle">${l+1}</text>
        </g>
      `}).join("");s.innerHTML=`
    <rect x="0" y="0" width="${h}" height="${v}" fill="#0a0e13" data-role="background" />
    <g pointer-events="none">${Y()}</g>
    ${t?`<path d="${t}" fill="rgba(125, 211, 252, 0.12)" stroke="${F}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`:""}
    ${r}
    ${o}
  `,X(),j()}function B(e){const t=s.getBoundingClientRect(),r=(e.clientX-t.left)/t.width*h,o=(e.clientY-t.top)/t.height*v;return{x:I(r,h),y:I(o,v)}}function x(e,t){i.points=i.points.map(r=>r.id===e?t(r):r),b()}function _(e){const t=e.target,r=t.getAttribute("data-role"),o=t.getAttribute("data-point-id");if(r==="anchor"&&o){i.selectedPointId=o,i.dragState={pointerId:e.pointerId,pointId:o,kind:"anchor"},s.setPointerCapture(e.pointerId),b();return}if((r==="in-handle"||r==="out-handle")&&o){i.selectedPointId=o,i.dragState={pointerId:e.pointerId,pointId:o,kind:r==="in-handle"?"in-handle":"out-handle"},s.setPointerCapture(e.pointerId),b();return}const n=B(e),l=D(n.x,n.y);i.points=[...i.points,l],i.selectedPointId=l.id,b()}function G(e){if(!i.dragState||i.dragState.pointerId!==e.pointerId)return;const t=i.points.find(d=>d.id===i.dragState?.pointId);if(!t)return;const r=B(e);if(i.dragState.kind==="anchor"){x(t.id,d=>({...d,x:r.x,y:r.y}));return}const o=r.x-t.x,n=r.y-t.y,l=g(Math.atan2(n,o)*180/Math.PI),a=Math.sqrt(o*o+n*n);if(i.dragState.kind==="in-handle"){x(t.id,d=>({...d,inAngle:l,inLength:a,outAngle:d.linked?g(l+180):d.outAngle,outLength:d.linked?a:d.outLength}));return}x(t.id,d=>({...d,outAngle:l,outLength:a,inAngle:d.linked?g(l+180):d.inAngle,inLength:d.linked?a:d.inLength}))}function E(e){!i.dragState||i.dragState.pointerId!==e||(i.dragState=null,s.hasPointerCapture(e)&&s.releasePointerCapture(e))}function H(){return w()}function p(e,t){e.addEventListener("input",()=>{const r=H();if(!r)return;const o=Number(e.value);Number.isFinite(o)&&x(r.id,n=>{if(t==="x")return{...n,x:I(o,h)};if(t==="y")return{...n,y:I(o,v)};if(t==="inAngle")return{...n,inAngle:g(o),outAngle:n.linked?g(o+180):n.outAngle};if(t==="outAngle")return{...n,outAngle:g(o),inAngle:n.linked?g(o+180):n.inAngle};if(t==="inLength"){const a=Math.max(0,o);return{...n,inLength:a,outLength:n.linked?a:n.outLength}}const l=Math.max(0,o);return{...n,outLength:l,inLength:n.linked?l:n.inLength}})})}function U(){const e=P(i.points),t=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${h} ${v}" fill="none">
  <path d="${e}" fill="none" stroke="${F}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,r=new Blob([t],{type:"image/svg+xml;charset=utf-8"}),o=URL.createObjectURL(r),n=document.createElement("a");n.href=o,n.download="closed-bezier-curve.svg",n.click(),URL.revokeObjectURL(o)}s.addEventListener("pointerdown",_);s.addEventListener("pointermove",G);s.addEventListener("pointerup",e=>E(e.pointerId));s.addEventListener("pointercancel",e=>E(e.pointerId));s.addEventListener("pointerleave",e=>E(e.pointerId));p(k,"x");p($,"y");p(y,"inAngle");p(m,"inLength");p(L,"outAngle");p(A,"outLength");f.addEventListener("change",()=>{const e=H();e&&x(e.id,t=>({...t,linked:f.checked,outAngle:f.checked?g(t.inAngle+180):t.outAngle,outLength:f.checked?t.inLength:t.outLength}))});N.addEventListener("click",U);R.addEventListener("click",()=>{const e=H();e&&(i.points=i.points.filter(t=>t.id!==e.id),i.selectedPointId=i.points[0]?.id??null,b())});T.addEventListener("click",()=>{i.points=[],i.selectedPointId=null,b()});b();
