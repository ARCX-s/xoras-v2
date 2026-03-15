/* Xoras — расписание МГСУ © 2025 */
'use strict';

const DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DS   = {Понедельник:'Пн',Вторник:'Вт',Среда:'Ср',Четверг:'Чт',Пятница:'Пт',Суббота:'Сб'};
const DAY_JS = {0:'Воскресенье',1:'Понедельник',2:'Вторник',3:'Среда',4:'Четверг',5:'Пятница',6:'Суббота'};

const TTAG = {'лек':'tt-l','пр':'tt-p','лаб':'tt-b','крп':'tt-k'};
const TWRD = {'лек':'Лекция','пр':'Практика','лаб':'Лаб','крп':'КРП'};

const PARA_TIMES = [
  null,
  {s:'08:30',e:'09:50'},{s:'10:00',e:'11:20'},{s:'11:30',e:'12:50'},
  {s:'13:00',e:'14:20'},{s:'14:30',e:'15:50'},{s:'16:00',e:'17:20'},
];

const ACCENTS = [
  {r:0,  g:122,b:255,name:'Синий'},
  {r:88, g:86, b:214,name:'Фиолет'},
  {r:255,g:45, b:85, name:'Розовый'},
  {r:52, g:199,b:89, name:'Зелёный'},
  {r:255,g:149,b:0,  name:'Оранж'},
  {r:50, g:173,b:230,name:'Голубой'},
];

let selGroup=null, selGroupName=null, selDay=null, dark=false, cpOpen=false;
let scheduleSlots={};
let loadingSchedule=false;

const $=id=>document.getElementById(id);
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ls(k,v){try{localStorage.setItem('sp5_'+k,v)}catch(e){}}
function lg(k){try{return localStorage.getItem('sp5_'+k)}catch(e){return null}}
function bounce(el){if(!el)return;el.style.transform='scale(.82)';setTimeout(()=>{el.style.transform=''},200)}

// ── Избранное ─────────────────────────────────────

function getFavorites(){
  try{return JSON.parse(lg('favorites')||'[]');}catch(e){return [];}
}

function saveFavorites(favs){
  ls('favorites',JSON.stringify(favs));
}

function isFavorite(id){
  return getFavorites().some(f=>f.id===id);
}

function toggleFavorite(id, name){
  let favs=getFavorites();
  if(isFavorite(id)){
    favs=favs.filter(f=>f.id!==id);
    showToast('Убрано из избранного');
  } else {
    favs.push({id, name});
    showToast('Добавлено в избранное ⭐');
  }
  saveFavorites(favs);
  updateFavBtn();
  buildFavorites();
}

function updateFavBtn(){
  const btn=$('btn-favorite');
  if(!btn||!selGroup)return;
  btn.innerHTML=isFavorite(selGroup)
    ?'<i class="fa-solid fa-star"></i>'
    :'<i class="fa-regular fa-star"></i>';
}

function buildFavorites(){
  const wrap=$('favorites-wrap');
  if(!wrap)return;
  const favs=getFavorites();
  if(!favs.length){
    wrap.innerHTML='<div class="empty" style="padding:20px 0"><div class="empty-ico" style="font-size:28px">⭐</div>Пока пусто — добавь группы из поиска</div>';
    return;
  }
  wrap.innerHTML='';
  const row=document.createElement('div');
  row.className='group-row';
  row.style.cssText='flex-wrap:wrap;gap:8px;padding:4px 0';
  favs.forEach(f=>{
    const wrap2=document.createElement('div');
    wrap2.style.cssText='position:relative;display:inline-flex;align-items:center';
    const btn=document.createElement('button');
    btn.className='gcard g';
    btn.textContent=f.name;
    btn.onclick=()=>{selectGroup(f.id,f.name);bounce(btn)};
    const del=document.createElement('button');
    del.style.cssText='position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:rgba(255,45,85,1);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:2';
    del.innerHTML='✕';
    del.onclick=(e)=>{e.stopPropagation();toggleFavorite(f.id,f.name)};
    wrap2.appendChild(btn);
    wrap2.appendChild(del);
    row.appendChild(wrap2);
  });
  wrap.appendChild(row);
}

