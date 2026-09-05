/* ───────────────────────────────────────
   Firestore 연결 · 구독/쓰기 래퍼 — 모든 세션이 이 파일을 통해서만 DB를 만진다.

   고칠 때 ─ Firebase 프로젝트 자체를 바꾸려면   → js/firebase.js
             문서 구조를 바꾸려면                 → 이 파일 + firebase/firestore.rules
   구조(forums/{FORUM_ID} 아래) ─
     (forum 문서 자체)      { session }   ← 지금 진행 중인 세션 id. 팀 화면 전체가 이걸 구독해서 라우팅한다
     quiz/state          { phase, index, open, revealed, showChart, openedAt, asked{} }  진행자 전용 상태
     quiz/live             { phase, index, open, revealed, item{...정답 없음}, reveal{...정답 공개 시에만} }  팀이 구독
     quizAnswers/{qid}      { "1":{choice,ms}, "2":{...} }      문항당 문서 1개, 팀 번호가 필드명
     teams/{teamNo}         { joinedAt }
     slides/opening         { index }
     slides/talk            { index }
     board/state            { mode: 'write' | 'present' }
     boardPhotos/{id}       { teamNo, url, path, at, voters:{ [voterId]: true } }
     config/host            { key }   ← 쓰기 금지, 규칙이 대조용으로만 읽음

   ⚠ Firestore 경로는 반드시 collection/doc/collection/doc… 로 홀짝이 맞아야 한다.
   "forums/{id}/quiz/answers/{qid}"처럼 문서 하나 밑에 또 문서를 매달 수 없어서
   (짝수 길이가 아니게 됨) quizAnswers·boardPhotos는 quiz·board 밑이 아니라
   forums/{id} 바로 아래의 별도 컬렉션으로 둔다.

   진행자 전용 쓰기는 hostKey 필드를 실어 보낸다. firestore.rules가
   forums/{FORUM_ID}/config/host 문서의 key와 대조해서 검증한다.
   ─────────────────────────────────────── */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, addDoc,
  serverTimestamp, deleteField,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig, FORUM_ID } from "./firebase.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const fs = getFirestore(app);

const base = () => `forums/${FORUM_ID}`;
export const path = (...segs) => [base(), ...segs].join('/');

/* ---- 인증 ---- */
let authReady = null;
export function ensureAuth() {
  if (authReady) return authReady;
  authReady = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, user => { if (user) resolve(user); }, reject);
    signInAnonymously(auth).catch(reject);
  });
  return authReady;
}

/* ---- 진행자 키 (URL의 ?k=) ---- */
export function getHostKey() {
  return new URLSearchParams(location.search).get('k') || '';
}

/* ---- 범용 구독/쓰기 ---- */
export function watch(docPath, cb, onError) {
  return onSnapshot(doc(fs, docPath), snap => cb(snap.exists() ? snap.data() : null),
    err => { console.error('watch 실패', docPath, err); onError && onError(err); });
}
export function watchCollection(colPath, cb, onError) {
  return onSnapshot(collection(fs, colPath), snap => {
    const out = {};
    snap.forEach(d => { out[d.id] = d.data(); });
    cb(out);
  }, err => { console.error('watchCollection 실패', colPath, err); onError && onError(err); });
}

/** 진행자 전용 쓰기. hostKey를 실어 보내고, 규칙이 config/host와 대조한다. */
export function hostSet(docPath, data) {
  return setDoc(doc(fs, docPath), { ...data, hostKey: getHostKey(), updatedAt: serverTimestamp() }, { merge: true });
}
/** 참가자 쓰기 — 익명 인증만 있으면 되는 일반 문서. */
export function teamSet(docPath, data) {
  return setDoc(doc(fs, docPath), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** 진행자 전용 "초기화" 쓰기 — merge 없이 완전히 덮어쓴다(문서를 비우는 용도).
 *  실제 deleteDoc을 쓰지 않는 이유: Firestore의 delete 규칙은 요청에 실려오는 데이터가
 *  없어(resource만 남음) hostKey를 대조할 방법이 마땅치 않다. 대신 "빈 문서로 덮어쓰기"를
 *  하나의 규칙(쓰기 시 hostKey 대조)으로 통일해서 검증한다. */
export function hostReset(docPath, data = {}) {
  return setDoc(doc(fs, docPath), { ...data, hostKey: getHostKey(), updatedAt: serverTimestamp() }, { merge: false });
}

/* ---- 퀴즈: 답변 제출 ---- */
/** 참가자가 답을 낸다. choice/ms만 자기 팀 번호 키로 병합 — 다른 팀 답에는 손대지 않는다. */
export function submitAnswer(qid, teamNo, choice, ms) {
  return setDoc(doc(fs, path('quizAnswers', qid)), { [String(teamNo)]: { choice, ms } }, { merge: true });
}

/* ---- 원탁토론: 사진·하트 ---- */
/** 팀당 기본 1장 — 문서 ID를 팀 번호로 고정해서, 다시 올리면 완전히 새 문서로 교체된다(투표도 초기화). */
export function saveMainPhoto(teamNo, photo) {
  return setDoc(doc(fs, path('boardPhotos', `${teamNo}-main`)), { teamNo, ...photo, at: Date.now(), voters: {} }, { merge: false });
}
/** 「+ 사진 추가」 — 팀당 여러 장을 원하면 자동 ID로 추가 문서를 만든다. */
export function addExtraPhoto(teamNo, photo) {
  return addDoc(collection(fs, path('boardPhotos')), { teamNo, ...photo, at: Date.now(), voters: {} });
}
/** 하트 토글 — 자기 voterId 필드만 켜고 끈다. 다른 사람 표는 건드릴 수 없다(규칙에서도 강제). */
export function toggleHeart(photoId, voterId, on) {
  return updateDoc(doc(fs, path('boardPhotos', photoId)), { [`voters.${voterId}`]: on ? true : deleteField() });
}

export { doc, collection, updateDoc, deleteField, serverTimestamp };
