/* ───────────────────────────────────────
   만족도조사 — Firebase Realtime Database 래퍼.
   이 앱의 나머지는 전부 Firestore(js/db.js)를 쓰는데, 만족도조사만 별도
   제품인 Realtime Database를 쓴다(문서 원안이 그렇게 지정했다 — 실시간
   화면 하나에서 값이 조금씩 바뀌는 용도라 RTDB가 더 가볍고 간단하다).

   경로는 전부 /survey 아래 — 이 행사 하나만 쓰는 걸 가정한 절대경로다
   (Firestore처럼 forums/{FORUM_ID} 밑에 안 두고 최상위에 둔다, 문서 원안
   그대로). 내년에 이 코드를 다시 쓴다면, 포럼 전에 /survey를 통째로
   지우거나(Realtime Database 콘솔에서 노드 삭제) 경로 뒤에 연도를
   붙이는 걸 고려할 것 — 지금은 일부러 안 그랬다.

   신뢰 모델은 이 프로젝트의 나머지와 똑같다(firebase/firestore.rules의
   설명 참고) — 하룻밤 행사용 내부 도구라 "익명 인증만 확인, 진행자 전용
   조작은 화면(=admin.html) 쪽에서만 막는다"로 충분하다고 본다.

   고칠 때 ─ Realtime Database 자체를 켜려면(아직 안 켰다면) → js/firebase.js 위 주석
             문항 문구                                        → content/07-survey.json
             화면·로직                                        → js/host/sessions/survey.js
                                                                (진행자용 QR·실시간 화면),
                                                                survey.html(참여자 설문 폼),
                                                                admin.html(진행자 관리 화면)
             보안 규칙                                        → firebase/database.rules.json
   ─────────────────────────────────────── */
import {
  getDatabase, ref, push, set, update, onValue,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { app, ensureAuth } from "./db.js";

const db = getDatabase(app);

/** 참여자가 설문을 낸다. 완전 익명 — 누가 냈는지 식별할 값을 아예 안 담는다. */
export async function submitSurvey(data) {
  await ensureAuth();
  const newRef = push(ref(db, "survey/responses"));
  await set(newRef, { ...data, timestamp: Date.now() });
  return newRef.key;
}

/** 응답 전체를 실시간으로 구독한다 — { [응답id]: {...} } 형태. */
export function watchResponses(cb, onError) {
  return onValue(ref(db, "survey/responses"), snap => cb(snap.val() || {}), onError);
}

/** 실시간 화면 일시정지 여부(진행자가 admin.html에서 켠다) */
export function watchPaused(cb) {
  return onValue(ref(db, "survey/paused"), snap => cb(!!snap.val()));
}
export function setPaused(v) {
  return set(ref(db, "survey/paused"), !!v);
}

/** 특정 응답의 문항 하나를 화면에서 숨기거나 다시 보이게 한다(데이터는 안 지움). */
export function setHidden(id, field, hidden) {
  return update(ref(db, `survey/responses/${id}`), { [field]: hidden });
}