// ── Вкладки поиск/избранное ───────────────────────

function initHomeTabs(){
  const tabs=document.querySelectorAll('.home-tab');
  tabs.forEach(t=>{
    t.onclick=()=>{
      tabs.forEach(x=>x.classList.remove('on'));
      t.classList.add('on');
      const target=t.dataset.tab;
      $('tab-search').style.display=target==='search'?'block':'none';
      $('tab-favorites').style.display=target==='favorites'?'block':'none';
      requestAnimationFrame(()=>requestAnimationFrame(updateWeekSlider));
    };
  });
}

// ── Дата/неделя ───────────────────────────────────

function getTodayName(){
  return DAY_JS[new Date().getDay()]||null;
}

function getDateForDay(dayName){
  const today=new Date();
  const todayIdx=today.getDay()===0?7:today.getDay();
  const dayIdx={Понедельник:1,Вторник:2,Среда:3,Четверг:4,Пятница:5,Суббота:6,Воскресенье:7}[dayName]||1;
  const diff=dayIdx-todayIdx;
  const target=new Date(today);
  target.setDate(today.getDate()+diff);
  const dd=String(target.getDate()).padStart(2,'0');
  const mm=String(target.getMonth()+1).padStart(2,'0');
  return `${dd}.${mm}`;
}

function getCurrentParaIndex(){
  const now=new Date();
  const total=now.getHours()*60+now.getMinutes();
  for(let i=1;i<PARA_TIMES.length;i++){
    const pt=PARA_TIMES[i];if(!pt)continue;
    const[sh,sm]=pt.s.split(':').map(Number);
    const[eh,em]=pt.e.split(':').map(Number);
    if(total>=sh*60+sm&&total<=eh*60+em)return i;
  }
  return -1;
}

// ── Тема ─────────────────────────────────────────

function setDark(v){
  dark=v;
  document.body.toggleAttribute('data-dark',dark);
  document.documentElement.style.background=dark?'#06060b':'#eef0f6';
  $('btn-theme').querySelector('i').className=dark?'fa-solid fa-sun':'fa-solid fa-moon';
  ls('dark',dark?'1':'0');
}
$('btn-theme').onclick=function(){setDark(!dark);bounce(this)};

// ── Акцент ────────────────────────────────────────

function applyAccent(c){
  document.documentElement.style.setProperty('--acc',`${c.r},${c.g},${c.b}`);
}
const swBox=$('swatches');
ACCENTS.forEach((c,i)=>{
  const el=document.createElement('button');
  el.className='sw g';
  el.style.cssText=`background:rgb(${c.r},${c.g},${c.b});box-shadow:0 3px 10px rgba(${c.r},${c.g},${c.b},.5)`;
  el.title=c.name;
  el.onclick=()=>{
    swBox.querySelectorAll('.sw').forEach(s=>s.classList.remove('on'));
    el.classList.add('on');applyAccent(c);ls('acc',String(i));bounce(el);
  };
  swBox.appendChild(el);
});
$('btn-color').onclick=function(e){
  e.stopPropagation();cpOpen=!cpOpen;$('cpanel').classList.toggle('open',cpOpen);bounce(this);
};
document.addEventListener('click',()=>{cpOpen=false;$('cpanel').classList.remove('open')});
$('cpanel').addEventListener('click',e=>e.stopPropagation());

// ── Навигация ─────────────────────────────────────

