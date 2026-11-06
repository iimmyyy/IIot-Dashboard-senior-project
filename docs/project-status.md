# BioDry Research Monitor — Project Status

> อัปเดตล่าสุด: 7 พฤศจิกายน 2026
>
> Production: <https://biodry.immy.website>
>
> Repository: <https://github.com/iimmyyy/IIot-Dashboard-senior-project>

## 1. Executive summary

โปรเจกต์อยู่ในช่วง **Functional Integration Prototype / Demo-ready** กล่าวคือ ฟังก์ชันหลักที่ใช้สาธิต workflow ของระบบ Bio-Drying ทำงานร่วมกันได้แล้วบนเว็บจริง ตั้งแต่การดูข้อมูล L1/L2/L3, ตรวจจับ temperature peak, แสดง alert, จัดการรอบ batch, บันทึกข้อมูลรายวันตาม role, เก็บ audit log แบบต้นแบบ และทดสอบส่ง Email/LINE จริง

ระบบในสถานะนี้เหมาะสำหรับ:

- สาธิตแนวคิดและหน้าตาการใช้งานให้อาจารย์หรือทีมวิจัย
- ตรวจสอบ user flow และเกณฑ์ temperature-peak alert
- ตกลง data contract กับ backend/ฐานข้อมูล
- ทดสอบ provider Email และ LINE ด้วยผู้รับที่ตั้งไว้ฝั่ง server
- ใช้เป็น frontend reference ก่อนเชื่อม PLC, sensor gateway, FastAPI และฐานข้อมูลจริง

ระบบยัง **ไม่ใช่ production สำหรับข้อมูลวิจัยจริง** เพราะ telemetry, daily records, batch state และ audit log ส่วนใหญ่ยังทำงานด้วย mock data หรือ browser `localStorage`; authentication ยังเป็น demo account; และ automatic notification pipeline ยังไม่มี persistent outbox/worker

## 2. Phase ปัจจุบัน

| Phase | สถานะ | ขอบเขต |
| --- | --- | --- |
| Phase 1 — Monitoring UI MVP | เสร็จแล้ว | Dashboard, trends, alerts, experiments, system status และ responsive layout |
| Phase 2 — Functional Integration Prototype | **Phase ปัจจุบัน** | L1/L2/L3, polynomial alert, batch lifecycle, role login, daily records, audit prototype, Email/LINE และ CI |
| Phase 3 — Backend & Persistence Integration | ยังไม่เริ่มเต็มรูปแบบ | FastAPI, database, telemetry ingestion, persistent audit/outbox, institutional authentication |
| Phase 4 — Validation & Laboratory Rollout | ยังไม่เริ่ม | E2E กับระบบจริง, research validation, security hardening, UAT และ operational deployment |

คำว่า “เสร็จแล้ว” ในเอกสารนี้หมายถึงเสร็จในระดับ prototype ที่รันและทดสอบได้ ไม่ได้หมายถึงผ่านการ validate ทางวิจัยหรืออนุมัติให้ควบคุมอุปกรณ์จริง

## 3. ขอบเขตระบบปัจจุบัน

### 3.1 เครื่องและ sensor layout

- รองรับเครื่อง `L1`, `L2` และ `L3`
- แต่ละเครื่องมี 3 ระดับ: `Top`, `Middle`, `Bottom`
- Overview มี chamber selector สำหรับสลับเครื่องโดยไม่ปน query/history/alert ระหว่างเครื่อง
- Chamber schematic แสดง sensor แต่ละชั้นและ blower/fan
- พัดลมในภาพ chamber หมุนตลอดเวลาเพื่อสื่อการทำงานของระบบ
- ตัดคำว่า `shared` ออกจากชื่อ blower แล้ว
- ระบบปัจจุบันเป็น monitoring/review เท่านั้น ไม่มีปุ่มควบคุม blower หรืออุปกรณ์จริง

### 3.2 หน้าหลักในระบบ

