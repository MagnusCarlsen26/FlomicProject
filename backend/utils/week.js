const IST_TIME_ZONE = 'Asia/Kolkata';

function formatDateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getIsoWeekStringFromDate(date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekFromMondayDate(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  return {
    key: formatDateKey(weekStart),
    startDate: formatDateKey(weekStart),
    endDate: formatDateKey(weekEnd),
    weekStartDateUtc: weekStart,
    weekEndDateUtc: weekEnd,
    isoWeek: getIsoWeekStringFromDate(weekStart),
    timezone: IST_TIME_ZONE,
  };
}

function getWeekParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      values[part.type] = part.value;
    }
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const localMidnightUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayOfWeek = localMidnightUtc.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(localMidnightUtc);
  weekStart.setUTCDate(localMidnightUtc.getUTCDate() + mondayOffset);

  return weekFromMondayDate(weekStart);
}

function getWeekFromKey(weekKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey || '')) {
    return null;
  }

  const [year, month, day] = weekKey.split('-').map(Number);
  const weekStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  if (Number.isNaN(weekStart.getTime())) {
    return null;
  }

  if (formatDateKey(weekStart) !== weekKey) {
    return null;
  }

  return weekFromMondayDate(weekStart);
}

function getWeekFromIsoWeek(isoWeek) {
  if (!/^\d{4}-W\d{2}$/.test(isoWeek || '')) {
    return null;
  }

  const [yearPart, weekPart] = isoWeek.split('-W');
  const year = Number(yearPart);
  const weekNumber = Number(weekPart);

  if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    return null;
  }

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const isoWeek1Monday = addDays(jan4, 1 - jan4Day);
  const weekStart = addDays(isoWeek1Monday, (weekNumber - 1) * 7);

  return weekFromMondayDate(weekStart);
}

function resolveWeekFromQuery(weekQuery) {
  if (typeof weekQuery !== 'string' || !weekQuery.trim()) {
    return getWeekParts();
  }

  const trimmed = weekQuery.trim();
  return getWeekFromIsoWeek(trimmed) || getWeekFromKey(trimmed) || null;
}

module.exports = {
  IST_TIME_ZONE,
  formatDateKey,
  getIsoWeekStringFromDate,
  getWeekParts,
  getWeekFromIsoWeek,
  getWeekFromKey,
  resolveWeekFromQuery,
};
