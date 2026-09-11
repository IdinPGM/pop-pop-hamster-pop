# Pop Pop Hamster Pop — MVP Planning

## 1. เป้าหมาย

สร้างมินิเกมก่อนเข้าสู่เว็บไซต์หลัก เพื่อดึงความสนใจและพาผู้เล่นไปยังปุ่มสมัครกิจกรรมผ่านรางวัลท้ายเกม

เวอร์ชันแรกต้องเล่นจบได้ครบหนึ่งรอบ และกด `Restart` เพื่อเริ่มเล่นใหม่ได้ทันที

## 2. Tech Stack

- React + TypeScript + Vite
- Tailwind CSS สำหรับ UI และ responsive layout
- Framer Motion สำหรับ animation และ transition
- HTML5 Audio API สำหรับเสียงประกอบ
- ไม่มี backend และระบบ login ใน MVP

## 3. Core Game Loop

1. หน้าเริ่มเกมแสดงวิธีเล่นแบบสั้นและปุ่ม `Start Playing`
2. Countdown `3 → 2 → 1 → Go!`
3. เล่นเกมเป็นเวลา 20 วินาที
4. แฮมสเตอร์บอลลูนลอยขึ้นจากด้านล่างด้วยตำแหน่งและความเร็วแบบสุ่ม
5. กดตัวสีสดเพื่อเพิ่มคะแนน
   - สีแดง `+1`
   - สีเหลือง `+2`
   - สีเขียว `+3`
6. กดตัวสีหม่นจะเสีย `-1` คะแนน โดยคะแนนต่ำสุดคือ `0`
7. เมื่อหมดเวลา หยุดสร้างตัวใหม่และเข้าสู่ฉากเปิดหีบ
8. ผู้เล่นกดหีบเพื่อรับตั๋วรางวัล
9. แสดงปุ่ม `Register Now` และ `Restart`

## 4. Game States

ใช้ state หลักชุดเดียวเพื่อควบคุม flow:

```ts
type GameState =
  | "intro"
  | "countdown"
  | "playing"
  | "transition"
  | "chest"
  | "reward";
```

ทุก state ต้องมีทางเข้าและออกที่ชัดเจน เพื่อป้องกัน timer, animation หรือเสียงทำงานซ้อนกัน

## 5. Restart Flow

ปุ่ม `Restart` แสดงในหน้ารางวัลและเริ่มรอบใหม่โดยไม่ reload หน้าเว็บ

เมื่อกด Restart:

- ล้าง timer และ balloon instances ของรอบก่อน
- reset คะแนนเป็น `0`
- reset เวลาเป็น `20`
- reset สถานะหีบ ตั๋ว และ animation ทั้งหมด
- หยุดและเลื่อนเสียงกลับไปจุดเริ่มต้น
- กลับไปหน้า `intro` เพื่อให้ผู้เล่นกดเริ่มอีกครั้ง
- ไม่บันทึก `hasPlayed=true` จากการเล่นจบ เพราะจะขัดกับการเล่นซ้ำ

ลิงก์ `Register Now` เป็น action แยกจาก Restart และนำไปยัง URL เว็บไซต์หลักที่กำหนดใน config

## 6. หน้าจอและ Animation

### Intro

- ท้องฟ้าสีฟ้าและเมฆเคลื่อนช้า ๆ
- ข้อความ: กดตัวสีสดเพื่อเก็บคะแนน และหลบตัวสีหม่น
- ปุ่ม `Start Playing`

### Countdown

- ตัวเลขขนาดใหญ่กลางจอ
- เล่นเสียง beep และเสียง go

### Gameplay

- แสดง score และแถบเวลาที่ด้านบน
- แฮมสเตอร์บอลลูนมีขนาด ตำแหน่ง และความเร็วแตกต่างกันเล็กน้อย
- ตัวที่กดสำเร็จมี pop/burst effect ก่อนหายไป
- ป้องกันการนับคะแนนซ้ำจากตัวเดิม

### End Transition

