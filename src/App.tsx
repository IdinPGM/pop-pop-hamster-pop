import { memo, useCallback, useEffect, useRef, useState } from "react";

type Stage = "intro" | "countdown" | "playing" | "transition" | "chest" | "opening" | "reward";
type Color = "red" | "yellow" | "green";
type Hamster = { id: number; color: Color; dull: boolean; x: number; size: number; duration: number; expiresAt: number };
type PopFeedback = { id: number; value: number; x: number; y: number; targetX: number; targetY: number; color: Color };

const GAME_SECONDS = 15;
const points: Record<Color, number> = { red: 1, yellow: 2, green: 3 };
const DECOY_PENALTY = -3;

function tone(frequency: number, duration = 0.1) {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  osc.onended = () => void ctx.close();
}

function explosion() {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const duration = .58;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.4);

  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(950, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + duration);
  noiseGain.gain.setValueAtTime(.28, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
  noise.connect(filter).connect(noiseGain).connect(ctx.destination);

  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(95, ctx.currentTime);
  boom.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + .42);
  boomGain.gain.setValueAtTime(.22, ctx.currentTime);
  boomGain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .48);
  boom.connect(boomGain).connect(ctx.destination);
  noise.start();
  boom.start();
  noise.stop(ctx.currentTime + duration);
  boom.stop(ctx.currentTime + .5);
  noise.onended = () => void ctx.close();
}

function Clouds() {
  return <div className="clouds" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ "--i": i } as React.CSSProperties} />)}</div>;
}

const HamsterBalloon = memo(function HamsterBalloon({ hamster, onPop, onExpire }: {
  hamster: Hamster;
  onPop: (h: Hamster, x: number, y: number) => void;
  onExpire: (id: number) => void;
}) {
  const popFromCenter = (button: HTMLButtonElement) => {
    const box = button.getBoundingClientRect();
    onPop(hamster, box.left + box.width / 2, box.top + box.height / 2);
  };

  return (
    <button
      className="hamster-hit"
      style={{
        "--x": `${hamster.x}%`,
        "--balloon-size": `${hamster.size}px`,
        "--rise-duration": `${hamster.duration}s`,
      } as React.CSSProperties}
      onPointerDown={(event) => {
        event.preventDefault();
        onPop(hamster, event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          popFromCenter(event.currentTarget);
        }
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "balloon-rise") onExpire(hamster.id);
      }}
      aria-label={hamster.dull ? "ตัวหลอก ลบสามคะแนน" : `แฮมสเตอร์สี${hamster.color}`}
    >
      <span className={`hamster ${hamster.color} ${hamster.dull ? "dull" : ""}`} aria-hidden="true">
        <i className="ear left" /><i className="ear right" /><i className="eye left" /><i className="eye right" />
        <i className="nose" /><i className="cheek left" /><i className="cheek right" /><i className="knot" />
      </span>
    </button>
  );
});