function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  document.querySelectorAll('.db').forEach(b=>b.classList.remove('on'));
  $(id).classList.add('on');
  const db=document.querySelector(`.db[data-v="${id}"]`);
  if(db)db.classList.add('on');
  $('page').scrollTop=0;
  ls('view',id);
  const showBack=(id==='view-sched'&&selGroup);
  $('btn-back').style.display=showBack?'flex':'none';
  const titleEl=$('nav-title');
  if(id==='view-sched'&&selGroupName){
    titleEl.style.cssText='font-size:15px;font-weight:800;color:var(--t1);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    titleEl.textContent=selGroupName;
  } else {
    titleEl.style.cssText='';
    titleEl.textContent='Xoras';
  }
  // Показываем кнопку избранного в расписании
  const favBtn=$('btn-favorite');
  if(favBtn) favBtn.style.display=(id==='view-sched'&&selGroup)?'flex':'none';
  requestAnimationFrame(()=>requestAnimationFrame(updateSlider));
}

function goHome(){showView('view-home');}
document.querySelectorAll('.db').forEach(b=>{
  b.onclick=()=>{showView(b.dataset.v);bounce(b)};
});

// ── Поиск групп ───────────────────────────────────

let searchTimeout=null;

function initGroupSearch(){
  const input=$('group-search-input');
  const results=$('group-search-results');
  if(!input)return;

  input.oninput=function(){
    clearTimeout(searchTimeout);
    const q=this.value.trim();
    if(q.length<2){
      results.innerHTML='<div class="empty" style="padding:20px 0"><div class="empty-ico" style="font-size:28px">🔍</div>Введи от 2 символов</div>';
      return;
    }
    results.innerHTML='<div class="empty" style="padding:20px 0"><div class="empty-ico" style="font-size:28px">⏳</div>Поиск...</div>';
    searchTimeout=setTimeout(async()=>{
      const groups=await window.MGSU.searchGroups(q);
      if(!groups.length){
        results.innerHTML='<div class="empty" style="padding:20px 0"><div class="empty-ico" style="font-size:28px">😔</div>Группа не найдена</div>';
        return;
      }
      results.innerHTML='';
      const row=document.createElement('div');
      row.className='group-row';
      row.style.cssText='flex-wrap:wrap;gap:8px;padding:4px 0';
      groups.forEach(g=>{
        const btn=document.createElement('button');
        btn.className='gcard g';
        btn.textContent=g.text;
        btn.onclick=()=>{selectGroup(g.id,g.text);bounce(btn)};
        row.appendChild(btn);
      });
      results.appendChild(row);
    },400);
  };
}

async function selectGroup(id, name){
  selGroup=id;
  selGroupName=name;
  ls('group',id);
  ls('groupName',name);
  showLoadingState();
  await loadGroupSchedule(name);
  buildTodayWidget();
  updateFavBtn();
  showView('view-sched');
}

function showLoadingState(){
  const cont=$('sched-out');
  if(cont) cont.innerHTML=`<div class="empty"><div class="empty-ico">⏳</div>Загружаю расписание...</div>`;
}

async function loadGroupSchedule(groupName){
  if(loadingSchedule)return;
  loadingSchedule=true;
  try{
    const{start,end}=window.MGSU.getSemesterRange();
    const lessons=await window.MGSU.loadWeekSchedule(groupName,start,end);
    scheduleSlots=window.MGSU.lessonsToSlots(lessons);
    const today=getTodayName();
    const avail=DAYS.filter(d=>scheduleSlots[d]?.length);
    selDay=(today&&avail.includes(today))?today:(avail[0]||null);
    ls('day',selDay||'');
    buildDayTabs();
    renderSchedule();
  }catch(e){
    console.error('Ошибка загрузки:',e);
    const cont=$('sched-out');
    if(cont) cont.innerHTML=`<div class="empty"><div class="empty-ico">❌</div>Ошибка загрузки. Проверь подключение.</div>`;
  }finally{
    loadingSchedule=false;
  }
}

// ── Сброс ─────────────────────────────────────────

function resetSelection(){
  selGroup=null;selGroupName=null;selDay=null;
  scheduleSlots={};
  ls('group','');ls('groupName','');ls('day','');
  const input=$('group-search-input');
  const results=$('group-search-results');
  if(input) input.value='';
  if(results) results.innerHTML='<div class="empty" style="padding:20px 0"><div class="empty-ico" style="font-size:28px">🔍</div>Введи от 2 символов</div>';
  showView('view-home');
  showToast('Группа сброшена');
}

