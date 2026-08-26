const A=document.querySelector('#app'),S={p:'home',g:'大一',t:'kana',q:'',profileQ:'',fav:new Set(),modal:false,pro:'words',n:1,a:'',show:true,usermenu:false,mBook:'',mFromL:1,mFromU:1,mToL:15,mToU:3,mScope:'fav',mQty:'20',mCustom:'',mMode:'kanji2kana',mTotalCount:null,mName:''};
const BOOK_MAX={'综日一':[15,3],'综日二':[15,3],'综日三':[10,2],'综日四':[10,2]};
const BOOK_NUM={'综日一':1,'综日二':2,'综日三':3,'综日四':4};

/* 题型定义（与后端 MODES 保持一致） */
const MODES={
  kanji2kana:    '看汉字　写假名',
  kana2kanji:    '看假名　写汉字',
  word2meaning:  '看单词　写释义',
  word2accent:   '看单词　写音调',
  gairaigo_jp2cn:'外来语（日译中）',
  gairaigo_cn2jp:'外来语（中译日）',
};

/* 当前用户 id（硬编码，未来登录后替换） */
const UID = '001';

/* 抽查会话状态 */
let QZ = null;   // {sessionId, questions, mode, modeLabel, qIdx, answers, submitted, result}

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
      id:w.id,
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
  else if(t==='test'){ QZ=null; draw(); }
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
    const isFav = S.fav.has(k);
    return `<tr id="w${i}">
      <td><b>${w.word}</b></td>
      <td>${w.pron}</td>
      <td>${w.accent}</td>
      <td>${w.pos}</td>
      <td>${w.meaning}</td>
      ${src?`<td><a>${w.source}${showFavMark?' <mark>#收藏</mark>':''}</a></td>`:''}
      <td><button class="pill ${isFav?'saved':''}" onclick="toggleFav(${w.id},'${k}')">${isFav?'已收藏':'收藏'}</button></td>
    </tr>`;
  }).join('');
}

/* 收藏 / 取消收藏（接入真实 API） */
function toggleFav(wordId, wordKey){
  const isFav = S.fav.has(wordKey);
  const action = isFav ? 'remove' : 'add';
  // 本地立即响应：更新收藏 Set
  isFav ? S.fav.delete(wordKey) : S.fav.add(wordKey);

  // 同步更新 MY_WORDS（个人中心单词本）
  if(MY_WORDS !== null){
    if(action === 'add'){
      // 追加：从全局词列表找到完整词信息
      const wObj = W.find(w => w.id === wordId);
      if(wObj){
        const existing = MY_WORDS.find(w => w.id === wordId);
        if(existing){
          existing.fav_at = new Date().toISOString();
        } else {
          MY_WORDS.unshift({
            id: wordId, word: wObj.word, pron: wObj.pron,
            accent: wObj.accent, pos: wObj.pos, meaning: wObj.meaning,
            fav_at: new Date().toISOString(), wrong_at: null,
          });
        }
      }
    } else {
      // 取消收藏：清 fav_at；若也无 wrong_at 则移出列表
      const existing = MY_WORDS.find(w => w.id === wordId);
      if(existing){
        existing.fav_at = null;
        if(!existing.wrong_at) MY_WORDS = MY_WORDS.filter(w => w.id !== wordId);
      }
    }
  }

  draw();

  // 后端同步
  fetch('/api/favorites', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({user_id: UID, word_id: wordId, action}),
  }).catch(e=>{
    // 回滚
    isFav ? S.fav.add(wordKey) : S.fav.delete(wordKey);
    MY_WORDS = null;   // 回滚时重置缓存让下次重拉
    draw();
    console.error('收藏操作失败', e);
  });
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
  // 切到抽查 tab 且非答题/结果状态时，异步拉历史记录
  if(test && (!QZ || (QZ.submitted && QZ.result))){
    if(!QZ) setTimeout(loadQuizHistory, 0);
  }
}