export default function App() {
  const [stage, setStage] = useState<Stage>("intro");
  const [countdown, setCountdown] = useState(3);
  const [time, setTime] = useState(GAME_SECONDS);
  const [score, setScore] = useState(0);
  const [hamsters, setHamsters] = useState<Hamster[]>([]);
  const [feedbacks, setFeedbacks] = useState<PopFeedback[]>([]);
  const [scorePulse, setScorePulse] = useState(false);
  const [sound, setSound] = useState(true);
  const [bgmStarted, setBgmStarted] = useState(false);
  const id = useRef(0);
  const gameEndsAt = useRef(0);
  const scoreRef = useRef<HTMLDivElement>(null);
  const popPool = useRef<HTMLAudioElement[]>([]);
  const popCursor = useRef(0);
  const bgmAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => bgmAudio.current?.pause();
  }, []);

  useEffect(() => {
    const bgm = bgmAudio.current;
    if (!bgm) return;
    if (sound && bgmStarted) void bgm.play().catch(() => undefined);
    else bgm.pause();
  }, [bgmStarted, sound, stage]);

  useEffect(() => {
    if (!bgmAudio.current) return;
    bgmAudio.current.playbackRate = stage === "playing" && time <= 5 ? 1.12 : 1;
  }, [stage, time]);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown === 0) {
      if (sound) tone(880, 0.25);
      const timer = window.setTimeout(() => setStage("playing"), 450);
      return () => clearTimeout(timer);
    }
    if (sound) tone(440);
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 700);
    return () => clearTimeout(timer);
  }, [countdown, sound, stage]);

  useEffect(() => {
    if (stage !== "playing") return;
    gameEndsAt.current = performance.now() + GAME_SECONDS * 1000;
    setTime(GAME_SECONDS);
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((gameEndsAt.current - performance.now()) / 1000));
      setTime((current) => current === remaining ? current : remaining);
    }, 200);
    const spawn = window.setInterval(() => {
      const colors: Color[] = ["red", "yellow", "green"];
      const duration = 3.6 + Math.random() * 1.5;
      const hamster: Hamster = {
        id: ++id.current,
        color: colors[Math.floor(Math.random() * colors.length)],
        dull: Math.random() < 0.28,
        x: 5 + Math.random() * 82,
        size: 74 + Math.random() * 34,
        duration,
        expiresAt: Date.now() + duration * 1000,
      };
      const now = Date.now();
      setHamsters((items) => [...items.filter((item) => item.expiresAt > now).slice(-11), hamster]);
    }, 430);
    return () => { clearInterval(tick); clearInterval(spawn); };
  }, [stage]);

  useEffect(() => {
    if (stage === "playing" && time <= 0) {
      setHamsters([]);
      setStage("transition");
      if (sound) tone(220, 0.5);
    }
  }, [sound, stage, time]);

  useEffect(() => {
    if (stage === "playing" && time === 5 && sound) tone(660, .18);
  }, [sound, stage, time]);

  useEffect(() => {
    if (stage !== "transition") return;
    const timer = window.setTimeout(() => setStage("chest"), 1200);
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "opening") return;
    if (sound) {
      tone(180, .45);
      window.setTimeout(explosion, 600);
      window.setTimeout(() => tone(760, .7), 650);
      window.setTimeout(() => tone(1120, .8), 950);
    }
    const timer = window.setTimeout(() => setStage("reward"), 2300);
    return () => clearTimeout(timer);
  }, [sound, stage]);

  const prepareAudio = () => {
    if (!popPool.current.length) {
      popPool.current = Array.from({ length: 5 }, () => {
        const audio = new Audio(`${import.meta.env.BASE_URL}audio/options/pop-light.ogg`);
        audio.preload = "auto";
        audio.volume = 0.7;
        return audio;
      });
    }
    if (!bgmAudio.current) {
      const bgm = new Audio(`${import.meta.env.BASE_URL}audio/happy-adventure.mp3`);
      bgm.preload = "auto";
      bgm.loop = true;
      bgm.volume = 0.48;
      bgmAudio.current = bgm;
    }
  };
  const start = () => { prepareAudio(); setBgmStarted(true); if (sound && bgmAudio.current) void bgmAudio.current.play().catch(() => undefined); setCountdown(3); setStage("countdown"); };
  const restart = () => { if (bgmAudio.current) bgmAudio.current.currentTime = 0; setScore(0); setTime(GAME_SECONDS); setHamsters([]); setFeedbacks([]); setCountdown(3); id.current = 0; setStage("intro"); };
  const expireHamster = useCallback((hamsterId: number) => {
    setHamsters((items) => items.filter((hamster) => hamster.id !== hamsterId));
  }, []);

  const pop = useCallback((hamster: Hamster, x: number, y: number) => {
    setHamsters((items) => items.filter((h) => h.id !== hamster.id));
    const value = hamster.dull ? DECOY_PENALTY : points[hamster.color];
    setScore((current) => Math.max(0, current + value));
    const scoreBox = scoreRef.current?.getBoundingClientRect();
    setFeedbacks((items) => [...items.slice(-4), {
      id: hamster.id,
      value,
      x,
      y,
      targetX: scoreBox ? scoreBox.left + scoreBox.width / 2 : window.innerWidth - 90,
      targetY: scoreBox ? scoreBox.top + scoreBox.height / 2 : 45,
      color: hamster.color,
    }]);
    if (sound && popPool.current.length) {
      const audio = popPool.current[popCursor.current++ % popPool.current.length];
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    }
  }, [sound]);

  return (
    <main className={`game stage-${stage}`}>
      <Clouds />
      <button className="sound" onClick={() => setSound((v) => !v)} aria-label="เปิดหรือปิดเสียง">{sound ? "♪" : "×"}</button>
        {stage === "intro" && (
          <section className="card intro">
            <div className="logo-hamster">🐹</div>
            <p className="eyebrow">READY TO POP?</p>
            <h1>POP POP<br/><span>HAMSTER POP!</span></h1>
            <div className="story">
              <div className="speech">ฉันกำลังตามหา <strong>Golden Ticket!</strong><br/>ช่วยจิ้มลูกโป่งเก็บคะแนนให้มากที่สุด แล้วไปเปิดหีบสมบัติกัน!</div>
              <div className="story-hamster" aria-hidden="true">🐹</div>
            </div>
            <div className="legend"><span className="dot red">+1</span><span className="dot yellow">+2</span><span className="dot green">+3</span><span className="dot gray">−3</span></div>
            <button className="primary" onClick={start}>START PLAYING</button>
          </section>
        )}
        {stage === "countdown" && <div className="countdown" key={countdown}>{countdown || "GO!"}</div>}
        {stage === "playing" && (
          <section className={`playfield stage-enter ${time <= 5 ? "final-rush" : ""}`}>
            <header><div className="timer"><strong>⏱ {time}</strong><span><i style={{ width: `${(time / GAME_SECONDS) * 100}%` }} /></span></div><div ref={scoreRef} className={`score ${scorePulse ? "pulse" : ""}`}>SCORE <b>{score}</b></div></header>
            {time <= 5 && <div className="hurry">HURRY!</div>}
            {hamsters.map((h) => <HamsterBalloon key={h.id} hamster={h} onPop={pop} onExpire={expireHamster} />)}
          </section>
        )}
        {stage === "transition" && <div className="whoosh"><span/><span/><span/></div>}
        {stage === "chest" && (
          <section className="chest-scene stage-enter-up">
            <p>แตะเพื่อเปิดรางวัล!</p>
            <button className="chest" onClick={() => setStage("opening")} aria-label="เปิดหีบสมบัติ"><span className="lid"/><span className="box">★</span></button>
            <div className="cloud-platform" />
          </section>
        )}
        {stage === "opening" && (
          <section className="opening-scene">
            <div className="opening-rays" />
            <div className="opening-flash" />
            <div className="magic-beam" />
            <div className="opening-chest">
              <span className="lid" />
              <span className="box">★</span>
            </div>
            <div className="magic-particles">{Array.from({ length: 56 }, (_, i) => <i key={i} style={{ "--x": `${3 + (i * 37) % 94}%`, "--y": `${7 + (i * 53) % 84}%`, "--size": `${13 + (i % 4) * 7}px`, "--delay": `${i * -.037}s` } as React.CSSProperties}>{i % 3 ? "✦" : "★"}</i>)}</div>
            <div className="burst-particles">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ "--angle": `${i * 12}deg`, "--travel": `${-150 - (i % 6) * 34}px`, "--delay": `${.58 + (i % 5) * .018}s` } as React.CSSProperties} />)}</div>
            <div className="magic-ring" />
            <div className="magic-ring ring-two" />
            <div className="treasure-star">★</div>
          </section>
        )}
        {stage === "reward" && (
          <section className="reward stage-enter">
            <h2>Congratulation</h2>
            <div className="rays" />
            <div className="ticket-wrap">
              <div className="ticket"><small>YOU GOT A</small><strong>GOLDEN TICKET</strong><span>FINAL SCORE {score}</span></div>
              <div className="ticket-sparkles">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties}>✦</i>)}</div>
            </div>
            <a className="primary" href="#register">REGISTER NOW</a>
            <button className="secondary" onClick={restart}>↻ PLAY AGAIN</button>
          </section>
        )}
      {feedbacks.map((feedback) => (
        <div className={`pop-feedback ${feedback.color}`} style={{ left: feedback.x, top: feedback.y }} key={feedback.id}>
          <span className="pop-ring" />
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
          <b
            style={{ "--dx": `${feedback.targetX - feedback.x}px`, "--dy": `${feedback.targetY - feedback.y}px` } as React.CSSProperties}
            onAnimationEnd={() => { setFeedbacks((items) => items.filter((item) => item.id !== feedback.id)); setScorePulse(true); window.setTimeout(() => setScorePulse(false), 250); }}
          >{feedback.value > 0 ? `+${feedback.value}` : feedback.value}</b>
        </div>
      ))}
      <footer>HAMSTERHUB</footer>
    </main>
  );
}
