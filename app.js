const $=id=>document.getElementById(id);
const v=$("v"),msg=$("msg"),list=$("list"),q=$("q"),cat=$("cat"),now=$("now");
let chans=[],hls=null,cur=null,favs=[];
try{favs=JSON.parse(localStorage.getItem("favs")||"[]")}catch(e){}
const saveFavs=()=>{try{localStorage.setItem("favs",JSON.stringify(favs))}catch(e){}};
const secure=location.protocol==="https:";

function parse(text){
  const out=[],lines=text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    if(!lines[i].startsWith("#EXTINF"))continue;
    let j=i+1;
    while(j<lines.length&&(!lines[j].trim()||lines[j].startsWith("#")))j++;
    const url=(lines[j]||"").trim();
    if(!/^https?:\/\//.test(url))continue;
    if(secure&&url.startsWith("http:"))continue; // browsers block insecure streams on https pages
    const m=k=>(lines[i].match(new RegExp(k+'="([^"]*)"'))||[])[1]||"";
    out.push({name:lines[i].split(",").pop().trim(),url,logo:m("tvg-logo"),group:(m("group-title")||"Other").split(";")[0]});
  }
  return out;
}

async function load(){
  let sources;
  try{sources=(await (await fetch("sources.json")).json()).sources}catch(e){sources=[{url:"https://iptv-org.github.io/iptv/languages/eng.m3u"}]}
  const results=await Promise.allSettled(sources.map(s=>fetch(s.url).then(r=>{if(!r.ok)throw 0;return r.text()})));
  const seen=new Set();
  results.forEach(r=>{if(r.status==="fulfilled")parse(r.value).forEach(c=>{if(!seen.has(c.url)){seen.add(c.url);chans.push(c)}})});
  if(!chans.length){msg.textContent="Couldn't load any channel lists. Check your connection and reload.";return}
  chans.sort((a,b)=>a.name.localeCompare(b.name));
  ["All","Favorites",...[...new Set(chans.map(c=>c.group))].sort()].forEach(g=>{const o=document.createElement("option");o.textContent=g;cat.appendChild(o)});
  msg.textContent="Pick a channel to start watching";
  render();
}

function render(){
  const term=q.value.trim().toLowerCase(),g=cat.value;
  const rows=chans.filter(c=>(g==="All"||(g==="Favorites"?favs.includes(c.url):c.group===g))&&c.name.toLowerCase().includes(term));
  list.innerHTML="";
  if(!rows.length){list.innerHTML='<div class="empty">No channels match. Try another search or category.</div>';return}
  const frag=document.createDocumentFragment();
  rows.slice(0,1000).forEach(c=>{
    const li=document.createElement("li");
    if(cur&&cur.url===c.url)li.setAttribute("aria-current","true");
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";
    if(c.logo)img.src=c.logo;img.onerror=()=>img.style.visibility="hidden";
    const n=document.createElement("div");n.className="n";n.textContent=c.name;
    const s=document.createElement("small");s.textContent=c.group;n.appendChild(s);
    const f=document.createElement("button");f.className="fav"+(favs.includes(c.url)?" on":"");
    f.textContent=favs.includes(c.url)?"★":"☆";f.setAttribute("aria-label","Toggle favorite");
    f.onclick=e=>{e.stopPropagation();favs=favs.includes(c.url)?favs.filter(x=>x!==c.url):[...favs,c.url];saveFavs();render()};
    li.append(img,n,f);li.onclick=()=>play(c);frag.appendChild(li);
  });
  list.appendChild(frag);
}

function play(c){
  cur=c;now.textContent=c.name;msg.textContent="Loading "+c.name+"…";msg.style.display="flex";
  if(hls){hls.destroy();hls=null}
  const fail=()=>{msg.textContent=c.name+" isn't responding. Pick another channel.";msg.style.display="flex"};
  if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=c.url;v.onerror=fail}
  else if(window.Hls&&Hls.isSupported()){
    hls=new Hls({maxBufferLength:20});hls.loadSource(c.url);hls.attachMedia(v);
    hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail()});
  }else return fail();
  v.play().catch(()=>{});
  render();
}
v.addEventListener("playing",()=>msg.style.display="none");
q.oninput=render;cat.onchange=render;
load();