/* ---------- 抽查：测试记录列表 ---------- */
function tests(){
  if(QZ && !QZ.submitted) return quizPage();
  if(QZ && QZ.submitted)  return quizResult();

  return `<div class="words-toolbar" style="border-bottom:none;padding-bottom:0">
    <span style="font-size:13px;color:#9b8fc0">测试记录</span>
    <button class="primary" style="margin-left:auto" onclick="S.modal=true;S.mTotalCount=null;fetchQuizCount();draw()">＋ 新建测试</button>
  </div>
  <div id="quiz-history-wrap">
    <div class="scroll"><div class="empty"><p>加载中…</p></div></div>
  </div>`;
}

/* 异步加载历史并注入 DOM，不重建整页 */
function loadQuizHistory(){
  const wrap = document.querySelector('#quiz-history-wrap');
  if(!wrap) return;
  fetch(`/api/quiz/history?user_id=${UID}`)
    .then(r=>r.json())
    .then(data=>{
      const list = data.sessions || [];
      if(!list.length){
        wrap.innerHTML = `<div class="empty"><h2>暂无测试记录</h2><p>点右上角「新建测试」开始第一次练习。</p></div>`;
        return;
      }
      wrap.innerHTML = `<div class="scroll"><table>
        <thead><tr><th>测试名称</th><th>题型</th><th>题数</th><th>正确率</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>${list.map(s=>`
          <tr>
            <td><b>${s.name}</b></td>
            <td>${s.mode_label}</td>
            <td>${s.total}</td>
            <td>${s.finished ? s.score+'%' : '<em style="color:#9b8fc0">未完成</em>'}</td>
            <td style="color:#9b8fc0;font-size:12px">${s.created_at ? s.created_at.slice(0,16).replace('T',' ') : ''}</td>
            <td><button class="pill" onclick="viewSession(${s.id})">查看详情</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    })
    .catch(()=>{ if(wrap) wrap.innerHTML=`<div class="empty"><p>加载失败，请检查网络。</p></div>`; });
}

/* ---------- 开始抽查：发 API ---------- */
/* 异步查询当前范围内的词数，更新 S.mTotalCount 并刷新界面 */
let _countTimer = null;
function fetchQuizCount(){
  // 防抖：100ms 内多次调用只发一次请求
  clearTimeout(_countTimer);
  _countTimer = setTimeout(()=>{
    const book     = S.mBook;
    const isMyBook = book === '我的单词本';
    if(!book || !S.mMode) return;

    const p = new URLSearchParams({
      user_id: UID,
      mode:    S.mMode,
    });
    if(isMyBook){
      p.set('scope', S.mScope || 'all');
    } else {
      const bNum = BOOK_NUM[book];
      if(!bNum) return;
      p.set('book',        bNum);
      p.set('from_lesson', S.mFromL);
      p.set('from_unit',   S.mFromU);
      p.set('to_lesson',   S.mToL);
      p.set('to_unit',     S.mToU);
    }

    fetch('/api/quiz/count?' + p.toString())
      .then(r=>r.json())
      .then(data=>{ S.mTotalCount = data.count ?? null; draw(); })
      .catch(()=>{});
  }, 100);
}

function startQuiz(){
  const book   = S.mBook;
  const isMyBook = book === '我的单词本';
  const name   = S.mName.trim() || '未命名测试';
  const qty    = S.mQty==='全部' ? null : S.mQty==='自定义' ? (+S.mCustom||20) : +S.mQty;

  const body = {
    user_id: UID,
    name,
    mode: S.mMode,
    qty,
  };
  if(isMyBook){
    body.scope = S.mScope || 'all';
  } else {
    body.book     = BOOK_NUM[book] || 3;
    body.from_lesson = S.mFromL;
    body.from_unit   = S.mFromU;
    body.to_lesson   = S.mToL;
    body.to_unit     = S.mToU;
  }

  S.modal = false;
  S.mName = '';   // 下次打开 modal 名称清空
  // 先 draw 显示"加载中"
  QZ = { loading: true };
  draw();

  fetch('/api/quiz/start', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.error){ alert('抽题失败：' + data.error); QZ=null; draw(); return; }
    QZ = {
      sessionId:  data.session_id,
      questions:  data.questions,
      mode:       data.mode,
      modeLabel:  data.mode_label,
      qIdx:       0,
      answers:    [],  // [{word_id, mode, user_answer, correct_answer, is_correct}]
      submitted:  false,
      result:     null,
      startTime:  Date.now(),   // 用于计算用时
    };
    draw();
  })
  .catch(e=>{ alert('网络错误：'+e); QZ=null; draw(); });
}