| หน้า | ความสามารถปัจจุบัน |
| --- | --- |
| Overview | เลือก L1/L2/L3, ดู current batch, อุณหภูมิล่าสุด, chamber average, recent trend, chamber schematic, alert และ batch status |
| Temperature Trends | เลือก experiment/ช่วงเวลา, ซ่อนหรือแสดง series, zoom/pan, hover detail, summary statistics, accessible table และ CSV export |
| Daily Records | เลือกวันที่และ L1/L2/L3, กรอกหรือดูข้อมูลรายวัน 16 ค่า, แก้ไข record เดิม และดู activity log |
| Experiment History | ค้นหาและกรอง experiment, ดูวันเริ่ม/สิ้นสุด, duration, condition และสถานะ |
| Alerts | กรองตาม severity/status/date, ดู evidence และ recommended action, acknowledge alert ด้วยตัวตนที่ login |
| System Status | ดู API/stream/sensor freshness, เลือก demo failure scenario และส่ง test Email/LINE |

### 3.3 Demo scenarios

System Status มี scenario สำหรับทดสอบ UI โดยไม่ต้องทำให้ sensor จริงเสีย:

1. Normal Monitoring
2. Outdated Readings
3. Missing Middle Sensor
4. Connection Lost
5. Waiting for Sensor Data

Scenario มีผลต่อ current measurement ใน browser session เท่านั้น ไม่แก้ historical fixtures หรือข้อมูลภายนอก

## 4. Alert design ปัจจุบัน

### 4.1 Alert types

Data contract รองรับ alert 3 ประเภท:

- `temperature_peak` — ตรวจพบว่าอุณหภูมิผ่านจุดสูงสุดและกำลังลดลง
- `connection` — เหตุการณ์เกี่ยวกับการเชื่อมต่อหรือ monitoring resume
- `system` — เหตุการณ์ระบบทั่วไป

Alert history สามารถแสดงทุกประเภท แต่ **จุดบนกราฟแสดงเฉพาะ `temperature_peak`** ตาม requirement ปัจจุบัน เพื่อไม่ให้กราฟรกด้วย connection/system events

### 4.2 Polynomial temperature-peak criterion

ระบบ prototype ใช้ quadratic polynomial fit กับ chamber-average temperature โดยมี default criteria ดังนี้:

| Parameter | ค่า |
| --- | ---: |
| Evaluation window | 7 วันล่าสุด (`168 ชั่วโมง`) |
| จำนวนข้อมูลขั้นต่ำ | 12 complete measurements |
| Minimum R² | ต้องมากกว่า `0.70` |
| Maximum allowed gap | 3 ชั่วโมง |
| เวลาหลัง fitted peak | อย่างน้อย 1 ชั่วโมง |
| Minimum fitted drop | อย่างน้อย `0.5 °C` |

ระบบจะให้ผล `alert` เมื่อทุกเงื่อนไขต่อไปนี้ผ่านพร้อมกัน:

1. ข้อมูลอยู่ใน experiment เดียวกันและ timestamp ใช้งานได้
2. ในแต่ละ measurement มีค่า Top, Middle และ Bottom ที่ valid ครบ
3. มีข้อมูลครบอย่างน้อย 12 จุดใน evaluation window
4. จุดแรกและช่องว่างระหว่างจุดไม่ห่างจาก window/จุดก่อนหน้าเกิน 3 ชั่วโมง
5. Fit เป็นกราฟคว่ำ (`a < 0`) จึงมี local maximum
6. `R² > 0.70`
7. fitted peak อยู่ภายในช่วงข้อมูล
8. fitted peak ผ่านมาแล้วอย่างน้อย 1 ชั่วโมง
9. fitted slope ณ จุดล่าสุดเป็นค่าลบ
10. fitted temperature ลดจาก peak แล้วอย่างน้อย `0.5 °C`

ค่าที่ใช้ fit คือค่าเฉลี่ยเท่ากันของ Top/Middle/Bottom หลังผ่าน data-quality check ไม่ใช่การเลือก sensor ชั้นใดชั้นหนึ่ง

### 4.3 ตำแหน่ง alert บนกราฟ

- Marker ถูกวางที่เวลา **fitted peak** ซึ่งเป็นจุดที่แนวโน้มเริ่มเปลี่ยนจากขึ้นเป็นลง
- ไม่วาง marker ที่วันท้าย ๆ ซึ่งระบบเพิ่งยืนยันผล
- Alert card ยังเก็บเวลาที่ระบบตรวจพบ (`detected_at`) แยกจากเวลา fitted peak
- Connection และ system alerts อยู่ใน alert list เท่านั้น ไม่แสดง marker บน temperature chart

### 4.4 ข้อจำกัดของ criterion

