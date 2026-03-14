import"./modulepreload-polyfill-B5Qt9EMX.js";import{W as $,S as I,E as Q,F as tt,p as et,G as st,H as at,P as ot,O as nt,q as it,M as rt,I as ct,J as lt,K as dt,L as ut,N as pt,V as L,s as mt,R as ft,Q as ht,T as y,u as S,U as g,o as T,X as bt,Y as gt,Z as vt,f as Mt,j as yt,k as St,t as wt,l as Ct,m as xt,c as At,d as Et}from"./proceduralDeviceThree-nQ9G2JVj.js";const Z={widthMm:g.widthMm,lengthMm:g.lengthMm,edgeSmoothnessMm:g.edgeSmoothnessMm,thicknessMm:g.thicknessMm,positionX:S.x,positionY:S.y,positionZ:S.z,rotationX:y.rotateX,rotationY:y.rotateY,rotationZ:y.rotateZ},c=document.getElementById("sstest-app");if(!c)throw new Error("sstest root bulunamadı.");c.innerHTML=`
  <div class="sstest-shell">
    <section class="sstest-stage">
      <canvas class="sstest-canvas"></canvas>
      <div class="sstest-overlay">
        <h1>SS Test Scene</h1>
        <p>Independent Three.js procedural slab scene. Units are millimeters.</p>
      </div>
    </section>
    <aside class="sstest-panel">
      <section class="sstest-card">
        <h2>Shape</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="widthMm">Width (mm)</label>
            <input id="widthMm" name="widthMm" type="number" step="0.1" value="71.9" />
          </div>
          <div class="sstest-field">
            <label for="lengthMm">Length (mm)</label>
            <input id="lengthMm" name="lengthMm" type="number" step="0.1" value="150" />
          </div>
          <div class="sstest-field sstest-field--full">
            <label for="edgeSmoothnessMm">Edge Smoothness (mm)</label>
            <input id="edgeSmoothnessMm" name="edgeSmoothnessMm" type="number" step="1" value="9" />
          </div>
          <div class="sstest-field sstest-field--full">
            <label for="thicknessMm">Thickness (mm)</label>
            <input id="thicknessMm" name="thicknessMm" type="number" step="0.01" value="8.75" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Location</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="positionX">X</label>
            <input id="positionX" name="positionX" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="positionY">Y</label>
            <input id="positionY" name="positionY" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="positionZ">Z</label>
            <input id="positionZ" name="positionZ" type="number" step="1" value="0" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Rotation</h2>
        <div class="sstest-grid">
          <div class="sstest-field">
            <label for="rotationX">X</label>
            <input id="rotationX" name="rotationX" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="rotationY">Y</label>
            <input id="rotationY" name="rotationY" type="number" step="1" value="0" />
          </div>
          <div class="sstest-field">
            <label for="rotationZ">Z</label>
            <input id="rotationZ" name="rotationZ" type="number" step="1" value="0" />
          </div>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Display</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-display-mode="solid">Solid</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-display-mode="wireframe">Wireframe</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Camera</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-camera-mode="perspective">Perspective</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-camera-mode="orthographic">Orthographic</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Axes</h2>
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--ghost" type="button" data-axes-mode="on">On</button>
          <button class="sstest-button sstest-button--ghost" type="button" data-axes-mode="off">Off</button>
        </div>
      </section>

      <section class="sstest-card">
        <div class="sstest-actions">
          <button class="sstest-button sstest-button--primary" type="button" data-action="reset">Reset</button>
        </div>
      </section>

      <section class="sstest-card">
        <h2>Readout</h2>
        <pre class="sstest-readout"></pre>
      </section>
    </aside>
  </div>
`;const k=c.querySelector(".sstest-canvas"),P=c.querySelector(".sstest-readout"),F=c.querySelector('[data-action="reset"]'),_=c.querySelector(".sstest-stage"),U=Array.from(c.querySelectorAll("[data-display-mode]")),G=Array.from(c.querySelectorAll("[data-camera-mode]")),q=Array.from(c.querySelectorAll("[data-axes-mode]")),Lt=new Map(Array.from(c.querySelectorAll("input[name]")).map(t=>[t.name,t]));if(!k||!P||!F||!_)throw new Error("sstest DOM kurulamadı.");const n=k,Pt=P,w=_,l=new $({canvas:n,antialias:!0,alpha:!0});l.setPixelRatio(Math.min(window.devicePixelRatio,2));l.outputColorSpace=I;l.toneMapping=Q;l.toneMappingExposure=1.1;l.shadowMap.enabled=!0;l.shadowMap.type=tt;const d=new et;d.background=new st("#0f1115");d.fog=new at("#0f1115",600,1800);const B=new ot(34,1,.1,5e3),N=new nt(-240,240,240,-240,.1,5e3);it(d);const x=new rt(new ct(2200,2200),new lt({color:"#000000",opacity:.22}));x.rotation.x=-Math.PI/2;x.position.y=-140;x.receiveShadow=!0;d.add(x);const V=new dt(1200,24,"#2b3645","#1c2430");V.position.y=-139;d.add(V);const h=new ut,Rt=new pt(180);h.add(Rt);h.add(Y("X","#ff6b6b",new L(208,0,0)));h.add(Y("Y","#8ce99a",new L(0,208,0)));h.add(Y("Z","#74c0fc",new L(0,0,208)));d.add(h);const u=mt({shape:g,rotation:y,location:S,profile:{bodyColor:"#3c4148"},includeScreen:!1});d.add(u);const s={...Z};let p="solid",m=T,f="off",O="";const C=new ft,D=new ht;let i;const W=Array.from(c.querySelectorAll("input[name]"));function R(){return xt(m,B,N)}function z(){const t=Math.max(320,Math.floor(w.clientWidth)),e=Math.max(320,Math.floor(w.clientHeight));l.setSize(t,e,!1),At(B,t,e),Et(N,t,e,460),X()}function j(t){const e=n.getBoundingClientRect();return D.set((t.clientX-e.left)/e.width*2-1,-((t.clientY-e.top)/e.height)*2+1),D}function b(){const t=Mt({widthMm:s.widthMm,lengthMm:s.lengthMm,thicknessMm:s.thicknessMm,edgeSmoothnessMm:s.edgeSmoothnessMm}),e=JSON.stringify(t);e!==O&&(yt(u,{shape:t,profile:{bodyColor:"#3c4148"},includeScreen:!1}),O=e),St(u,Ct({rotateX:s.rotationX,rotateY:s.rotationY,rotateZ:s.rotationZ}),wt({x:s.positionX,y:s.positionY,z:s.positionZ})),Dt(u,p==="wireframe"),h.visible=f==="on",Yt(),H(),Pt.textContent=JSON.stringify({...s,displayMode:p,cameraMode:m,axesMode:f},null,2),X()}function X(){l.render(d,R())}function H(){for(const t of U){const e=t.dataset.displayMode===p;t.classList.toggle("is-active",e),t.setAttribute("aria-pressed",String(e))}for(const t of G){const e=t.dataset.cameraMode===m;t.classList.toggle("is-active",e),t.setAttribute("aria-pressed",String(e))}for(const t of q){const e=t.dataset.axesMode===f;t.classList.toggle("is-active",e),t.setAttribute("aria-pressed",String(e))}}function Xt(t){const e=Number(t.value);return Number.isFinite(e)?e:0}function Yt(){for(const[t,e]of Lt){const r=t;e.value=Ot(r,s[r])}}function Ot(t,e){return t==="thicknessMm"?e.toFixed(2).replace(/\.?0+$/,""):t==="widthMm"||t==="lengthMm"?e.toFixed(1).replace(/\.?0+$/,""):t==="rotationX"||t==="rotationY"||t==="rotationZ"?e.toFixed(2).replace(/\.?0+$/,""):e.toFixed(2).replace(/\.?0+$/,"")}function E(t){const e=((t+180)%360+360)%360-180;return Object.is(e,-0)?0:e}function v(t){if(i){n.style.cursor="grabbing";return}if(!t){n.style.cursor="default";return}C.setFromCamera(j(t),R());const e=C.intersectObject(u,!0);n.style.cursor=e.length>0?"grab":"default"}for(const t of W)t.addEventListener("input",()=>{const e=t.name,r=Xt(t);s[e]=e==="widthMm"||e==="lengthMm"?Math.max(1,r):e==="edgeSmoothnessMm"||e==="thicknessMm"?Math.max(0,r):r,(e==="widthMm"||e==="lengthMm"||e==="edgeSmoothnessMm"||e==="thicknessMm")&&(t.value=String(s[e])),b()});n.addEventListener("pointerdown",t=>{if(C.setFromCamera(j(t),R()),C.intersectObject(u,!0).length===0){v(t);return}i={pointerId:t.pointerId,startClientX:t.clientX,startClientY:t.clientY,startRotationX:s.rotationX,startRotationY:s.rotationY,startRotationZ:s.rotationZ},n.setPointerCapture(t.pointerId),w.classList.add("is-dragging"),v()});n.addEventListener("pointermove",t=>{if(!i||i.pointerId!==t.pointerId){v(t);return}const e=t.clientX-i.startClientX,r=t.clientY-i.startClientY,o=.35;s.rotationX=E(i.startRotationX-r*o),s.rotationY=E(i.startRotationY),s.rotationZ=E(i.startRotationZ-e*o),b()});function J(t){t!==void 0&&i&&i.pointerId!==t||(i=void 0,w.classList.remove("is-dragging"),v())}n.addEventListener("pointerup",t=>{n.hasPointerCapture(t.pointerId)&&n.releasePointerCapture(t.pointerId),J(t.pointerId)});n.addEventListener("pointercancel",t=>{n.hasPointerCapture(t.pointerId)&&n.releasePointerCapture(t.pointerId),J(t.pointerId)});n.addEventListener("pointerleave",t=>{i||v(t)});for(const t of U)t.addEventListener("click",()=>{const e=t.dataset.displayMode;(e==="solid"||e==="wireframe")&&(p=e,b())});for(const t of G)t.addEventListener("click",()=>{const e=t.dataset.cameraMode;(e==="perspective"||e==="orthographic")&&(m=e,X(),H(),P.textContent=JSON.stringify({...s,displayMode:p,cameraMode:m,axesMode:f},null,2))});for(const t of q)t.addEventListener("click",()=>{const e=t.dataset.axesMode;(e==="on"||e==="off")&&(f=e,b())});F.addEventListener("click",()=>{Object.assign(s,Z),p="solid",m=T,f="off";for(const t of W){const e=t.name;t.value=String(s[e])}b()});window.addEventListener("resize",z);z();b();function Dt(t,e){t.traverse(r=>{const o=r;if(o.material){if(Array.isArray(o.material)){for(const a of o.material)"wireframe"in a&&(a.wireframe=e);return}"wireframe"in o.material&&(o.material.wireframe=e)}})}function Y(t,e,r){const o=document.createElement("canvas");o.width=128,o.height=128;const a=o.getContext("2d");if(!a)throw new Error("Axis label canvas context oluşturulamadı.");a.clearRect(0,0,o.width,o.height),a.fillStyle="rgba(10, 14, 20, 0.88)",a.beginPath(),a.arc(64,64,42,0,Math.PI*2),a.fill(),a.lineWidth=4,a.strokeStyle=e,a.stroke(),a.fillStyle=e,a.font="700 56px ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",a.textAlign="center",a.textBaseline="middle",a.fillText(t,64,68);const A=new bt(o);A.colorSpace=I,A.needsUpdate=!0;const K=new gt({map:A,transparent:!0,depthTest:!1,depthWrite:!1}),M=new vt(K);return M.position.copy(r),M.scale.set(32,32,1),M.renderOrder=100,M}