/* ---------- 答题页 ---------- */
function quizPage(){
  if(QZ.loading) return `<div class="empty"><p>加载中…</p></div>`;

  const q     = QZ.questions[QZ.qIdx];
  const total = QZ.questions.length;
  const idx   = QZ.qIdx;
  const pct   = Math.round(idx / total * 100);
  const isLast = idx === total - 1;

  // 上一题已答的内容（回顾用）
  const prevAns = QZ.answers[idx] ? QZ.answers[idx].user_answer : '';

  return `
  <div class="quiz-page">
    <div class="quiz-progress">
      <span>${idx+1} / ${total}</span>
      <div class="quiz-bar"><div class="quiz-bar-fill" style="width:${pct}%"></div></div>
      <span style="color:#9b8fc0;font-size:12px">${QZ.modeLabel}</span>
    </div>

    <div class="quiz-prompt">${q.prompt}</div>
    ${QZ.mode==='word2accent' ? `<div class="quiz-sub">${q.pronunciation||''}</div>` : ''}

    <input id="quiz-ans" class="answer" placeholder="在此输入答案…" value="${prevAns}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();submitOne()}"
      autocomplete="off">

    <div class="quiz-nav">
      <button onclick="quizBack()" ${idx===0?'disabled':''}>← 上一题</button>
      <button class="primary" onclick="submitOne()">${isLast ? '提交测试 →' : '下一题 →'}</button>
    </div>
  </div>`;
}

/* 下一题/提交 */
function submitOne(){
  const inp = document.querySelector('#quiz-ans');
  const val = inp ? inp.value.trim() : '';
  const q   = QZ.questions[QZ.qIdx];
  const is_correct = judgeAnswer(QZ.mode, val, q.correct_answer);

  QZ.answers[QZ.qIdx] = {
    word_id:        q.word_id,
    mode:           QZ.mode,
    user_answer:    val,
    correct_answer: q.correct_answer,
    is_correct,
  };

  if(QZ.qIdx < QZ.questions.length - 1){
    QZ.qIdx++;
    draw();
    setTimeout(()=>{ const el=document.querySelector('#quiz-ans'); if(el) el.focus(); }, 0);
  } else {
    // 全部答完，提交
    submitQuiz();
  }
}

/* 上一题 */
function quizBack(){
  if(QZ.qIdx > 0){ QZ.qIdx--; draw(); }
}

/* 前端判分（与后端 judge 逻辑保持一致） */
function judgeAnswer(mode, userAns, correctAns){
  // 全角→半角，去首尾空白
  const norm = s => (s||'').trim().replace(/[！-～]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
  const ua = norm(userAns);
  if(!ua) return false;

  if(['word2meaning','gairaigo_jp2cn'].includes(mode)){
    // 释义：';' 分隔多义项，用户答案须与某完整义项完全相等（不接受子串）
    return correctAns.split(';').map(norm).filter(Boolean).includes(ua);
  }
  // 假名、外来语单词、音调：严格全等；'/' 分隔时任一匹配即可
  return correctAns.split('/').map(norm).filter(Boolean).includes(ua);
}

/* 提交整次测试 */
function submitQuiz(){
  QZ.submitted  = true;
  QZ.submitting = true;
  QZ.elapsed    = Math.round((Date.now() - (QZ.startTime || Date.now())) / 1000); // 秒
  draw();

  fetch('/api/quiz/submit', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      session_id: QZ.sessionId,
      user_id:    UID,
      answers:    QZ.answers,
    }),
  })
  .then(r=>r.json())
  .then(data=>{
    QZ.submitting = false;
    QZ.result = data;
    draw();
  })
  .catch(e=>{ QZ.submitting=false; alert('提交失败：'+e); QZ.submitted=false; draw(); });
}