- Criterion นี้เป็น trend-review signal ไม่ใช่ safety interlock
- ยังไม่ใช้ TDE หรือ full stopping criteria ตามต้นแบบงานวิจัย
- ยังไม่สั่งหยุด blower หรืออุปกรณ์อัตโนมัติ
- การจบ batch ต้องมีผู้ใช้ที่ได้รับสิทธิ์ตรวจและยืนยันเอง

## 5. Batch lifecycle

Batch แยกตาม `experiment + machine` และมี 3 สถานะ:

```text
Running
  -> Polynomial temperature peak passed
Ready for review
  -> Researcher/Professor confirms in application dialog
Completed
  -> Researcher/Professor selects Start new batch
Running (next sequence)
```

รายละเอียด behavior:

- Batch แรกเริ่มที่ sequence 1
- เมื่อพบ temperature-peak alert ของเครื่องและรอบปัจจุบัน สถานะเปลี่ยนเป็น `Ready for review`
- การจบ batch เปิด popup/modal ภายในเว็บ ไม่ใช้ browser dialog
- Researcher หรือ Professor ต้องยืนยันก่อนเปลี่ยนเป็น `Completed`
- เมื่อ Completed จะมีปุ่ม `Start new batch`
- New batch เพิ่ม sequence และสร้าง start timestamp ใหม่
- Alert เก่าที่เกิดก่อน start timestamp ของรอบใหม่จะไม่ถูกนำมาตัดสินรอบใหม่
- Complete/start เป็น idempotent ในระดับ prototype เพื่อไม่สร้าง record ซ้ำจากการกดซ้ำ
- ทุก complete/start สร้าง audit event
- Workflow นี้ไม่ควบคุม physical equipment

ปัจจุบัน batch state ถูกเก็บใน `localStorage` เมื่อใช้ Demo Mode; Live Mode endpoint ถูกออกแบบไว้แล้วแต่ยังไม่เชื่อม backend จริง

## 6. Role และ authentication

### 6.1 Roles

| Capability | Professor | Researcher | Staff |
| --- | :---: | :---: | :---: |
| ดู dashboard/trends/experiments/alerts/system | ✓ | ✓ | ✓ |
| ดู daily records | ✓ | ✓ | ✓ |
| เพิ่ม/แก้ daily records | — | ✓ | — |
| Acknowledge alert | ✓ | ✓ | ✓ |
| Complete batch | ✓ | ✓ | — |
| Start new batch | ✓ | ✓ | — |
| ส่ง test Email/LINE | ✓ | ✓ | — |

ข้อมูลหลักที่แต่ละ role มองเห็นยังเหมือนกันตาม requirement ปัจจุบัน ความต่างอยู่ที่ action permission และ actor identity สำหรับ audit log

### 6.2 Session ที่ใช้อยู่

- Login ใช้ source-defined demo accounts
- Session เป็น signed cookie ชื่อ `biodry-session`
- Cookie เป็น `HttpOnly`, `SameSite=Lax`, และใช้ `Secure` ใน production
- อายุ session 8 ชั่วโมง
- Payload เป็น Base64URL JSON พร้อม HMAC-SHA256 signature
- ระบบนี้ไม่ใช่ JWT และยังไม่มี server-side session database/revocation
- Protected pages redirect ไป `/login` เมื่อ session ไม่มีหรือหมดอายุ
- Login/logout เขียน structured audit event ไป server console

Demo credentials ถูกเก็บใน source เพื่อการสาธิตเท่านั้น และต้องเปลี่ยนเป็น university identity provider หรือ database-backed authentication ก่อนใช้จริง

## 7. Daily Records

### 7.1 Record identity และ permission

- หนึ่ง record มี key เป็น `experiment + Bangkok date + machine`
- เครื่องรองรับ L1/L2/L3
- Researcher สร้างและแก้ไขได้
- Professor และ Staff เป็น read-only
- การแก้ record เดิมเป็น upsert และไม่สร้าง duplicate
- Audit event เก็บ field-level `before` และ `after`

### 7.2 Fields และหน่วย

| กลุ่ม | Field | หน่วย |
| --- | --- | --- |
| Temperature | T Top | °C |
| Temperature | T Middle | °C |
| Temperature | T Bottom | °C |
| Temperature | T Core | °C |
| Temperature | T Air | °C |
| Temperature | Below Peak | °C |
| Temperature | Bottom Slope | °C/d |
| Process | Drying Rate | kg/d |
| Process | η | ไม่มีหน่วยกำหนดใน prototype |
| Process | NL | kg |
| Process | Total Weight | kg |
| Process | Leachate | kg |
| Process | Height | m |
| Process | AR | m³/kg/d |
| Gas | Core O₂ | % |
| Gas | Core CO₂ | % |

