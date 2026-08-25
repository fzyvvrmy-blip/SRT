const A=document.querySelector('#app'),S={p:'home',g:'大一',t:'kana',q:'',fav:new Set(),modal:false,pro:'words',n:1,a:'',show:true,usermenu:false};
let W=[],W_BOOK=3,W_LOADING=false;
let PAGE=1,KANA_SEL='あ';              // 分页 + 假名段
let BK={lesson:'',unit:'',type:'新出'};    // 课本筛选（课/单元/新出·练习）
const PER=20;                          // 每页条数

/* 五十音图表：清音+浊音+半浊音分行；「其他」放非假名开头（- ~ っ 汉字等） */
const KANA_ROWS=[['あ行','あいうえお'],['か行','かがきぎくぐけげこご'],['さ行','さざしじすずせぜそぞ'],['た行','ただちぢつづてでとど'],['な行','なにぬねの'],['は行','はばぱひびぴふぶぷへべぺほぼぽ'],['ま行','まみむめも'],['や行','やゆよ'],['ら行','らりるれろ'],['わ行','わをん']];
const KANA_CHARS=KANA_ROWS.map(r=>r[1]).join('');
const KANA_SEGS=[...KANA_CHARS,'其他'];

/* ---------- 单词数据：从后端 API 拉取 ---------- */
async function loadWords(order,book){
  W_BOOK=book||W_BOOK;
  W_LOADING=true;draw();
  try{
    const data=await (await fetch(`/api/words?order=${order}&book=${W_BOOK}`)).json();
    W=data.words.map(w=>({
      word:w.word, pron:w.pron||'', accent:w.accent||'', pos:w.pos||'', meaning:w.meaning||'',
      source:`第${w.lesson||'-'}课·Unit${w.unit||'-'}${w.source_type?'·'+w.source_type:''}`,
      kana:w.kana||'', lesson:w.lesson, unit:w.unit, type:w.source_type||''
    }));
  }catch(e){ W=[]; }
  W_LOADING=false;draw();
}
function switchTab(t){
  S.t=t; PAGE=1;
  if(t==='kana')loadWords('kana',3);
  else if(t==='book')loadWords('book',W_BOOK);
  else draw();
}

/* 假名段归属 / 列表 / 分页 */
function segOf(kana){ const c=(kana||'')[0]; return KANA_CHARS.includes(c)?c:'其他'; }
function kanaList(){ return W.filter(x=>segOf(x.kana)===KANA_SEL); }
function bookList(){
  return W.filter(x=>
    (!BK.lesson||x.lesson===BK.lesson)&&
    (!BK.unit||x.unit===BK.unit)&&
    (!BK.type||x.type===BK.type));
}
function totalPages(){ const L=S.t==='kana'?kanaList():bookList(); return Math.max(1,Math.ceil(L.length/PER)); }
function nextPage(){
  const pages=totalPages();
  if(PAGE<pages){ PAGE++; draw(); return; }
  if(S.t==='kana'){
    const i=KANA_SEGS.indexOf(KANA_SEL);
    if(i>=0&&i<KANA_SEGS.length-1){ KANA_SEL=KANA_SEGS[i+1]; PAGE=1; draw(); }
  }
}
function lessons(){ return [...new Set(W.map(x=>x.lesson).filter(v=>v!=null))].sort((a,b)=>a-b); }
function units(){ return [...new Set(W.filter(x=>!BK.lesson||x.lesson===BK.lesson).map(x=>x.unit).filter(v=>v!=null))].sort((a,b)=>a-b); }

/* 假名表下拉（分行 optgroup） */
function kanaSelect(){
  return `<select onchange="KANA_SEL=this.value;PAGE=1;draw()">
    ${KANA_ROWS.map(([g,cs])=>`<optgroup label="${g}">${[...cs].map(c=>`<option ${KANA_SEL===c?'selected':''}>${c}</option>`).join('')}</optgroup>`).join('')}
    <option ${KANA_SEL==='其他'?'selected':''}>其他</option>
  </select>`;
}
/* 课本顺序筛选器：册下拉 + 第_课下拉 + Unit_下拉 + 新出/练习下拉 */
const BOOK_NAMES = ['综合日语 第一册','综合日语 第二册','综合日语 第三册','综合日语 第四册'];
function bookSelects(){
  return `
    <select onchange="BK={lesson:'',unit:'',type:'新出'};loadWords('book',+this.value)">
      ${[1,2,3,4].map(n=>`<option value="${n}" ${W_BOOK===n?'selected':''}>${BOOK_NAMES[n-1]}</option>`).join('')}
    </select>
    <span class="inline-filter">第
      <select onchange="BK.lesson=this.value?+this.value:'';BK.unit='';PAGE=1;draw()">
        <option value=""></option>
        ${lessons().map(l=>`<option value="${l}" ${BK.lesson===l?'selected':''}>${l}</option>`).join('')}
      </select>课
    </span>
    <span class="inline-filter">Unit
      <select onchange="BK.unit=this.value?+this.value:'';PAGE=1;draw()">
        <option value=""></option>
        ${units().map(u=>`<option value="${u}" ${BK.unit===u?'selected':''}>${u}</option>`).join('')}
      </select>
    </span>
    <select onchange="BK.type=this.value;PAGE=1;draw()">
      <option value="新出" ${BK.type==='新出'?'selected':''}>新出</option>
      <option value="练习" ${BK.type==='练习'?'selected':''}>练习</option>
      <option value="" ${BK.type===''?'selected':''}>全部</option>
    </select>`;
}