// ── Вкладки дней ──────────────────────────────────

window._updateDaySlider=function(){
  const bar=document.querySelector('.day-tabs');
  const active=bar&&bar.querySelector('.daytab.on');
  if(!bar||!active)return;
  const slider=bar.querySelector('.day-slider');
  if(!slider)return;
  const br=bar.getBoundingClientRect();
  const ar=active.getBoundingClientRect();
  slider.style.transform=`translateX(${ar.left-br.left}px)`;
  slider.style.width=`${ar.width}px`;
  active.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
};

document.addEventListener('click',e=>{
  if(e.target.closest('.daytab'))
    requestAnimationFrame(()=>requestAnimationFrame(window._updateDaySlider));
});

function getAvailDays(){
  return DAYS.filter(d=>scheduleSlots[d]?.length);
}

function switchDay(day){
  if(!day||day===selDay)return;
  selDay=day;ls('day',day);
  document.querySelectorAll('.daytab').forEach(t=>t.classList.toggle('on',t.dataset.day===day));
  renderSchedule();
  $('page').scrollTop=0;
  requestAnimationFrame(()=>requestAnimationFrame(window._updateDaySlider));
}

function buildDayTabs(){
  const bar=$('day-tabs');
  bar.innerHTML='';
  const ds=document.createElement('div');
  ds.className='day-slider';
  bar.prepend(ds);
  const today=getTodayName();

  let weekType='';
  for(const day of getAvailDays()){
    const slot=(scheduleSlots[day]||[])[0];
    if(slot?.weekType){weekType=slot.weekType;break;}
  }

  let weekBar=$('week-type-bar');
  if(!weekBar){
    weekBar=document.createElement('div');
    weekBar.id='week-type-bar';
    weekBar.style.cssText='font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;padding:0 2px';
    bar.parentNode.insertBefore(weekBar,bar.parentNode.firstChild);
  }
  if(weekType){
    weekBar.textContent=weekType+' неделя';
  } else {
    const now=new Date();
    const year=now.getMonth()>=8?now.getFullYear():now.getFullYear()-1;
    const sep1=new Date(year,8,1);
    const day=sep1.getDay();
    const firstMon=new Date(sep1);
    firstMon.setDate(sep1.getDate()+(day===1?0:day===0?1:8-day));
    const diffWeeks=Math.floor((now-firstMon)/(7*24*60*60*1000));
    weekBar.textContent=(diffWeeks%2===0?'Нечётная':'Чётная')+' неделя';
  }

  getAvailDays().forEach(day=>{
    const btn=document.createElement('button');
    const isToday=(day===today);
    const date=getDateForDay(day);
    btn.className='daytab'+(day===selDay?' on':'');
    btn.dataset.day=day;btn.title=day;
    btn.innerHTML=`<span style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <span>${DS[day]||day}${isToday?'<span class="today-dot"></span>':''}</span>
      <span style="font-size:9px;font-weight:600;opacity:.7">${date}</span>
    </span>`;
    btn.onclick=()=>{switchDay(day);bounce(btn)};
    bar.appendChild(btn);
  });
  setTimeout(()=>{if(window._updateDaySlider)window._updateDaySlider();},50);
}

// ── Свайп ─────────────────────────────────────────

(function initSwipe(){
  const page=$('page');if(!page)return;
  let tx=0,ty=0,swiping=false;
  page.addEventListener('touchstart',e=>{
    if(e.target.closest('.day-scroll-wrap'))return;
    tx=e.touches[0].clientX;ty=e.touches[0].clientY;swiping=true;
  },{passive:true});
  page.addEventListener('touchend',e=>{
    if(!swiping)return;swiping=false;
    const dx=e.changedTouches[0].clientX-tx;
    const dy=e.changedTouches[0].clientY-ty;
    const viewSched=$('view-sched');
    if(!viewSched||!viewSched.classList.contains('on'))return;
    if(Math.abs(dx)<50||Math.abs(dy)>Math.abs(dx))return;
    const avail=getAvailDays();
    const idx=avail.indexOf(selDay);
    if(dx<0&&idx<avail.length-1)switchDay(avail[idx+1]);
    if(dx>0&&idx>0)switchDay(avail[idx-1]);
  },{passive:true});
})();

