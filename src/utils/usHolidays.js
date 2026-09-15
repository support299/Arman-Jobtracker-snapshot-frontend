/** US federal holidays (observed dates). Keys are local YYYY-MM-DD. */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toLocalDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function atLocalMidnight(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Saturday → Friday, Sunday → Monday (federal observed rule). */
function observeWeekend(date) {
  const d = atLocalMidnight(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const first = atLocalMidnight(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return atLocalMidnight(year, monthIndex, 1 + offset + (nth - 1) * 7);
}

function lastWeekdayOfMonth(year, monthIndex, weekday) {
  const last = atLocalMidnight(year, monthIndex + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return atLocalMidnight(year, monthIndex, last.getDate() - diff);
}

function rawFederalHolidays(year) {
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4);
  const dayAfter = atLocalMidnight(year, 10, thanksgiving.getDate() + 1);
  return [
    { date: atLocalMidnight(year, 0, 1), name: "New Year's Day", observe: true },
    { date: nthWeekdayOfMonth(year, 0, 1, 3), name: "Martin Luther King Jr. Day", observe: false },
    { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day", observe: false },
    { date: lastWeekdayOfMonth(year, 4, 1), name: "Memorial Day", observe: false },
    { date: atLocalMidnight(year, 5, 19), name: "Juneteenth", observe: true },
    { date: atLocalMidnight(year, 6, 4), name: "Independence Day", observe: true },
    { date: nthWeekdayOfMonth(year, 8, 1, 1), name: "Labor Day", observe: false },
    { date: nthWeekdayOfMonth(year, 9, 1, 2), name: "Columbus Day", observe: false },
    { date: atLocalMidnight(year, 10, 11), name: "Veterans Day", observe: true },
    { date: thanksgiving, name: "Thanksgiving", observe: false },
    { date: dayAfter, name: "Day after Thanksgiving", observe: false },
    { date: atLocalMidnight(year, 11, 25), name: "Christmas Day", observe: true },
  ];
}

const yearCache = new Map();

function holidaysObservedInYear(year) {
  if (yearCache.has(year)) return yearCache.get(year);
  const items = [];
  for (const sourceYear of [year - 1, year, year + 1]) {
    for (const holiday of rawFederalHolidays(sourceYear)) {
      const observed = holiday.observe ? observeWeekend(holiday.date) : holiday.date;
      if (observed.getFullYear() !== year) continue;
      const shifted = holiday.observe && !sameDay(observed, holiday.date);
      items.push({
        date: observed,
        name: shifted ? `${holiday.name} (observed)` : holiday.name,
      });
    }
  }
  yearCache.set(year, items);
  return items;
}

export function getUsHolidayMap(years) {
  const map = {};
  const list = years?.length ? years : [new Date().getFullYear()];
  for (const year of list) {
    for (const holiday of holidaysObservedInYear(year)) {
      const key = toLocalDateKey(holiday.date);
      map[key] = map[key] ? `${map[key]} · ${holiday.name}` : holiday.name;
    }
  }
  return map;
}

export function getUsHolidayName(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const map = getUsHolidayMap([d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1]);
  return map[toLocalDateKey(d)] || "";
}