/* ---------- 导航 ---------- */
function nav(){
  return `<header class="home-nav">
    <div class="grade-control">
      <button class="menu" onclick="document.querySelector('#grades').classList.toggle('open')">☰</button>
      <button class="grade-name" onclick="document.querySelector('#grades').classList.toggle('open')">${S.g}<span>（切换）</span></button>
    </div>
    <button class="nav-brand" onclick="go('home')">koniponi</button>
    <div class="user-wrap">
      <button class="user user-card" onclick="S.usermenu=!S.usermenu;draw()">
        <i><img src="assets/avatar-pony.png" alt="用户头像"></i>
        <span class="uname">王宇翔 <em>▾</em></span>
      </button>
      ${S.usermenu?`<div class="user-dropdown" id="udrop">
        <button onclick="S.usermenu=false;go('profile')">👤　个人中心</button>
        <hr>
        <button onclick="S.usermenu=false;go('login')">退出登录</button>
      </div>`:''}
    </div>
    <div id="grades">${['大一','大二','大三','大四'].map(x=>`<button onclick="S.g='${x}';document.querySelector('#grades').classList.remove('open');draw()">${x}</button>`).join('')}</div>
  </header>`;
}

function box(x){ A.innerHTML=`<main>${nav()}${x}</main>`; attachMenuClose(); }

/* 点击导航外区域关闭下拉 */
function attachMenuClose(){
  document.addEventListener('click', function handler(e){
    if(S.usermenu && !e.target.closest('.user-wrap')){
      S.usermenu=false; draw();
    }
    document.removeEventListener('click', handler);
  }, {once:true, capture:true});
}

/* ---------- 内页 header：返回箭头 + 页面标题，无 tabs ---------- */
function title(c,e,back){
  return `<section class="page"><div class="head">
    <div class="head-left">
      <button class="back-btn" onclick="go('${back||'home'}')" title="返回">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1>${c}<em>${e}</em></h1>
    </div>
  </div>`;
}