// ── Рендер расписания ─────────────────────────────

function renderSchedule(){
  const cont=$('sched-out');
  if(!selGroup||!selDay){
    cont.innerHTML=`<div class="empty"><div class="empty-ico">📅</div>Выбери группу в разделе «Группы»</div>`;
    return;
  }
  const slots=(scheduleSlots[selDay]||[]);
  if(!slots.length){
    cont.innerHTML=`<div class="empty"><div class="empty-ico">🎉</div>В ${selDay} занятий нет</div>`;
    return;
  }

  const today=getTodayName();
  const isToday=(selDay===today);
  const currentPara=isToday?getCurrentParaIndex():-1;

  let nextPara=-1;
  if(isToday){
    const now=new Date();
    const total=now.getHours()*60+now.getMinutes();
    for(const slot of slots){
      const pt=PARA_TIMES[slot.para];if(!pt)continue;
      const[sh,sm]=pt.s.split(':').map(Number);
      if(sh*60+sm>total){nextPara=slot.para;break;}
    }
  }

  let html='';
  slots.forEach((slot,si)=>{
    const time=slot.time||'';
    const[t1,t2]=(time.includes('–')?time.split('–'):[time,'']).map(x=>x.trim());
    const isCurrent=(slot.para===currentPara);
    const isNext=(slot.para===nextPara&&!isCurrent);
    const cardClass=`lcard g${isCurrent?' lcard-current':''}${isNext?' lcard-next':''}`;

    html+=`<div class="${cardClass}" style="animation-delay:${si*35}ms">
      <div class="ltime">
        <div class="lnum">${slot.para}</div>
        <div class="ltm">${esc(t1)}<br>${esc(t2)}</div>
        ${isCurrent?'<div class="now-dot"></div>':''}
      </div>
      <div class="lbody">`;

    (slot.lessons||[]).forEach(l=>{
      let type=l.type||'лек';
      if(type==='крп'||String(l.subject).toLowerCase().startsWith('крп'))type='крп';
      html+=`<div class="li">
        <div class="ltags"><span class="tag ${TTAG[type]||'tt-l'}">${TWRD[type]||type}</span></div>
        <div class="lname">${esc(l.subject)}</div>
        ${l.teacher?`<div class="lmeta"><i class="fa-solid fa-user-tie lico"></i>${esc(l.teacher)}</div>`:''}
        ${l.room?`<div class="lmeta"><i class="fa-solid fa-door-open lico"></i>${esc(l.room)}</div>`:''}
        ${l.link?`<div class="lmeta"><i class="fa-solid fa-video lico"></i><a href="${esc(l.link)}" target="_blank">Онлайн</a></div>`:''}
      </div>`;
    });
    html+=`</div></div>`;
  });
  cont.innerHTML=html;

  if(isToday&&currentPara!==-1){
    setTimeout(()=>{
      const cur=cont.querySelector('.lcard-current');
      if(cur)cur.scrollIntoView({behavior:'smooth',block:'center'});
    },350);
  }
}

// ── Виджет «Сегодня» ──────────────────────────────

