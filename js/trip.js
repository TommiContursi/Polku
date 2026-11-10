// The trip's times (#956): every time on a route counts from one start, the minute it was timed from (`a.start`, set
// by the planner each time it times the route), with the wind's times once the forecast is in. Go, the list, the
// cards, the days, the profile, the warnings and the GPX all read them here, so they never disagree.
import { tripDays, isNight, nightsWord } from './stops.js';

// a clock time, "13:40"
export const timeOf = (sec) => new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// a day in words, as the phone's language writes it ("Sat 31 Oct"); `near`: "Today, …" and "Tomorrow, …" too
export function dayOf(sec, near = false) {
  const d = new Date(sec * 1000), day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const ahead = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  return near && ahead === 0 ? `Today, ${day}` : near && ahead === 1 ? `Tomorrow, ${day}` : day;
}

const sameDay = (s, t) => new Date(s * 1000).toDateString() === new Date(t * 1000).toDateString();

// a time on a trip that leaves at `start`: "13:40", with the day when it isn't the day you leave ("Thu 08:00")
export const clockOf = (sec, start) => (sameDay(sec, start) ? timeOf(sec) : `${new Date(sec * 1000).toLocaleDateString([], { weekday: 'short' })} ${timeOf(sec)}`);

// the analysis sample at m metres along (1 m short of it counts as there)
export function sampleAt(a, m) {
  let i = 0;
  while (i < a.along.length - 1 && a.along[i] < m - 1) i++;
  return i;
}

/**
 * The times of a timed analysis, or null before it's timed: { start, end, tAt, at(i), arrive(m), days(), clock(sec),
 * planned(along) }, epoch seconds but `tAt`, the seconds from the start at each sample. `at(i)`: when you're at sample i; `arrive(m)`: when you reach m metres along,
 * before any wait there; `planned(along)`: each waypoint's planned times in words for the GPX, `along` their metres.
 */
export function tripTimes(a) {
  const tAt = a && (a.tAtWind || a.tAt);
  if (!tAt || a.start == null) return null;
  const start = a.start, at = (i) => start + tAt[i], waits = a.waits || [];
  const arrive = (m) => { if (m <= 0) return start; const k = sampleAt(a, m); return at(k) - (a.waitAt ? a.waitAt[k] : 0); };
  return {
    start, end: at(a.along.length - 1), tAt, at, arrive,
    days: () => tripDays(a, tAt, start, waits),
    clock: (sec) => clockOf(sec, start),
    // "Leave Sat 31 Oct, 07:30", "There at 09:12", "There at 18:40. Night, go on Sun 1 Nov, 07:00" (#364's C). None go
    // on the track's points: apps such as Strava read a GPX with times as a recorded activity.
    planned: (along) => {
      const when = (sec) => (sameDay(sec, start) ? timeOf(sec) : `${dayOf(sec)}, ${timeOf(sec)}`);
      return along.map((m, i) => {
        if (i === 0) return `Leave ${dayOf(start)}, ${timeOf(start)}`;
        const w = waits.find((x) => x.i === i && x.stop), go = w && w.arrive + w.sec;
        return [`There at ${when(arrive(m))}`, w ? (isNight(w.stop) ? `${nightsWord(w.stop)}, go on ${dayOf(go)}, ${timeOf(go)}` : `Stop ${w.stop.min} min, go on at ${when(go)}`) : ''].filter(Boolean).join('. ');
      });
    },
  };
}