/* ---------- 首页 ---------- */
function home(){
  const modules=[
    ['assets/icon-words.png','单词','单词表查看与抽测','words'],
    ['assets/icon-reader.png','精读','录音与翻译','reader'],
    ['assets/icon-resources.png','资源','电子课本与下载','resources'],
    ['assets/icon-homework.png','作业','小试牛刀','homework']
  ];
  const conf = Array.from({length:32},(_,i)=>`<i style="--i:${i};--x:${(i%8-3.5)*34}px;--y:${-120-(i%4)*30}px;--r:${(i%9-4)*28}deg;--d:${(i%7)*.03}s"></i>`).join('');
  // SVG：写意鸭川场景，水平构图，融入点阵底色
  const riverSvg = `<svg class="river-scene" viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- 水面底色晕染，大椭圆，中心实边缘散 -->
    <radialGradient id="waterGlow" cx="50%" cy="52%" r="52%">
      <stop offset="0%" stop-color="#bbe0dc" stop-opacity=".45"/>
      <stop offset="60%" stop-color="#a8d8d4" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#a8d8d4" stop-opacity="0"/>
    </radialGradient>
    <ellipse cx="258" cy="138" rx="224" ry="118" fill="url(#waterGlow)"/>
    <!-- 蜿蜒河道（水平方向，从左流向右） -->
    <path d="M 10 95 C 70 75, 120 105, 180 90 C 240 75, 290 108, 355 95 C 400 86, 448 100, 510 88"
      fill="none" stroke="#7ec9c1" stroke-width="42" stroke-linecap="round" opacity=".2"/>
    <path d="M 10 118 C 68 100, 122 128, 182 115 C 242 102, 292 132, 356 120 C 402 111, 450 124, 510 112"
      fill="none" stroke="#93d5ce" stroke-width="32" stroke-linecap="round" opacity=".16"/>
    <!-- 水流高光线 -->
    <path d="M 15 104 C 75 88, 128 115, 188 103 C 248 91, 298 118, 360 107 C 406 98, 455 110, 512 100"
      fill="none" stroke="#caeee9" stroke-width="5" stroke-linecap="round" opacity=".5"/>
    <!-- 水纹弧线（散落在河道内） -->
    <path d="M 60 100 Q 74 93 88 100" fill="none" stroke="#8dd0ca" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <path d="M 148 108 Q 163 101 178 108" fill="none" stroke="#9ad5d0" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>
    <path d="M 240 96 Q 256 89 272 96" fill="none" stroke="#8dd0ca" stroke-width="2" stroke-linecap="round" opacity=".52"/>
    <path d="M 328 104 Q 345 97 362 104" fill="none" stroke="#9ad5d0" stroke-width="1.8" stroke-linecap="round" opacity=".48"/>
    <path d="M 418 98 Q 433 91 448 98" fill="none" stroke="#8dd0ca" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>
    <!-- 飞石1（最左，略大） -->
    <rect x="58" y="126" width="66" height="24" rx="7" fill="#ece6da" opacity=".88"/>
    <rect x="58" y="126" width="66" height="5" rx="3" fill="#f7f3ed" opacity=".72"/>
    <rect x="58" y="145" width="66" height="5" rx="0" fill="#c8bfae" opacity=".28"/>
    <!-- 飞石2 -->
    <rect x="186" y="122" width="54" height="20" rx="6" fill="#e8e2d6" opacity=".85"/>
    <rect x="186" y="122" width="54" height="4" rx="2" fill="#f4f0ea" opacity=".68"/>
    <rect x="186" y="138" width="54" height="4" rx="0" fill="#c0b8a6" opacity=".25"/>
    <!-- 飞石3（中间，略小） -->
    <rect x="298" y="128" width="46" height="18" rx="5" fill="#edeae0" opacity=".82"/>
    <rect x="298" y="128" width="46" height="4" rx="2" fill="#f5f2ec" opacity=".65"/>
    <!-- 飞石4（最右） -->
    <rect x="408" y="124" width="58" height="21" rx="6" fill="#ece6da" opacity=".85"/>
    <rect x="408" y="124" width="58" height="4" rx="3" fill="#f7f3ed" opacity=".7"/>
    <!-- 上岸草丛（河道上方） -->
    <ellipse cx="32" cy="74" rx="16" ry="11" fill="#7aab78" opacity=".4"/>
    <ellipse cx="22" cy="82" rx="11" ry="8" fill="#5c8c5a" opacity=".32"/>
    <ellipse cx="42" cy="79" rx="10" ry="7" fill="#90be8e" opacity=".28"/>
    <ellipse cx="138" cy="68" rx="14" ry="9" fill="#6ea06c" opacity=".35"/>
    <ellipse cx="150" cy="74" rx="10" ry="7" fill="#8fbe8d" opacity=".27"/>
    <ellipse cx="268" cy="72" rx="16" ry="10" fill="#7aab78" opacity=".36"/>
    <ellipse cx="282" cy="78" rx="11" ry="7" fill="#5c8c5a" opacity=".28"/>
    <ellipse cx="396" cy="70" rx="13" ry="9" fill="#6ea06c" opacity=".33"/>
    <ellipse cx="408" cy="76" rx="9" ry="6" fill="#90be8e" opacity=".26"/>
    <ellipse cx="488" cy="75" rx="15" ry="10" fill="#7aab78" opacity=".38"/>
    <!-- 下岸草丛（河道下方） -->
    <ellipse cx="46" cy="168" rx="15" ry="10" fill="#6ea06c" opacity=".35"/>
    <ellipse cx="34" cy="175" rx="10" ry="7" fill="#5c8c5a" opacity=".28"/>
    <ellipse cx="160" cy="162" rx="13" ry="9" fill="#7aab78" opacity=".32"/>
    <ellipse cx="310" cy="165" rx="14" ry="9" fill="#6ea06c" opacity=".3"/>
    <ellipse cx="460" cy="163" rx="16" ry="10" fill="#7aab78" opacity=".34"/>
    <ellipse cx="476" cy="170" rx="11" ry="7" fill="#5c8c5a" opacity=".26"/>
    <!-- 水面鹅卵石小圆 -->
    <circle cx="112" cy="112" r="3" fill="#c4d8d4" opacity=".48"/>
    <circle cx="220" cy="118" r="2.5" fill="#bcd4d0" opacity=".42"/>
    <circle cx="360" cy="114" r="2.8" fill="#c4d8d4" opacity=".45"/>
    <circle cx="470" cy="110" r="2.4" fill="#bcd4d0" opacity=".4"/>
  </svg>`;

  box(`
    <section class="home home-v2">
      <div class="homegrid">
        <div class="intro">
          <div class="intro-inner">
            <p class="quiet-copy">清华大学 · 日語専攻ポータル</p>
            <div class="portals">
              ${modules.map(x=>`
                <button onclick="go('${x[3]}')">
                  <div class="card-top">
                    <i><img src="${x[0]}" alt="${x[1]}图标"></i>
                    <b>${x[1]}</b>
                  </div>
                  <small>${x[2]}</small>
                </button>`).join('')}
            </div>
          </div>
        </div>
        <div id="world" class="world world-v2">
          <div class="river-scene-wrap">
            ${riverSvg}
            <button class="horse pony-run" onclick="party()">
              <img src="assets/pony-transparent.gif" alt="奔跑的小马">
            </button>
          </div>
          <div class="hero-footer">
            <span>鴨川の飛び石を跳ねるように</span>
            <b>KONIPONI</b>
          </div>
          <div id="speech">今日も、ゆっくり行こう！</div>
          <div class="conf" aria-hidden="true">${conf}</div>
        </div>
      </div>
    </section>`);
}

