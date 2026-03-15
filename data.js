// ▼▼▼ URL Cloudflare Worker ▼▼▼
const API = 'const API = 'https://rough-feather-213e.gsoft8161.workers.dev';';

// Типы занятий из API МГСУ
const KIND_MAP = {
  'л.':  'лек',
  'пр.': 'пр',
  'лаб.':'лаб',
  'к.р.':'крп',
  'КРП': 'крп',
};

// Номер пары по времени начала
const TIME_TO_PARA = {
  '08': 1, '10': 2, '11': 3,
  '13': 4, '14': 5, '16': 6, '17': 7,
};

let D = {
  groups: [],
  schedule: {},
  days: ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
};

// Кэш загруженных недель: 'ГРУППА_дд.мм.гггг_дд.мм.гггг' → данные
const scheduleCache = {};

// ── Вспомогательные функции ───────────────────────

function getParaNum(time) {
  if (!time) return 0;
  const h = time.slice(0, 2);
  return TIME_TO_PARA[h] || 0;
}

function getKindType(abbr) {
  if (!abbr) return 'лек';
  const clean = abbr.trim().toLowerCase();
  for (const [key, val] of Object.entries(KIND_MAP)) {
    if (clean === key.toLowerCase()) return val;
  }
  if (clean.includes('лаб')) return 'лаб';
  if (clean.includes('пр'))  return 'пр';
  if (clean.includes('крп') || clean.includes('к.р')) return 'крп';
  return 'лек';
}

// Получить понедельник и воскресенье текущей недели
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: formatDate(mon), end: formatDate(sun) };
}

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

function formatDateFull(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// Получить даты 4 недель вперёд и назад от сегодня
function getSemesterRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 28);
  const end = new Date(now);
  end.setDate(now.getDate() + 56);
  return { start: formatDateFull(start), end: formatDateFull(end) };
}

// ── Загрузка групп ────────────────────────────────

async function searchGroups(query) {
  try {
    const r = await fetch(`${API}/groups?q=${encodeURIComponent(query)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return (data.results || []).map(g => ({
      id: g.id || g.text,
      text: g.text || g.id,
    }));
  } catch (e) {
    console.error('Ошибка поиска групп:', e.message);
    return [];
  }
}

async function searchLecturers(query) {
  try {
    const r = await fetch(`${API}/lecturers?q=${encodeURIComponent(query)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return (data.results || []).map(l => ({
      id: l.id || l.text,
      text: l.text || l.id,
    }));
  } catch (e) {
    console.error('Ошибка поиска преподавателей:', e.message);
    return [];
  }
}

// ── Загрузка расписания ───────────────────────────

async function loadWeekSchedule(groupName, startDate, endDate) {
  const cacheKey = `${groupName}_${startDate}_${endDate}`;
  if (scheduleCache[cacheKey]) return scheduleCache[cacheKey];

  try {
    const r = await fetch(`${API}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: groupName, start_date: startDate, end_date: endDate })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    scheduleCache[cacheKey] = lessons;
    return lessons;
  } catch (e) {
    console.error('Ошибка загрузки расписания:', e.message);
    return [];
  }
}

// Преобразовать уроки из API в формат приложения
function lessonsToSlots(lessons) {
  // Группируем по дням
  const byDay = {};
  for (const l of lessons) {
    const dayName = capitalize(l.day_name || '');
    if (!dayName) continue;
    if (!byDay[dayName]) byDay[dayName] = {};

    const para = getParaNum(l.lesson_time);
    if (!para) continue;

    if (!byDay[dayName][para]) {
      byDay[dayName][para] = {
        para,
        time: l.lesson_time ? l.lesson_time.replace(' - ', '–') : '',
        date: l.lesson_date || '',
        lessons: []
      };
    }

    byDay[dayName][para].lessons.push({
      subject: l.discipline || '',
      teacher: l.lecturer || '',
      room: l.aud_name || '',
      type: getKindType(l.kind_abbr),
      groups: l.group_name || '',
      link: l.link || null,
    });
  }

  // Конвертируем в массив слотов отсортированных по номеру пары
  const result = {};
  for (const [day, paras] of Object.entries(byDay)) {
    result[day] = Object.values(paras).sort((a, b) => a.para - b.para);
  }
  return result;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ── Основная функция инициализации ───────────────

async function initSchedule(groupName) {
  const { start, end } = getSemesterRange();
  const lessons = await loadWeekSchedule(groupName, start, end);
  if (!lessons.length) return null;

  const slots = lessonsToSlots(lessons);

  // Определяем тип недели из первого урока
  const typeWeek = lessons[0]?.type_week || '';

  return { slots, typeWeek, groupName };
}

// Экспортируем глобально для app.js
window.MGSU = {
  searchGroups,
  searchLecturers,
  loadWeekSchedule,
  lessonsToSlots,
  initSchedule,
  getSemesterRange,
  formatDate,
  formatDateFull,
  getCurrentWeekRange,
};

console.log('✅ data.js загружен, API:', API);