/* ---------- 结果页 ---------- */
function quizResult(){
  if(QZ.submitting) return `<div class="empty"><p>提交中…</p></div>`;

  const r = QZ.result;
  // 以本地 answers 为准（忽略操作会在本地同步更新）
  const localCorrect = QZ.answers.filter(a=>!a.ignored && a.is_correct).length
                     + QZ.answers.filter(a=> a.ignored).length;
  const total   = QZ.answers.length;
  const score   = total ? Math.round(localCorrect / total * 100) : 0;

  // 用时格式化
  const sec = QZ.elapsed || 0;
  const timeStr = sec >= 60
    ? `${Math.floor(sec/60)} 分 ${sec%60} 秒`
    : `${sec} 秒`;

  const wrongItems = QZ.answers.filter(a => !a.is_correct && !a.ignored);

  return `
  <div class="result">
    <small style="color:#9b8fc0">${QZ.modeLabel} · ${total} 题 · 用时 ${timeStr}</small>
    <strong>${localCorrect} / ${total}</strong>
    <p style="color:#9b8fc0;margin:6px 0 20px">${score>=90?'出色！':score>=70?'不错，继续加油！':score>=50?'还需多练习。':'没关系，多复习几遍。'}</p>

    <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:20px">
      ${QZ.answers.map((a,i)=>{
        const cls = a.ignored ? 'ignored' : a.is_correct ? 'good' : 'bad';
        return `<button class="${cls}" title="${QZ.questions[i].prompt}" style="font-size:11px;min-width:36px">${i+1}</button>`;
      }).join('')}
    </div>

    ${wrongItems.length ? `
    <article>
      <b>答错的题（${wrongItems.length} 道）</b>
      <table style="margin-top:12px">
        <thead><tr><th>题目</th><th>你的答案</th><th>正确答案</th><th>操作</th></tr></thead>
        <tbody>
          ${wrongItems.map(a=>{
            const q = QZ.questions.find(x=>x.word_id===a.word_id);
            return `<tr>
              <td><b>${q?q.prompt:''}</b></td>
              <td style="color:#e8526a">${a.user_answer||'（未作答）'}</td>
              <td style="color:#34c47c"><b>${a.correct_answer}</b></td>
              <td><button class="override-btn" onclick="overrideAnswer(${a.word_id})" style="font-size:12px;padding:3px 10px;color:#7c3aed;border-color:#c4b5fd;background:#f5f0ff">忽略</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:12px;color:#bbb;margin-top:8px">* 忽略后不计入错词本</p>
    </article>` : `<article style="text-align:center;border-color:#d8f5e8;background:#f0fdf7"><b style="color:#34c47c">全部答对！</b></article>`}

    <div class="result footer" style="margin-top:22px">
      <button onclick="QZ=null;draw()">返回记录</button>
      <button class="primary" onclick="QZ=null;S.t='book';go('words')">复习单词</button>
    </div>
  </div>`;
}

/* 忽略某道答错的题（前端标记 + 调后端接口撤销错词） */
function overrideAnswer(wordId){
  const ans = QZ.answers.find(a => a.word_id === wordId);
  if(!ans || ans.is_correct || ans.ignored) return;

  ans.ignored = true;   // 前端立即生效
  draw();

  fetch('/api/quiz/override', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      session_id: QZ.sessionId,
      user_id:    UID,
      word_id:    wordId,
    }),
  })
  .then(r=>r.json())
  .then(data=>{ if(!data.ok) console.warn('override failed', data); })
  .catch(e=>console.error('override error', e));
}

/* 查看历史测试详情（占位，后续完善） */
function viewSession(id){
  fetch(`/api/quiz/session/${id}?user_id=${UID}`)
    .then(r=>r.json())
    .then(data=>{
      const s = data.session;
      const answers = data.answers;
      const wrong = answers.filter(a=>!a.is_correct);
      alert(`「${s.name}」\n题型：${s.mode_label}\n得分：${s.correct}/${s.total}（${s.score}%）\n答错 ${wrong.length} 道`);
    })
    .catch(()=>alert('加载失败'));
}


/* ---------- 新建测试弹窗 ---------- */
function modal(){
  const isLoan   = S.mMode.startsWith('gairaigo');
  const isCustom = S.mQty  === '自定义';
  const book     = S.mBook;
  const isMyBook = book === '我的单词本';
  const isRegBook = book && !isMyBook;

  const [maxL, maxU] = BOOK_MAX[book] || [15, 3];
  const lessons = Array.from({length:maxL},(_,i)=>i+1);
  const units   = Array.from({length:maxU},(_,i)=>i+1);

  // 范围下拉选项
  function lessonOpts(cur){ return lessons.map(n=>`<option ${cur===n?'selected':''}>${n}</option>`).join(''); }
  function unitOpts(cur){   return units.map(n=>`<option ${cur===n?'selected':''}>${n}</option>`).join(''); }

  return `<div class="shade" onclick="if(event.target===this){S.modal=false;draw()}">
    <div class="modal">
      <h2>新建测试</h2>
      <div class="form-rows">

        <div class="form-row">
          <b>＊测试名称</b>
          <input placeholder="例如：期末课本复习" value="${S.mName}"
            oninput="S.mName=this.value">
        </div>

        <div class="form-row">
          <b>＊单词本</b>
          <select onchange="S.mBook=this.value;S.mFromL=1;S.mFromU=1;S.mToL=BOOK_MAX[this.value]?BOOK_MAX[this.value][0]:15;S.mToU=BOOK_MAX[this.value]?BOOK_MAX[this.value][1]:3;S.mScope='';S.mTotalCount=null;fetchQuizCount();draw()">
            <option value="">请选择…</option>
            <option value="综日一" ${book==='综日一'?'selected':''}>综日一</option>
            <option value="综日二" ${book==='综日二'?'selected':''}>综日二</option>
            <option value="综日三" ${book==='综日三'?'selected':''}>综日三</option>
            <option value="综日四" ${book==='综日四'?'selected':''}>综日四</option>
            <option value="我的单词本" ${isMyBook?'selected':''}>我的单词本</option>
          </select>
        </div>

        ${isRegBook ? `
        <div class="form-row">
          <b>＊范围</b>
          <div class="range-wrap">
            <div class="range-line">
              <span class="range-label">从</span>
              <span class="range-inline">第
                <select onchange="S.mFromL=+this.value;S.mTotalCount=null;fetchQuizCount();draw()">${lessonOpts(S.mFromL)}</select>
              课</span>
              <span class="range-inline">Unit
                <select onchange="S.mFromU=+this.value;S.mTotalCount=null;fetchQuizCount()">${unitOpts(S.mFromU)}</select>
              </span>
            </div>
            <div class="range-line">
              <span class="range-label">到</span>
              <span class="range-inline">第
                <select onchange="S.mToL=+this.value;S.mTotalCount=null;fetchQuizCount();draw()">${lessonOpts(S.mToL)}</select>
              课</span>
              <span class="range-inline">Unit
                <select onchange="S.mToU=+this.value;S.mTotalCount=null;fetchQuizCount()">${unitOpts(S.mToU)}</select>
              </span>
            </div>
          </div>
        </div>` : ''}

        ${isMyBook ? `
        <div class="form-row">
          <b>＊范围</b>
          <select onchange="S.mScope=this.value">
            <option value="fav"   ${S.mScope==='fav'  ?'selected':''}>收藏</option>
            <option value="wrong" ${S.mScope==='wrong' ?'selected':''}>错词</option>
            <option value="all"   ${S.mScope==='all'   ?'selected':''}>全部</option>
          </select>
        </div>` : ''}

        ${book ? `
        <div class="form-row">
          <b>＊数量</b>
          <div class="radio-group">
            ${['20','40','60'].map(v=>
              `<label><input type="radio" name="mqty" ${S.mQty===v?'checked':''}
                onchange="S.mQty='${v}';draw()"> ${v}</label>`
            ).join('')}
            <label><input type="radio" name="mqty" ${S.mQty==='全部'?'checked':''}
              onchange="S.mQty='全部';draw()"> 全部${S.mTotalCount!=null?`<span style="color:#9b8fc0;font-size:12px;margin-left:4px">（共 ${S.mTotalCount} 词）</span>`:''}
            </label>
            <label><input type="radio" name="mqty" ${S.mQty==='自定义'?'checked':''}
              onchange="S.mQty='自定义';draw()"> 自定义</label>
            ${isCustom ? `<input class="custom-input" type="number" min="1" max="999"
              value="${S.mCustom}" placeholder="输入数量"
              oninput="S.mCustom=this.value">` : ''}
          </div>
        </div>

        <div class="form-row">
          <b>＊题型</b>
          <select onchange="S.mMode=this.value;S.mTotalCount=null;fetchQuizCount();draw()">
            ${Object.entries(MODES).map(([k,v])=>
              `<option value="${k}" ${S.mMode===k?'selected':''}>${v}</option>`
            ).join('')}
          </select>
        </div>` : ''}

      </div>
      <footer>
        <button onclick="S.modal=false;draw()">取消</button>
        <button class="primary" onclick="startQuiz()">创建测试</button>
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

// 单词本缓存（收藏 + 错词 合并）
let MY_WORDS = null;   // null=未加载

function loadMyWords(){
  fetch(`/api/favorites?user_id=${UID}&scope=all`)
    .then(r=>r.json())
    .then(data=>{
      MY_WORDS = data.words || [];
      draw();
    })
    .catch(()=>{ MY_WORDS = []; draw(); });
}

function profile(){
  // 切换到单词本页时自动加载
  if(S.pro==='words' && MY_WORDS === null){
    MY_WORDS = [];   // 防重复请求
    setTimeout(loadMyWords, 0);
  }

  const wList = S.profileQ
    ? (MY_WORDS||[]).filter(w=>
        w.word.includes(S.profileQ)||(w.pron||'').includes(S.profileQ)||(w.meaning||'').includes(S.profileQ))
    : (MY_WORDS||[]);

  const body = S.pro==='words'
    ? `<div class="card">
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
          <b style="font-size:16px">我的单词本</b>
          <span style="color:#9b8fc0;font-size:13px">${MY_WORDS===null?'加载中…':`共 ${MY_WORDS.length} 词`}</span>
          <button onclick="MY_WORDS=null;loadMyWords()" style="margin-left:auto;font-size:12px;padding:4px 10px">刷新</button>
        </div>
        <div class="search-inline" style="margin-bottom:12px">
          <input value="${S.profileQ}" oninput="S.profileQ=this.value;draw()"
            placeholder="搜索单词、假名或中文意思…" style="width:100%">
        </div>
        ${MY_WORDS===null
          ? `<div class="empty"><p>加载中…</p></div>`
          : wList.length===0
            ? `<div class="empty"><p>${MY_WORDS.length===0?'单词本还是空的，去收藏一些单词或做点测试吧':'搜索无结果'}</p></div>`
            : `<div class="scroll">
                <table class="profile-word-table">
                  <thead><tr><th>单词</th><th>假名</th><th>音调</th><th>词性</th><th>意思</th><th>标签</th><th>操作</th></tr></thead>
                  <tbody>
                    ${wList.map(w=>{
                      const tags = [];
                      if(w.fav_at)   tags.push(`<mark class="tag-fav">收藏</mark>`);
                      if(w.wrong_at) tags.push(`<mark class="tag-wrong">错词</mark>`);
                      return `<tr>
                        <td><b>${w.word}</b></td>
                        <td>${w.pron||''}</td>
                        <td>${w.accent||''}</td>
                        <td>${w.pos||''}</td>
                        <td>${w.meaning||''}</td>
                        <td>${tags.join(' ')}</td>
                        <td><button class="pill" onclick="removeMyWord(${w.id})" style="font-size:12px">移除</button></td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
        }
       </div>`
    : `<div class="empty"><div>⚑<h2>作业错题</h2><p>作业中做错的题会归集在这里，功能待接入。</p></div></div>`;

  box(title('个人中心','My Space','home')+`
    <div class="profile">
      <aside>
        <i>♞</i>
        <b>林同学</b>
        <small>清华大学 · ${S.g}</small>
        <button onclick="S.pro='words';if(MY_WORDS===null)loadMyWords();draw()">📖　我的单词本</button>
        <button onclick="S.pro='mistakes';draw()">✏️　作业错题</button>
      </aside>
      ${body}
    </div>
  </section>`);
}

/* 从单词本移除一个词（同时清除收藏和错词标记） */
function removeMyWord(wordId){
  if(!confirm('确定从单词本移除这个词？（同时清除收藏和错词标记）')) return;
  fetch('/api/favorites', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({user_id: UID, word_id: wordId, action: 'remove'}),
  })
  .then(()=>{
    // 本地同步移除
    if(MY_WORDS) MY_WORDS = MY_WORDS.filter(w => w.id !== wordId);
    draw();
  });
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
