export function beep(times = 3) {
  const ctx = new AudioContext();
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + i * 0.3;
    osc.start(start);
    osc.stop(start + 0.18);
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function alertUser(title, body) {
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