function buildTodayWidget(){
  const wrap=$('today-widget');
  if(!wrap||!selGroup)return;

  const today=getTodayName();
  const slots=(scheduleSlots[today]||[]);
  const currentPara=getCurrentParaIndex();
  const now=new Date();
  const total=now.getHours()*60+now.getMinutes();

  let nextSlot=null;
  for(const slot of slots){
    const pt=PARA_TIMES[slot.para];if(!pt)continue;
    const[sh,sm]=pt.s.split(':').map(Number);
    if(sh*60+sm>=total){nextSlot=slot;break;}
  }

  if(!nextSlot&&currentPara===-1){
    wrap.innerHTML=`<div class="widget-empty">На сегодня пар больше нет 🎉</div>`;
    wrap.style.display='block';return;
  }

  const slot=nextSlot||slots.find(s=>s.para===currentPara);
  if(!slot){wrap.style.display='none';return;}

  const pt=PARA_TIMES[slot.para];
  const isCurrent=(slot.para===currentPara);
  const l=(slot.lessons||[])[0];
  if(!l){wrap.style.display='none';return;}

  let type=l.type||'лек';
  if(type==='крп'||String(l.subject).toLowerCase().startsWith('крп'))type='крп';

  wrap.innerHTML=`
    <div class="widget-card g" onclick="goToToday()">
      <div class="widget-top">
        <span class="widget-label">${isCurrent?'🔴 Сейчас идёт':'⏰ Следующая пара'}</span>
        <span class="widget-time">${pt?pt.s+' – '+pt.e:slot.time||''}</span>
      </div>
      <div class="widget-name">${esc(l.subject)}</div>
      <div class="widget-meta">
        <span class="tag ${TTAG[type]||'tt-l'}">${TWRD[type]||type}</span>
        ${l.teacher?`<span class="widget-teacher">${esc(l.teacher)}</span>`:''}
        ${l.room?`<span class="widget-room"><i class="fa-solid fa-door-open" style="opacity:.5;font-size:11px"></i> ${esc(l.room)}</span>`:''}
      </div>
    </div>`;
  wrap.style.display='block';
}

function goToToday(){
  showView('view-sched');
  const today=getTodayName();
  if(today&&scheduleSlots[today]?.length){
    buildDayTabs();switchDay(today);
  }
}

// ── Поделиться ────────────────────────────────────

function shareSchedule(){
  if(!selGroupName||!selDay)return;
  const slots=(scheduleSlots[selDay]||[]);
  if(!slots.length)return;
  let text=`📅 ${selGroupName} — ${selDay}\n\n`;
  slots.forEach(slot=>{
    const pt=PARA_TIMES[slot.para];
    text+=`${slot.para}. ${pt?pt.s+' – '+pt.e:slot.time||''}\n`;
    (slot.lessons||[]).forEach(l=>{
      text+=`   ${l.subject}`;
      if(l.teacher)text+=` · ${l.teacher}`;
      if(l.room)text+=` · ${l.room}`;
      text+='\n';
    });
  });
  text+=`\nxoras.site`;
  if(navigator.share){
    navigator.share({title:`Расписание ${selGroupName}`,text}).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(text).then(()=>showToast('Скопировано')).catch(()=>{});
  }
}

// ── Поиск по расписанию ───────────────────────────

$('sinput').oninput=function(){
  const q=this.value.trim().toLowerCase();
  const res=$('search-out');
  if(q.length<2){
    res.innerHTML=`<div class="empty"><div class="empty-ico" style="font-size:38px">🔍</div>Начни вводить...</div>`;
    return;
  }
  if(scheduleSlots&&Object.keys(scheduleSlots).length){
    const hits=[];
    for(const[day,slots] of Object.entries(scheduleSlots)){
      for(const slot of slots){
        for(const l of(slot.lessons||[])){
          if([l.subject,l.teacher,l.room].join(' ').toLowerCase().includes(q)){
            hits.push({day,slot,l});
          }
        }
      }
    }
    if(hits.length){
      let html=`<div class="res-lbl">${hits.length} результатов</div>`;
      hits.slice(0,50).forEach(h=>{
        let type=h.l.type||'лек';
        html+=`<div class="lcard g" style="margin-bottom:8px">
          <div class="ltime">
            <div class="lnum">${h.slot.para}</div>
            <div class="ltm">${esc(DS[h.day]||h.day)}</div>
          </div>
          <div class="lbody"><div class="li">
            <div class="ltags"><span class="tag ${TTAG[type]||'tt-l'}">${TWRD[type]||type}</span></div>
            <div class="lname">${esc(h.l.subject)}</div>
            ${h.l.teacher?`<div class="lmeta"><i class="fa-solid fa-user-tie lico"></i>${esc(h.l.teacher)}</div>`:''}
            ${h.l.room?`<div class="lmeta"><i class="fa-solid fa-door-open lico"></i>${esc(h.l.room)}</div>`:''}
          </div></div></div>`;
      });
      res.innerHTML=html;
      return;
    }
  }
  res.innerHTML=`<div class="empty"><div class="empty-ico" style="font-size:38px">😔</div>Ничего не найдено</div>`;
};

