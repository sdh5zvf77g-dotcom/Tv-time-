const $=id=>document.getElementById(id);
const v=$("v"),msg=$("msg"),list=$("list"),q=$("q"),cat=$("cat"),now=$("now");
const PAGE=300,TIMEOUT=15000,secure=location.protocol==="https:";
let chans=[],hls=null,cur=null,token=0,timer=null,shown=PAGE,rows=[],favs=[];
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set(k,x){try{localStorage.setItem(k,JSON.stringify(x))}catch(e){}}};
favs=store.get("favs",[]);

function parse(text){
  const out=[],lines=text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    if(!lines[i].startsWith("#EXTINF"))continue;
    let j=i+1;
    while(j<lines.length&&(!lines[j].trim()||lines[j].startsWith("#")))j++;
    const url=(lines[j]||"").trim();
    if(!/^https?:\/\//i.test(url)||(secure&&/^http:/i.test(url)))continue;
    const m=k=>(lines[i].match(new RegExp(k+'="([^"]*)"'))||[])[1]||"";
    const name=(lines[i].slice(lines[i].lastIndexOf(",")+1)||m("tvg-name")||"Channel").trim();
    out.push({name,url,logo:m("tvg-logo"),group:(m("group-title")||"Other").split(";")[0].trim()||"Other"});
  }
  return out;
}

async function getText(url){
  const key="pl:"+url;
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),30000);
    const r=await fetch(url,{signal:ctl.signal});clearTimeout(t);
    if(!r.ok)throw 0;
    const txt=await r.text();
    try{const c=await caches.open("freetv-lists");await c.put(key,new Response(txt))}catch(e){}
    return txt;
  }catch(e){
    try{const c=await caches.open("freetv-lists"),r=await c.match(key);if(r)return await r.text()}catch(_){}
    throw e;
  }
}

async function load(){
  let sources;
  try{sources=(await (await fetch("sources.json")).json()).sources}
  catch(e){sources=[{url:"https://iptv-org.github.io/iptv/index.country.m3u"}]}
  const res=await Promise.allSettled(sources.map(s=>getText(s.url)));
  const seen=new Set();
  res.forEach(r=>{if(r.status==="fulfilled")parse(r.value).forEach(c=>{if(!seen.has(c.url)){seen.add(c.url);chans.push(c)}})});
  if(!chans.length){msg.textContent="Couldn't load the channel list. Check your connection and reload.";return}
  chans.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"}));
  ["All","Favorites",...[...new Set(chans.map(c=>c.group))].sort()].forEach(g=>{const o=document.createElement("option");o.textContent=g;cat.appendChild(o)});
  const last=store.get("last",null);
  msg.textContent=last?"Tap a channel to start watching (last: "+last.name+")":"Pick a channel to start watching";
  filter();
}

function filter(){
  const term=q.value.trim().toLowerCase(),g=cat.value;
  rows=chans.filter(c=>(g==="All"||(g==="Favorites"?favs.includes(c.url):c.group===g))&&c.name.toLowerCase().includes(term));
  shown=PAGE;render();list.scrollTop=0;
}

function render(){
  list.textContent="";
  if(!rows.length){const d=document.createElement("div");d.className="empty";d.textContent="No channels match. Try another search or category.";list.appendChild(d);return}
  const frag=document.createDocumentFragment();
  rows.slice(0,shown).forEach(c=>{
    const li=document.createElement("li");li.dataset.url=c.url;li.tabIndex=0;
    if(cur&&cur.url===c.url)li.setAttribute("aria-current","true");
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";
    if(c.logo)img.src=c.logo;img.onerror=()=>{img.style.visibility="hidden"};
    const n=document.createElement("div");n.className="n";n.textContent=c.name;
    const s=document.createElement("small");s.textContent=c.group;n.appendChild(s);
    const f=document.createElement("button");const on=favs.includes(c.url);
    f.className="fav"+(on?" on":"");f.textContent=on?"★":"☆";f.setAttribute("aria-label",on?"Remove favorite":"Add favorite");
    f.onclick=e=>{e.stopPropagation();favs=favs.includes(c.url)?favs.filter(x=>x!==c.url):[...favs,c.url];store.set("favs",favs);
      if(cat.value==="Favorites"){const y=list.scrollTop;filter();list.scrollTop=y}else{f.classList.toggle("on");const o=f.classList.contains("on");f.textContent=o?"★":"☆";f.setAttribute("aria-label",o?"Remove favorite":"Add favorite")}};
    li.append(img,n,f);
    li.onclick=()=>play(c);
    li.onkeydown=e=>{if(e.key==="Enter")play(c)};
    frag.appendChild(li);
  });
  if(rows.length>shown){
    const b=document.createElement("button");b.className="more";b.textContent="Show more ("+(rows.length-shown)+" left)";
    b.onclick=()=>{shown+=PAGE;const y=list.scrollTop;render();list.scrollTop=y};
    frag.appendChild(b);
  }
  list.appendChild(frag);
}

function mark(){list.querySelectorAll("li").forEach(li=>{if(cur&&li.dataset.url===cur.url)li.setAttribute("aria-current","true");else li.removeAttribute("aria-current")})}

function stop(){
  clearTimeout(timer);
  if(hls){hls.destroy();hls=null}
  v.removeAttribute("src");v.load();
}

function play(c){
  const my=++token;cur=c;store.set("last",{name:c.name,url:c.url});
  now.textContent=c.name;msg.textContent="Loading "+c.name+"…";msg.style.display="flex";mark();
  stop();
  const fail=()=>{if(my!==token)return;clearTimeout(timer);msg.textContent=c.name+" isn't responding. Pick another channel.";msg.style.display="flex"};
  timer=setTimeout(fail,TIMEOUT);
  v.onerror=fail;
  if(v.canPlayType("application/vnd.apple.mpegurl")){      // iPhone/Safari: native HLS, no CORS limits
    v.src=c.url;
  }else if(window.Hls&&Hls.isSupported()){
    let recovered=false;
    hls=new Hls({maxBufferLength:20,lowLatencyMode:false});
    hls.on(Hls.Events.ERROR,(_,d)=>{
      if(my!==token||!d.fatal)return;
      if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&!recovered){recovered=true;hls.recoverMediaError()}
      else fail();
    });
    hls.loadSource(c.url);hls.attachMedia(v);
  }else return fail();
  const p=v.play();if(p&&p.catch)p.catch(()=>{});
  if("mediaSession" in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:c.name,artist:"Free TV",artwork:c.logo?[{src:c.logo}]:[]})}catch(e){}}
}

v.addEventListener("playing",()=>{clearTimeout(timer);msg.style.display="none"});
v.addEventListener("waiting",()=>{if(cur){msg.textContent="Buffering…";msg.style.display="flex"}});
let deb;q.oninput=()=>{clearTimeout(deb);deb=setTimeout(filter,200)};
cat.onchange=filter;
load();