/* ---------- 搜索框（独立块，用于个人中心） ---------- */
function search(k){
  const r = S.q ? W.filter(x=>[x.word,x.pron,x.pos,x.meaning,x.source,x.kana].join(' ').includes(S.q)).slice(0,5) : [];
  return `<div class="search">
    <input value="${S.q}" oninput="S.q=this.value;draw()" placeholder="搜索单词、假名或中文意思…">
    ${r.length?`<div>${r.map(x=>`<button onclick="S.q='';go('${k}');setTimeout(()=>{ let el=document.querySelector('#w${W.indexOf(x)}'); if(el){el.classList.add('flash');el.scrollIntoView({block:'center'})}},0)">${x.word}　<small>${x.pron} · ${x.meaning}</small></button>`).join('')}</div>`:''}
  </div>`;
}

/* ---------- 搜索评分（越高越匹配） ---------- */
function searchScore(w, q){
  const Q = q.toLowerCase();
  const fields = [w.word, w.pron, w.kana, w.meaning];
  let best = 0;
  for(const f of fields){
    if(!f) continue;
    const s = f.toLowerCase();
    if(s === Q)           { best = Math.max(best, 100); break; }
    if(s.startsWith(Q))     best = Math.max(best, 80);
    else if(s.includes(Q))  best = Math.max(best, 60);
    else {
      // 字符级模糊：Q中每个字符都在 s 中按顺序出现
      let i = 0;
      for(const c of Q){ const idx = s.indexOf(c, i); if(idx===-1){ i=-1; break; } i=idx+1; }
      if(i !== -1) best = Math.max(best, 30);
    }
  }
  return best;
}

/* 搜索候选（带评分排序，最多5条） */
let SEARCH_SEL = -1;   // 当前键盘选中项 index