// ── Toast ─────────────────────────────────────────

function showToast(msg){
  let t=document.querySelector('.toast');
  if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('on');
  setTimeout(()=>t.classList.remove('on'),2200);
}

// ── Dock slider ───────────────────────────────────

function updateSlider(){
  const dock=document.querySelector('.dock');
  const slider=document.querySelector('.dock-slider');
  const active=dock&&dock.querySelector('.db.on');
  if(!dock||!slider||!active)return;
  const dr=dock.getBoundingClientRect();
  const ar=active.getBoundingClientRect();
  slider.style.transform=`translateX(${ar.left-dr.left}px)`;
  slider.style.width=`${ar.width}px`;
}
(function(){
  const dock=document.querySelector('.dock');if(!dock)return;
  const slider=document.createElement('div');
  slider.className='dock-slider';
  Object.assign(slider.style,{
    position:'absolute',top:'6px',bottom:'6px',left:'0',width:'0',
    borderRadius:'22px',
    transition:'transform .28s cubic-bezier(.34,1.56,.64,1),width .28s cubic-bezier(.34,1.56,.64,1)',
    zIndex:'1',pointerEvents:'none',
  });
  dock.prepend(slider);
  window.addEventListener('resize',updateSlider);
})();

function updateWeekSlider(){
  const bar=document.querySelector('.week-bar');
  const slider=bar&&bar.querySelector('.week-slider');
  const active=bar&&bar.querySelector('.wt.on');
  if(!bar||!slider||!active)return;
  const br=bar.getBoundingClientRect();
  const ar=active.getBoundingClientRect();
  slider.style.transform=`translateX(${ar.left-br.left}px)`;
  slider.style.width=`${ar.width}px`;
}
(function(){
  const bar=document.querySelector('.week-bar');if(!bar)return;
  const slider=document.createElement('div');
  slider.className='week-slider';
  bar.prepend(slider);
  setTimeout(updateWeekSlider,120);
})();

// ── Init ──────────────────────────────────────────

(function init(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  if(lg('dark')==='1')setDark(true);
  document.documentElement.style.background=dark?'#06060b':'#eef0f6';

  const ai=Math.min(parseInt(lg('acc')||'0'),ACCENTS.length-1);
  applyAccent(ACCENTS[isNaN(ai)?0:ai]);
  setTimeout(()=>{swBox.querySelectorAll('.sw').forEach((s,i)=>s.classList.toggle('on',i===ai));},0);

  initGroupSearch();
  initHomeTabs();
  buildFavorites();

  const savedGroup=lg('group');
  const savedGroupName=lg('groupName');
  const savedDay=lg('day');

  if(savedGroup&&savedGroupName){
    selGroup=savedGroup;
    selGroupName=savedGroupName;
    loadGroupSchedule(savedGroupName).then(()=>{
      if(savedDay&&scheduleSlots[savedDay]) selDay=savedDay;
      buildDayTabs();
      renderSchedule();
      buildTodayWidget();
      updateFavBtn();
      showView('view-sched');
      setTimeout(updateSlider,100);
      setTimeout(updateWeekSlider,120);
      setTimeout(window._updateDaySlider,150);
    });
    return;
  }

  showView('view-home');
  setTimeout(updateSlider,100);
  setTimeout(updateWeekSlider,120);
})();