- หยุด gameplay และ BGM
- กล้องพุ่งผ่านเมฆขึ้นไปยังฉากหีบสมบัติ
- มี whoosh effect

### Chest & Reward

- หีบสั่นก่อนเปิด
- ลำแสงและตั๋วรางวัลลอยออกมา
- แสดง `Register Now` เป็น CTA หลัก
- แสดง `Restart` เป็นปุ่มรอง

## 7. Audio

- `countdown-beep`
- `countdown-go`
- `gameplay-bgm` แบบ loop
- `pop-good`
- `pop-error`
- `whoosh`
- `chest-rumble`
- `reward-chime`
- `ticket-lock`

ต้องมีปุ่มเปิด/ปิดเสียง และ handle กรณี browser บล็อก autoplay

## 8. Component Structure

```text
src/
├── components/
│   ├── IntroScreen.tsx
│   ├── Countdown.tsx
│   ├── GameHUD.tsx
│   ├── GameField.tsx
│   ├── HamsterBalloon.tsx
│   ├── ChestScene.tsx
│   ├── RewardScreen.tsx
│   └── SoundToggle.tsx
├── hooks/
│   ├── useGameLoop.ts
│   └── useGameAudio.ts
├── config/
│   └── game.ts
├── types/
│   └── game.ts
├── App.tsx
└── main.tsx
```

## 9. Configuration

ค่าที่ควรแก้ได้จากไฟล์เดียว:

- ระยะเวลาเล่น
- spawn rate
- จำนวนตัวสูงสุดบนจอ
- คะแนนของแต่ละสี
- penalty ของตัวหลอก
- ความเร็วต่ำสุด/สูงสุด
- URL สำหรับ `Register Now`
- เปิด/ปิดเสียงเริ่มต้น

## 10. Responsive & Accessibility

- ออกแบบ mobile-first และใช้งานได้บน desktop
- touch target อย่างน้อยประมาณ 44×44 px
- ป้องกันการ select ข้อความและ scroll ระหว่างเล่น
- รองรับ keyboard activation สำหรับปุ่มหลัก
- มีข้อความ/รูปทรงช่วยแยกตัวดีและตัวหลอก ไม่พึ่งสีเพียงอย่างเดียว
- เคารพ `prefers-reduced-motion` โดยลด transition ที่รุนแรง

## 11. Acceptance Criteria

- เล่นตั้งแต่ Intro จนถึง Reward ได้โดยไม่มี state ค้าง
- เกมจบอัตโนมัติเมื่อครบ 20 วินาที
- คะแนนเพิ่ม/ลดถูกต้องและไม่ต่ำกว่า 0
- กดตัวเดียวซ้ำแล้วไม่ได้นับคะแนนเพิ่ม
- หลังหมดเวลาไม่เกิด balloon ใหม่และกดเก็บคะแนนไม่ได้
- เปิดหีบแล้วเห็น CTA และ Restart
- Restart ได้อย่างน้อย 5 รอบติดโดย timer, score, balloon, animation และ audio ไม่ซ้อนกัน
- `Register Now` ไปยัง URL ที่ตั้งไว้
- ใช้งานได้ดีทั้งมือถือและ desktop
- ไม่มี error ใน console ระหว่าง flow ปกติ

## 12. Implementation Order

1. ตั้งค่า React, TypeScript, Tailwind และ Framer Motion
2. สร้าง game state machine และ config
3. ทำ Intro, Countdown, timer และ HUD
4. ทำระบบ spawn, movement, click และ score
5. ทำ end transition, chest และ reward
6. เพิ่ม Restart พร้อม cleanup ทุก effect
7. เพิ่ม audio และ sound toggle
8. ปรับ responsive, accessibility และ reduced motion
9. ทดสอบ acceptance criteria และ polish animation

## 13. Out of Scope สำหรับ MVP

- ระบบสมาชิกและ backend
- leaderboard ออนไลน์
- บันทึกคะแนนข้ามอุปกรณ์
- ระบบของรางวัลหลายระดับตามคะแนน
- admin dashboard
- analytics เชิงลึก