function searchCandidates(){
  if(!S.q) return [];
  return W
    .map(w => ({ w, s: searchScore(w, S.q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(x => x.w);
}

/* 跳转到课本顺序，定位该词条并高亮 */
function jumpToWord(targetWord){
  S.q = '';
  SEARCH_SEL = -1;

  // 切换到课本顺序，清掉筛选
  S.t = 'book';
  BK = { lesson: '', unit: '', type: '' };

  function scrollToTarget(){
    // W 已加载完毕后，在 bookList() 里定位
    const list = bookList();
    const pos = list.findIndex(x => x.word === targetWord);
    if(pos === -1) return;
    PAGE = Math.floor(pos / PER) + 1;
    draw();
    // draw() 是同步的，DOM 立即更新
    const cur = list.slice((PAGE-1)*PER, PAGE*PER);
    const rowIdx = cur.findIndex(x => x.word === targetWord);
    const el = document.querySelector('#w' + rowIdx);
    if(el){
      el.classList.remove('flash');
      void el.offsetWidth; // 强制回流，让动画重新触发
      el.classList.add('flash');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  if(S.t === 'book' && W.length && !W_LOADING){
    // 已经是课本顺序且数据在，直接定位
    scrollToTarget();
  } else {
    // 需要加载数据
    const orig = W_BOOK;
    W_LOADING = true; draw();
    fetch(`/api/words?order=book&book=${orig}`)
      .then(r => r.json())
      .then(data => {
        W = data.words.map(w => ({
          word: w.word, pron: w.pron||'', accent: w.accent||'', pos: w.pos||'', meaning: w.meaning||'',
          source: `第${w.lesson||'-'}课·Unit${w.unit||'-'}${w.source_type?'·'+w.source_type:''}`,
          kana: w.kana||'', lesson: w.lesson, unit: w.unit, type: w.source_type||''
        }));
        W.sort((a,b) => (a.lesson||0)-(b.lesson||0) || (a.unit||0)-(b.unit||0));
        W_LOADING = false;
        scrollToTarget();
      })
      .catch(() => { W_LOADING = false; draw(); });
  }
}

/* 行内搜索框（单词页工具栏内）
   关键：输入框永远不参与 draw() 重建，只有下拉列表局部更新 */
let _composing = false;

function searchInline(){
  return `<div class="search-inline" id="srchwrap">
    <input id="srchinput"
      placeholder="搜索单词、读音或释义…"
      oncompositionstart="_composing=true"
      oncompositionend="_composing=false;updateDrop(this.value)"
      oninput="if(!_composing)updateDrop(this.value)"
      onkeydown="handleSearchKey(event)"
      onblur="setTimeout(()=>{const d=document.querySelector('#searchdrop');if(d)d.remove();},150)"
      autocomplete="off"
    >
    <div id="searchdrop"></div>
  </div>`;
}

/* 只刷新下拉，不碰输入框 */
function updateDrop(val){
  S.q = val;
  SEARCH_SEL = -1;
  const drop = document.querySelector('#searchdrop');
  if(!drop) return;
  if(!val){ drop.innerHTML=''; drop.style.display='none'; return; }
  const cands = searchCandidates();
  if(!cands.length){ drop.innerHTML=''; drop.style.display='none'; return; }
  drop.style.display='block';
  drop.innerHTML = cands.map((w,i)=>`
    <button class="sdrop-item" data-word="${w.word.replace(/"/g,'&quot;')}"
      onmousedown="event.preventDefault()"
      onclick="jumpToWord(this.dataset.word)">
      <span class="sdrop-word">${highlight(w.word, val)}</span>
      <span class="sdrop-meaning">${w.meaning}</span>
    </button>`).join('');
}

/* 关键词高亮 */
function highlight(text, q){
  if(!q||!text) return text;
  const Q=q.toLowerCase(), s=text.toLowerCase(), idx=s.indexOf(Q);
  if(idx===-1) return text;
  return text.slice(0,idx)+`<em class="hl">${text.slice(idx,idx+Q.length)}</em>`+text.slice(idx+Q.length);
}
function truncate(s,n){ return s&&s.length>n?s.slice(0,n)+'…':(s||''); }

/* 键盘导航 */
function handleSearchKey(e){
  const cands = searchCandidates();
  const items = document.querySelectorAll('#searchdrop .sdrop-item');
  function markSel(i){
    items.forEach((el,j)=>el.classList.toggle('sdrop-sel', j===i));
  }
  if(e.key==='ArrowDown'){
    e.preventDefault();
    SEARCH_SEL=Math.min(SEARCH_SEL+1, cands.length-1);
    markSel(SEARCH_SEL);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    SEARCH_SEL=Math.max(SEARCH_SEL-1,-1);
    markSel(SEARCH_SEL);
  } else if(e.key==='Enter'){
    e.preventDefault();
    const target=cands[SEARCH_SEL>=0?SEARCH_SEL:0];
    if(target) jumpToWord(target.word);
  } else if(e.key==='Escape'){
    S.q=''; SEARCH_SEL=-1;
    const inp=document.querySelector('#srchinput');
    if(inp) inp.value='';
    const drop=document.querySelector('#searchdrop');
    if(drop){ drop.innerHTML=''; drop.style.display='none'; }
  }
}
function restoreFocus(){
  const el=document.querySelector('#srchinput'); if(el){ el.focus(); }
}

/* ---------- 单词行 ---------- */
function rows(list,src=true,del=false,showFavMark=false){
  return list.map((w,i)=>{
    const k=w.word;
    return `<tr id="w${i}">
      <td><b>${w.word}</b></td>
      <td>${w.pron}</td>
      <td>${w.accent}</td>
      <td>${w.pos}</td>
      <td>${w.meaning}</td>
      ${src?`<td><a>${w.source}${showFavMark?' <mark>#收藏</mark>':''}</a></td>`:''}
      <td><button class="pill ${S.fav.has(k)?'saved':''}" onclick="${del?`W=W.filter(x=>x.word!=='${k}');draw()`:`S.fav.has('${k}')?S.fav.delete('${k}'):S.fav.add('${k}');draw()`}">${del?'删除':S.fav.has(k)?'已收藏':'收藏'}</button></td>
    </tr>`;
  }).join('');
}

/* ---------- 单词 ---------- */
function words(){
  const test = S.t==='test';
  let body;
  if(test){
    body = tests();
  } else if(W_LOADING){
    body = `<div class="scroll"><div class="empty"><p>加载中…</p></div></div>`;
  } else {
    const L = S.t==='kana' ? kanaList() : bookList();
    const pages = totalPages();
    if(PAGE>pages) PAGE=pages;
    const cur = L.slice((PAGE-1)*PER, PAGE*PER);
    const noNext = (S.t==='book'&&PAGE>=pages) || (S.t==='kana'&&KANA_SEL==='其他'&&PAGE>=pages);
    body = !L.length
      ? `<div class="scroll"><div class="empty"><h2>暂无</h2><p>${S.t==='kana'?'该假名下暂无单词':'该筛选条件下暂无单词'}。</p></div></div>`
      : `<div class="scroll">
          <table>
            ${S.t==='kana'
              ? `<colgroup><col style="width:14%"><col style="width:16%"><col style="width:7%"><col style="width:11%"><col style="width:24%"><col style="width:20%"><col style="width:8%"></colgroup>`
              : `<colgroup><col style="width:18%"><col style="width:20%"><col style="width:8%"><col style="width:14%"><col style="width:30%"><col style="width:10%"></colgroup>`}
            <thead><tr>
              <th>单词</th><th>假名</th><th>音调</th><th>词性</th><th>意思</th>
              ${S.t==='kana'?'<th>来源</th>':''}
              <th>操作</th>
            </tr></thead>
            <tbody>${rows(cur,S.t==='kana')}</tbody>
          </table>
        </div>
        <div class="pager">
          <button ${PAGE<=1?'disabled':''} onclick="PAGE--;draw()">上一页</button>
          <span>第 ${PAGE} / ${pages} 页 · 共 ${L.length} 词</span>
          <button ${noNext?'disabled':''} onclick="nextPage()">下一页</button>
        </div>`;
  }
  box(title('单词','Words','home')+`
    <div class="card words-card">
      <div class="words-toolbar">
        <div class="wtabs">
          ${[['kana','假名顺序'],['book','课本顺序'],['test','抽查']].map(x=>`<button class="${S.t===x[0]?'on':''}" onclick="switchTab('${x[0]}')">${x[1]}</button>`).join('')}
        </div>
        ${test?'':`<div class="wfilters">${S.t==='kana'?kanaSelect():bookSelects()}</div>`}
        ${test?'':`<div class="wsearch">${searchInline()}</div>`}
      </div>
      ${body}
    </div>
  </section>${S.modal?modal():''}`)
}

/* ---------- 抽查 ---------- */
function tests(){
  return `<div class="toolbar">
    <span>测试记录</span>
    <button class="primary" onclick="S.modal=true;draw()">＋ 新建测试</button>
  </div>
  <div class="scroll">
    <table>
      <thead><tr><th>测试名称</th><th>测试时间</th><th>范围</th><th>单词量</th><th>正确率</th><th>操作</th></tr></thead>
      <tbody>
        <tr><td>期末课本复习</td><td>2026/08/18 21:17</td><td>综日第三册第 1–5 课</td><td>40</td><td>92%</td><td><button class="pill">查看详情</button></td></tr>
        <tr><td>本周错词回顾</td><td>2026/08/14 18:30</td><td>我的错词</td><td>20</td><td>85%</td><td><button class="pill">查看详情</button></td></tr>
      </tbody>
    </table>
  </div>`;
}

/* ---------- 新建测试弹窗 ---------- */
function modal(){
  return `<div class="shade" onclick="if(event.target===this){S.modal=false;draw()}">
    <div class="modal">
      <h2>新建测试</h2>
      ${[
        ['＊测试名称','<input placeholder="例如：期末课本复习">'],
        ['＊单词本','<select><option>综日一</option><option>综日二</option><option>综日三</option><option>综日四</option><option>我的单词本</option></select>'],
        ['＊范围','第 <select style="width:80px"><option>1</option></select> 课 Unit <select style="width:80px"><option>1</option></select> ～ 第 <select style="width:80px"><option>5</option></select> 课 Unit <select style="width:80px"><option>3</option></select>'],
        ['＊数量','<label style="margin-right:12px"><input type="radio" name="n" checked> 20</label><label style="margin-right:12px"><input type="radio" name="n"> 40</label><label style="margin-right:12px"><input type="radio" name="n"> 60</label><label style="margin-right:12px"><input type="radio" name="n"> 80</label><label><input type="radio" name="n"> 自定义</label>'],
        ['＊模式','<select><option>单词（展示假名）</option><option>假名（展示汉字）</option><option>音调（展示单词）</option><option>释义（展示单词）</option><option>外来语</option></select>']
      ].map(x=>`<div class="form"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}
      <footer>
        <button onclick="S.modal=false;draw()">取消</button>
        <button class="primary" onclick="S.modal=false;draw()">创建测试</button>
      </footer>
    </div>
  </div>`;
}

/* ---------- 精读 ---------- */
function reader(){
  const x=[
    ['ゆでたまごを作るのは、思ったより簡単です。','煮鸡蛋的制作过程，比想象中更简单。'],
    ['まず鍋に水を入れて、火にかけます。','首先，在锅中加水并开火。'],
    ['水が沸いたら、卵をそっと入れます。','水沸腾后，轻轻将鸡蛋放入锅中。'],
    ['七分ほど待てば、できあがりです。','等待大约七分钟，就完成了。'],
    ['ゆでたまごには栄養がたっぷり含まれています。','煮鸡蛋含有丰富的营养成分。'],
  ];
  box(title('精读','Close Reading','home')+`
    <div class="card">
      <div class="selects">
        <select><option>课外补充材料</option><option>综合日语 第一册</option></select>
        <select><option>ゆでたまご</option><option>字のないはがき</option></select>
      </div>
      <div class="switch">
        <button class="on">点读</button>
        <button class="on">翻译</button>
        <button class="${S.show?'on':''}" onclick="S.show=!S.show;draw()">展示译文</button>
      </div>
      <div class="audio">▶　播放全文　<span></span>　01:16 / 03:28</div>
      <div class="book">
        <article>
          <small>日本語</small>
          ${x.map((z,i)=>`<p onmouseenter="pair(${i})">${z[0]}</p>`).join('')}
        </article>
        ${S.show?`<article>
          <small>中文译文</small>
          ${x.map((z,i)=>`<p onmouseenter="pair(${i})">${z[1]}</p>`).join('')}
        </article>`:''}
      </div>
    </div>
  </section>`);
}

/* ---------- 资源 ---------- */
function resources(){
  const x=[
    ['教材',['综合日语 第一册','综合日语 第二册','综合日语 第三册','综合日语 第四册','口译教程','新经典听力教室','塞罕坝']],
    ['课内补充材料',['ゆでたまご','字のないはがき','夏目漱石']],
    ['JLPT',['（敬请期待）']]
  ];
  box(title('资源','Library','home')+`
    <div class="card">
      ${x.map(z=>`
        <div class="shelf">
          <small>${z[0]}</small>
          <div>${z[1].map(y=>`
            <section>
              <b>${y}</b>
              <button onclick="alert('资源文件导入后可下载')">↓ 下载</button>
            </section>`).join('')}
          </div>
        </div>`).join('')}
    </div>
  </section>`);
}

/* ---------- 个人中心 ---------- */
function profile(){
  const body = S.pro==='words'
    ? `<div class="card">
        <div style="margin-bottom:16px"><b style="font-size:16px">我的单词本</b></div>
        ${search('profile')}
        <div class="scroll">
          <table>
            <thead><tr><th>单词</th><th>假名</th><th>音调</th><th>词性</th><th>意思</th><th>来源</th><th>操作</th></tr></thead>
            <tbody>${rows(W.filter(x=>S.fav.has(x.word)),true,true,true)}</tbody>
          </table>
        </div>
       </div>`
    : `<div class="empty"><div>⚑<h2>我的错题</h2><p>错题归集功能已预留，待接入真实测试数据后在此展示。</p></div></div>`;
  box(title('个人中心','My Space','home')+`
    <div class="profile">
      <aside>
        <i>♞</i>
        <b>林同学</b>
        <small>清华大学 · ${S.g}</small>
        <button onclick="S.pro='words';draw()">📖　我的单词本</button>
        <button onclick="S.pro='mistakes';draw()">✏️　我的错题</button>
      </aside>
      ${body}
    </div>
  </section>`);
}

/* ---------- 作业 ---------- */
function homework(){
  const x = Array.from({length:15},(_,i)=>{
    const n=i+1, s=n<3?'done':n===3?'todo':'none';
    return `<button class="assignment" onclick="${s==='none'?'':`go('question')`}">
      <b>${String(n).padStart(2,'0')}</b>
      <span>第 ${n} 课 · 课程作业
        <small>${s==='done'?'已批改 · 可查看结果':s==='todo'?'本周截止：2026/08/23 23:59':'教师暂未布置'}</small>
      </span>
      <em class="${s}">${s==='done'?'已完成':s==='todo'?'待完成':'未布置'}</em>
    </button>`;
  }).join('');
  box(title('作业','Assignments','home')+`
    <div class="card">
      <div class="toolbar"><b>课程作业列表</b><span>综合日语 第一册</span></div>
      <div class="assign">${x}</div>
    </div>
  </section>`);
}

/* ---------- 题目 ---------- */
function question(){
  const c = S.n===1;
  box(title('第 3 课作业','Lesson 03','homework')+`
    <div class="card question">
      <small style="color:#9b8fc0">${c?'单选题':'填空题'}　${S.n} / 2</small>
      <h2>${c?'「調査」の読み方として、正しいものを選びなさい。':'次の文の（　）に入る适切な言葉を書きなさい。<br>世論を &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; する。'}</h2>
      ${c
        ? `<div class="choices">${['ちょさ','ちょうさ','ちょうざ','ちょうじゃ'].map((x,i)=>`<button class="${S.a==i?'selected':''}" onclick="S.a=${i};draw()">${'ＡＢＣＤ'[i]}.　${x}</button>`).join('')}</div>`
        : `<input class="answer" placeholder="在此输入答案…">`}
      <footer>
        <button onclick="go('homework')">返回</button>
        <button class="primary" onclick="${c?`S.n=2;S.a='';draw()`:`go('result')`}">${c?'下一题 →':'提交作业'}</button>
      </footer>
    </div>
  </section>`);
}

/* ---------- 结果 ---------- */
function result(){
  box(title('作业结果','Lesson 03','homework')+`
    <div class="card result">
      <small style="color:#9b8fc0">已完成 · 得分</small>
      <strong>1 / 2</strong>
      <p style="color:#9b8fc0">继续积累，下一次会更好。</p>
      <div><button class="good">1</button><button class="bad">2</button></div>
      <article>
        <b>第 2 题 · 回答不正确</b>
        <p>世論を &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; する。</p>
        <p>你的答案：（空）　正确答案：<strong>調査</strong></p>
      </article>
      <footer>
        <button onclick="go('homework')">返回作业列表</button>
        <button class="primary" onclick="go('words')">复习相关单词</button>
      </footer>
    </div>
  </section>`);
}

/* ---------- 登录 ---------- */
function login(){
  A.innerHTML=`<main class="login">
    <section>
      <div>
        <div class="logo">KONIPONI</div>
        <p style="color:#9b8fc0;font-size:13px;letter-spacing:1px">鴨川の飛び石を跳ねるように</p>
        <i style="font-style:normal;font-size:64px;display:block;margin-top:8px">♞</i>
      </div>
    </section>
    <section>
      <div>
        <small style="font-size:11px;color:#9b8fc0;letter-spacing:1.5px;text-transform:uppercase">Student Portal</small>
        <h1>おかえり。</h1>
        <p>请使用学生账号登录，继续你的学习旅程。</p>
        <input placeholder="学号 / Student ID">
        <input type="password" placeholder="密码 / Password">
        <select id="lg"><option>大一</option><option>大二</option><option>大三</option><option>大四</option></select>
        <button class="primary" onclick="S.g=document.querySelector('#lg').value;go('home')">登录</button>
      </div>
    </section>
  </main>`;
}

/* ---------- 交互 ---------- */
function go(x){
  S.p=x; S.q=''; location.hash=x;
  if(x==='words'){
    PAGE=1;
    if(!W.length&&!W_LOADING) loadWords(S.t==='book'?'book':'kana',W_BOOK);
    else draw();
  } else draw();
}
function draw(){ ({home,words,reader,resources,profile,homework,question,result,login}[S.p]||home)(); }
function party(){
  const w=document.querySelector('#world'), s=document.querySelector('#speech');
  if(!w) return;
  w.classList.remove('party'); void w.offsetWidth; w.classList.add('party');
  s.classList.add('show'); setTimeout(()=>s.classList.remove('show'),2400);
}
function pair(n){
  document.querySelectorAll('.book p').forEach((x,i)=>x.classList.toggle('hot', i===n || i===n+5));
}

if(location.hash) S.p=location.hash.slice(1);
if(S.p==='words') loadWords(S.t==='book'?'book':'kana',W_BOOK); else draw();