Validation ปัจจุบันบังคับให้ทุก field เป็น finite number; temperature อยู่ในช่วง `-50 ถึง 200 °C`; weight/height/AR ไม่ติดลบ; O₂/CO₂ อยู่ในช่วง `0–100%`

### 7.3 Persistence ปัจจุบัน

- Demo records: `biodry-daily-records-v1` ใน browser `localStorage`
- Demo audit log: `biodry-audit-log-v1`
- เก็บได้เฉพาะ browser/device นั้น
- ยังไม่ sync ข้ามเครื่องหรือข้ามผู้ใช้
- Live Mode แสดงชัดเจนว่ายังไม่ได้เชื่อม daily-record storage

## 8. Audit log

Prototype รองรับ action ต่อไปนี้:

- `auth.sign_in`
- `auth.sign_out`
- `daily_record.created`
- `daily_record.updated`
- `alert.acknowledged`
- `batch.completed`
- `batch.started`

Audit event ประกอบด้วยเวลา, actor id/name/role, target type/id และ field changes แต่ปัจจุบันมี 2 temporary sinks:

- Server-side auth events เขียนลง server console
- Browser-side daily/alert/batch events เก็บใน `localStorage` สูงสุด 500 รายการ

ก่อนใช้จริงต้องย้ายไป immutable backend audit store พร้อม retention, access control และ backup policy

## 9. Email และ LINE notifications

### 9.1 Email

- Provider: MailerSend REST API
- ผู้ส่งและผู้รับมาจาก server environment variables เท่านั้น
- เนื้อหามี HTML report และ plain-text fallback
- ระบุ machine, severity, detected time, supporting values, recommended action และ alert ID
- แนบ PDF ชื่อ `{experiment}-{machine}-batch-summary.pdf`
- PDF ปัจจุบันเป็น draft 1 หน้า สรุป metadata, alert, evidence และ recommended action
- Report fields จะปรับเพิ่มเติมเมื่อทีมวิจัยสรุป requirement ฉบับจริง

### 9.2 LINE

- ใช้ LINE Messaging API push endpoint
- ส่ง Flex Message card พร้อมสีตาม severity
- แสดง title, machine, detected time, supporting values, recommended action และ alert ID
- ปลายทางเป็น user/group/room ID ที่ตั้งใน server environment
- ใช้ `X-Line-Retry-Key` ที่ derive จาก idempotency key

### 9.3 LINE webhook behavior

- Webhook ตรวจ `x-line-signature` ด้วย channel secret
- ใช้ event จาก group เพื่อค้นหาและ log group ID
- Webhook ไม่เรียก Reply API จึงไม่ตอบข้อความทั่วไปในกลุ่ม
- LINE Official Account ปิด Chat และ Auto-reply แล้ว แต่เปิด Webhook ไว้
- Bot ส่งข้อความเมื่อ application เรียก push API เท่านั้น

### 9.4 Manual notification test

- System Status มีปุ่ม Test Email และ Test LINE
- Route คือ `POST /api/notifications/test`
- ใช้ได้เมื่อ `NOTIFICATION_TEST_ENABLED=true`
- Production เปิด flag นี้ไว้สำหรับการสาธิต
- ต้อง login เป็น Professor หรือ Researcher
- Staff ถูกปฏิเสธด้วย `403`
- Browser เลือกได้เฉพาะ channel และส่งผู้รับเองไม่ได้
- Test route ส่ง alert ตัวอย่างและไม่เปลี่ยนสถานะเครื่องหรือ batch

### 9.5 สิ่งที่ยังไม่เชื่อม

- Alert ที่เกิดจริงยังไม่ enqueue และส่ง Email/LINE อัตโนมัติแบบ end-to-end
- Notification jobs มี contract และ idempotency key แล้ว แต่ยังไม่มี persistent database outbox
- ยังไม่มี background worker, retry schedule, dead-letter queue หรือ delivery dashboard
- Automated tests ใช้ mocked fetch และไม่ส่งข้อความจริง

## 10. Data modes และ backend contract

### 10.1 Demo Mode

- ใช้ simulated experiments, telemetry และ alerts
- อุณหภูมิ mock แยก L1/L2/L3
- Refresh demo current measurement ทุก 15 วินาที
- ใช้ browser storage สำหรับ acknowledgement, daily records, batches และ audit log
- มี banner ระบุชัดว่าเป็น simulated data

