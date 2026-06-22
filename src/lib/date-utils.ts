/**
 * Calculates UTC date range (start and end) for a given date parameter and timezone offset in minutes.
 * @param dateParam format: YYYY-MM-DD
 * @param offsetMinutesParam timezone offset in minutes (e.g. from new Date().getTimezoneOffset())
 */
export function getUtcBounds(dateParam: string, offsetMinutesParam: string | null): { dateStart: string; dateEnd: string } {
  const offsetMinutes = offsetMinutesParam ? parseInt(offsetMinutesParam, 10) : 0;
  const [year, month, day] = dateParam.split('-').map(Number);
  
  const utcStartBase = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const utcStart = new Date(utcStartBase + offsetMinutes * 60 * 1000);
  
  const utcEndBase = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const utcEnd = new Date(utcEndBase + offsetMinutes * 60 * 1000);
  
  return {
    dateStart: utcStart.toISOString(),
    dateEnd: utcEnd.toISOString()
  };
}

/**
 * Calculates UTC date range (start and end) for a given start/end date parameter and timezone offset.
 */
export function getUtcRangeBounds(
  startDateParam: string,
  endDateParam: string,
  offsetMinutesParam: string | null
): { dateStart: string; dateEnd: string } {
  const offsetMinutes = offsetMinutesParam ? parseInt(offsetMinutesParam, 10) : 0;
  
  const [sYear, sMonth, sDay] = startDateParam.split('-').map(Number);
  const utcStartBase = Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
  const utcStart = new Date(utcStartBase + offsetMinutes * 60 * 1000);
  
  const [eYear, eMonth, eDay] = endDateParam.split('-').map(Number);
  const utcEndBase = Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
  const utcEnd = new Date(utcEndBase + offsetMinutes * 60 * 1000);
  
  return {
    dateStart: utcStart.toISOString(),
    dateEnd: utcEnd.toISOString()
  };
}
