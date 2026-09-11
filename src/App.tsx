import { AnimatePresence, motion } from "framer-motion";
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

const HamsterBalloon = memo(function HamsterBalloon({ hamster, onPop }: { hamster: Hamster; onPop: (h: Hamster, box: DOMRect) => void }) {
  return (
    <motion.button
      className={`hamster ${hamster.color} ${hamster.dull ? "dull" : ""}`}
      style={{ left: `${hamster.x}%`, width: hamster.size, height: hamster.size }}
      initial={{ y: "115vh", rotate: -5 }}
      animate={{ y: "-28vh", rotate: 5 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        y: { duration: hamster.duration, ease: "linear" },
        rotate: { repeat: Infinity, repeatType: "reverse", duration: 0.7 },
        scale: { duration: 0.12 },
        opacity: { duration: 0.12 },
      }}
      onClick={(event) => onPop(hamster, event.currentTarget.getBoundingClientRect())}
      aria-label={hamster.dull ? "ตัวหลอก ลบสามคะแนน" : `แฮมสเตอร์สี${hamster.color}`}
    >
      <i className="ear left" /><i className="ear right" /><i className="eye left" /><i className="eye right" />
      <i className="nose" /><i className="cheek left" /><i className="cheek right" /><i className="knot" />
    </motion.button>
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
  const scoreRef = useRef<HTMLDivElement>(null);
  const popAudio = useRef<HTMLAudioElement | null>(null);
  const bgmAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    popAudio.current = new Audio(`${import.meta.env.BASE_URL}audio/options/pop-light.ogg`);
    popAudio.current.preload = "auto";
    popAudio.current.volume = 0.7;
    bgmAudio.current = new Audio(`${import.meta.env.BASE_URL}audio/happy-adventure.mp3`);
    bgmAudio.current.preload = "auto";
    bgmAudio.current.loop = true;
    bgmAudio.current.volume = 0.48;
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
    const tick = window.setInterval(() => setTime((n) => n - 1), 1000);
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
      setHamsters((items) => [...items.filter((item) => item.expiresAt > now).slice(-10), hamster]);
    }, 450);
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

  const start = () => { setBgmStarted(true); if (sound && bgmAudio.current) void bgmAudio.current.play().catch(() => undefined); setCountdown(3); setStage("countdown"); };
  const restart = () => { if (bgmAudio.current) bgmAudio.current.currentTime = 0; setScore(0); setTime(GAME_SECONDS); setHamsters([]); setFeedbacks([]); setCountdown(3); id.current = 0; setStage("intro"); };
  const pop = useCallback((hamster: Hamster, box: DOMRect) => {
    setHamsters((items) => items.filter((h) => h.id !== hamster.id));
    const value = hamster.dull ? DECOY_PENALTY : points[hamster.color];
    setScore((current) => Math.max(0, current + value));
    const scoreBox = scoreRef.current?.getBoundingClientRect();
    setFeedbacks((items) => [...items, {
      id: hamster.id,
      value,
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      targetX: scoreBox ? scoreBox.left + scoreBox.width / 2 : window.innerWidth - 90,
      targetY: scoreBox ? scoreBox.top + scoreBox.height / 2 : 45,
      color: hamster.color,
    }]);
    if (sound && popAudio.current) {
      const audio = popAudio.current.cloneNode() as HTMLAudioElement;
      audio.volume = 0.7;
      void audio.play().catch(() => undefined);
    }
  }, [sound]);

  return (
    <main className={`game stage-${stage}`}>
      <Clouds />
      <button className="sound" onClick={() => setSound((v) => !v)} aria-label="เปิดหรือปิดเสียง">{sound ? "♪" : "×"}</button>
      <AnimatePresence mode="wait">
        {stage === "intro" && (
          <motion.section className="card intro" key="intro" initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
            <div className="logo-hamster">🐹</div>
            <p className="eyebrow">READY TO POP?</p>
            <h1>POP POP<br/><span>HAMSTER POP!</span></h1>
            <div className="story">
              <div className="speech">ฉันกำลังตามหา <strong>Golden Ticket!</strong><br/>ช่วยจิ้มลูกโป่งเก็บคะแนนให้มากที่สุด แล้วไปเปิดหีบสมบัติกัน!</div>
              <motion.div className="story-hamster" initial={{ x: 80, rotate: 8 }} animate={{ x: 0, rotate: [8, -4, 3] }} transition={{ type: "spring", duration: .8 }} aria-hidden="true">🐹</motion.div>
            </div>
            <div className="legend"><span className="dot red">+1</span><span className="dot yellow">+2</span><span className="dot green">+3</span><span className="dot gray">−3</span></div>
            <button className="primary" onClick={start}>START PLAYING</button>
          </motion.section>
        )}
        {stage === "countdown" && <motion.div className="countdown" key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .4, opacity: 0 }}>{countdown || "GO!"}</motion.div>}
        {stage === "playing" && (
          <motion.section className={`playfield ${time <= 5 ? "final-rush" : ""}`} key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <header><div className="timer"><strong>⏱ {time}</strong><span><i style={{ width: `${(time / GAME_SECONDS) * 100}%` }} /></span></div><motion.div ref={scoreRef} className="score" animate={{ scale: scorePulse ? [1, 1.18, 1] : 1 }}>SCORE <b>{score}</b></motion.div></header>
            <AnimatePresence>{time <= 5 && <motion.div className="hurry" initial={{ scale: .5, opacity: 0 }} animate={{ scale: [1, 1.08, 1], opacity: 1 }} exit={{ opacity: 0 }} transition={{ scale: { repeat: Infinity, duration: .55 } }}>HURRY!</motion.div>}</AnimatePresence>
            <AnimatePresence>{hamsters.map((h) => <HamsterBalloon key={h.id} hamster={h} onPop={pop} />)}</AnimatePresence>
          </motion.section>
        )}
        {stage === "transition" && <motion.div className="whoosh" key="transition" initial={{ y: "100vh" }} animate={{ y: "-100vh" }} transition={{ duration: 1.2, ease: "easeIn" }}><span/><span/><span/></motion.div>}
        {stage === "chest" && (
          <motion.section className="chest-scene" key="chest" initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}>
            <p>แตะเพื่อเปิดรางวัล!</p>
            <motion.button className="chest" whileHover={{ scale: 1.05 }} whileTap={{ rotate: [-5, 5, -5, 5, 0] }} onClick={() => setStage("opening")} aria-label="เปิดหีบสมบัติ"><span className="lid"/><span className="box">★</span></motion.button>
            <div className="cloud-platform" />
          </motion.section>
        )}
        {stage === "opening" && (
          <motion.section className="opening-scene" key="opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="opening-rays" initial={{ scale: .2, rotate: -30, opacity: 0 }} animate={{ scale: 1.8, rotate: 25, opacity: [0, 1, .75] }} transition={{ delay: .5, duration: 1.5 }} />
            <motion.div className="opening-flash" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, .8, 2.4], opacity: [0, 1, 0] }} transition={{ delay: .55, duration: 1.15 }} />
            <motion.div className="magic-beam" initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0, 1, 1], opacity: [0, 1, .8] }} transition={{ delay: .55, duration: .8 }} />
            <motion.div className="opening-chest" animate={{ x: [0, -2, 3, -5, 7, -9, 10, -7, 5, 0], y: [0, 0, -2, 1, -4, 2, -7, 0] }} transition={{ duration: 1.05, ease: "easeIn" }}>
              <motion.span className="lid" animate={{ rotate: [0, 0, -32], y: [0, 0, -28] }} transition={{ duration: 1.15, times: [0, .62, 1] }} />
              <span className="box">★</span>
            </motion.div>
            <div className="magic-particles">{Array.from({ length: 56 }, (_, i) => <i key={i} style={{ "--x": `${3 + (i * 37) % 94}%`, "--y": `${7 + (i * 53) % 84}%`, "--size": `${13 + (i % 4) * 7}px`, "--delay": `${i * -.037}s` } as React.CSSProperties}>{i % 3 ? "✦" : "★"}</i>)}</div>
            <div className="burst-particles">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ "--angle": `${i * 12}deg`, "--travel": `${-150 - (i % 6) * 34}px`, "--delay": `${.58 + (i % 5) * .018}s` } as React.CSSProperties} />)}</div>
            <motion.div className="magic-ring" initial={{ scale: .2, opacity: 0 }} animate={{ scale: 2.8, opacity: [0, 1, 0] }} transition={{ delay: .7, duration: .9 }} />
            <motion.div className="magic-ring ring-two" initial={{ scale: .1, opacity: 0 }} animate={{ scale: 4, opacity: [0, .8, 0] }} transition={{ delay: .95, duration: 1.05 }} />
            <motion.div className="treasure-star" initial={{ y: 80, scale: 0, opacity: 0 }} animate={{ y: -180, scale: [0, 1.8, 1], rotate: [0, 160, 220], opacity: [0, 1, 1] }} transition={{ delay: .75, duration: 1.25 }}>★</motion.div>
          </motion.section>
        )}
        {stage === "reward" && (
          <motion.section className="reward" key="reward" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.h2 initial={{ y: -35, scale: .8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", delay: .05 }}>Congratulation</motion.h2>
            <div className="rays" />
            <motion.div className="ticket-wrap" initial={{ y: -200, rotate: -10, scale: .5, opacity: 0 }} animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", delay: .15 }}>
              <motion.div className="ticket" animate={{ y: [0, -8, 0], rotate: [-1, 1, -1] }} transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}><small>YOU GOT A</small><strong>GOLDEN TICKET</strong><span>FINAL SCORE {score}</span></motion.div>
              <div className="ticket-sparkles">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties}>✦</i>)}</div>
            </motion.div>
            <a className="primary" href="#register">REGISTER NOW</a>
            <button className="secondary" onClick={restart}>↻ PLAY AGAIN</button>
          </motion.section>
        )}
      </AnimatePresence>
      {feedbacks.map((feedback) => (
        <div className={`pop-feedback ${feedback.color}`} style={{ left: feedback.x, top: feedback.y }} key={feedback.id}>
          <span className="pop-ring" />
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
          <motion.b
            initial={{ x: 0, y: 0, scale: .8, opacity: 1 }}
            animate={{ x: feedback.targetX - feedback.x, y: feedback.targetY - feedback.y, scale: [1, 1.35, .45], opacity: [1, 1, 0] }}
            transition={{ duration: .72, ease: [0.2, 0.8, 0.3, 1] }}
            onAnimationComplete={() => { setFeedbacks((items) => items.filter((item) => item.id !== feedback.id)); setScorePulse(true); window.setTimeout(() => setScorePulse(false), 250); }}
          >{feedback.value > 0 ? `+${feedback.value}` : feedback.value}</motion.b>
        </div>
      ))}
      <footer>HAMSTERHUB</footer>
    </main>
  );
}