### 10.2 Live Mode

Frontend adapter และ Zod validation รองรับ REST/WebSocket contract แล้ว เช่น:

- `GET /api/v1/system/status`
- `GET /api/v1/experiments`
- `GET /api/v1/telemetry/latest?chamber_id=L1`
- `GET /api/v1/telemetry/history?...&chamber_id=L1`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{id}/acknowledge`
- `GET/PUT /api/v1/daily-records...` (ออกแบบ contract ไว้)
- Batch complete/start endpoints (ออกแบบ contract ไว้)
- `/ws/telemetry`

Live adapter ไม่ fallback กลับ mock data เมื่อ request ล้มเหลว เพื่อป้องกันผู้ใช้เข้าใจ simulated data ว่าเป็นข้อมูลจริง

### 10.3 Backend ที่ยังต้องทำ

- รับ sensor/PLC/IoT gateway data จริง
- Persist experiments, telemetry, alerts, daily records, batches และ audit log
- Run approved alert rules ฝั่ง backend
- Transactionally create alert + Email/LINE outbox jobs
- Enforce authorization ที่ API boundary
- ส่ง WebSocket telemetry และ heartbeat
- จัดการ retention, backup และ research-data governance

## 11. UI/UX state

- UI ปรับเป็น minimal dashboard เน้นข้อมูลที่ต้องใช้ตัดสินใจ
- Navigation แบ่งตามงานชัดเจนและมี mobile bottom navigation
- ใช้ข้อความกำกับสถานะ ไม่พึ่งสีอย่างเดียว
- มี keyboard focus และ accessible labels ใน controls สำคัญ
- Chart รองรับ mouse interaction และ measurement table สำหรับผู้ใช้ที่ไม่ใช้กราฟ
- Batch confirmation ใช้ in-app modal
- Alert graph marker จำกัดเฉพาะ temperature peak เพื่อลด visual clutter
- เวลาแสดงผลเป็น Asia/Bangkok (ICT/UTC+7)
- Application UI ใช้ภาษาอังกฤษ

ยังต้องทำ formal usability test กับ Professor/Researcher/Staff และตรวจ responsive layout บนอุปกรณ์จริงหลายขนาด

## 12. Technology stack

| Layer | Technology |
| --- | --- |
| Web framework | Next.js 16.4.3 App Router |
| UI runtime | React 19.3.1, TypeScript |
| Data fetching/cache | TanStack Query |
| Validation | Zod |
| Charts | Apache ECharts |
| Icons/UI primitives | Lucide React, Radix Slot/CVA-style components |
| PDF generation | pdf-lib |
| Testing | Vitest |
| CI | GitHub Actions |
| Deployment | Vercel + custom domain |
| Current persistence | Demo fixtures, browser localStorage, server environment variables |

## 13. Test status

การตรวจล่าสุดก่อน commit นี้:

- ESLint: ผ่าน
- TypeScript typecheck: ผ่าน
- Unit/integration tests: **17 files, 73 tests ผ่านทั้งหมด**
- Next.js production build: ผ่าน
- Known-secret scan สำหรับ credentials ที่ใช้ตั้งค่าระหว่างพัฒนา: ไม่พบใน source ที่จะ commit

Test coverage ปัจจุบันครอบคลุม:

- Telemetry validation, zone averages, stale/missing/future readings
- Live API failure โดยไม่ fallback mock
- WebSocket validation/reconnection/cleanup
- Polynomial peak และ Criterion T
- Graph alert filtering
- L1/L2/L3 data isolation
- Daily-record role permission, upsert และ audit
- Batch complete/start lifecycle และ idempotency
- Session encode/decode/expiry
- Alert acknowledgement persistence
- Notification formatting, provider request contracts และ LINE retry key
- PDF generation
- LINE webhook signature/group extraction

GitHub Actions รัน `npm ci`, lint, typecheck, tests และ production build ทุก pull request และทุก push เข้า `main`

ยังไม่มี Playwright E2E suite; scenario ที่วางแผนไว้ดูได้ใน `docs/testing-strategy.md`

## 14. Deployment state

- Production platform: Vercel
- Custom domain: <https://biodry.immy.website>
- Production notification secrets เก็บใน Vercel environment ไม่อยู่ใน repository
- Email/LINE manual test เปิดสำหรับ demo presentation
- Source repository ใช้ branch `main`

ข้อควรระวัง: เว็บถูก deploy สาธารณะในขณะที่ยังมี demo credentials อยู่ใน source จึงควรใช้เฉพาะข้อมูลจำลองและห้ามใส่ข้อมูลวิจัยจริงหรือข้อมูลส่วนบุคคล

## 15. Known limitations และ technical debt

### Critical ก่อนรับข้อมูลจริง

1. เปลี่ยน demo login เป็น institutional identity/database authentication
2. Hash passwords และเพิ่ม rate limit/lockout
3. ใช้ persistent/revocable server-side sessions หรือ identity tokens ที่ออกแบบอย่างเป็นทางการ
4. ยกเลิก fallback session secret และบังคับ production secret
5. ทำ backend authorization ทุก write operation
6. ย้ายข้อมูลและ audit log ออกจาก localStorage
7. เพิ่ม database backup/retention/access policy
8. Rotate provider credentials ที่เคยใช้ระหว่างการพัฒนา

### Notification

1. เชื่อม real alert creation กับ transactional outbox
2. เพิ่ม worker, bounded retry, exponential backoff และ dead-letter review
3. เก็บ delivery status/provider request ID
4. ป้องกัน duplicate delivery ข้าม process/redeploy
5. ออกแบบ report PDF ฉบับ final กับทีมวิจัย

### Research/data

1. Professor ต้องยืนยัน methodology และ threshold ทั้งหมด
2. ตกลง expected sensor inventory และ missing-sensor semantics
3. Validate polynomial criterion ด้วย historical/controlled experimental data
4. ตกลง full batch stopping criteria รวม T/D/E หากจะใช้ในอนาคต
5. กำหนด data quality, calibration และ timestamp policy

### Quality

1. เพิ่ม Playwright E2E กับ fake provider/backend
2. เพิ่ม accessibility audit และ cross-browser testing
3. ทำ UAT แยก Professor/Researcher/Staff
4. เพิ่ม dependency/secret scanning และ security headers review

Security backlog แบบย่ออยู่ใน `docs/security-backlog.md`

## 16. Recommended next phase

Phase ถัดไปควรเป็น **Backend & Persistence Integration** โดยทำตามลำดับนี้:

1. ตกลง FastAPI/database schema และ endpoint contract
2. Persist users/sessions หรือเชื่อม university identity
3. Persist experiments, L1/L2/L3 telemetry และ alert records
4. ย้าย daily records, batch lifecycle และ audit log ไป backend
5. ย้าย polynomial evaluation ไป service ที่รันตาม schedule/ingestion event
6. สร้าง alert และ notification jobs ใน transaction เดียวกัน
7. เพิ่ม Email/LINE worker พร้อม retry/deduplication
8. เชื่อม WebSocket live telemetry
9. เพิ่ม Playwright E2E และ staging environment
10. ทำ research validation, security review และ UAT ก่อนใช้ข้อมูลจริง

## 17. Definition of done สำหรับ laboratory-ready release

ระบบจะถือว่าพร้อมใช้ในห้องปฏิบัติการเมื่ออย่างน้อย:

- ไม่มี demo credential หรือ fallback secret ใน production path
- ทุก role ถูก enforce ฝั่ง server
- ข้อมูลทั้งหมด persist ในฐานข้อมูลและมี backup
- Audit log แก้ย้อนหลังไม่ได้และค้นย้อนหลังได้
- Alert criterion ผ่านการอนุมัติจาก Professor/ทีมวิจัย
- Sensor inventory, calibration และ missing-data behavior ถูกกำหนดชัดเจน
- Email/LINE delivery มี retry, deduplication และ status tracking
- E2E/UAT ผ่านทุก critical workflow
- Security review และ incident procedure พร้อมใช้งาน
- UI ระบุ data freshness, demo/live state และ failure state อย่างไม่กำกวม
- ระบบยังคงไม่ควบคุมอุปกรณ์จริงจนกว่าจะมี safety design และ approval แยกต่างหาก

## 18. เอกสารที่เกี่ยวข้อง

- `README.md` — วิธีติดตั้ง, feature overview และ proposed backend contract
- `docs/testing-strategy.md` — test pyramid, CI และ planned E2E cases
- `docs/security-backlog.md` — security work ที่ต้องทำก่อน production จริง
- `.env.example` — รายการ environment variables โดยไม่มี secret จริง
