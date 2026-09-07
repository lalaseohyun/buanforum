/* ───────────────────────────────────────
   Firestore 연결 · 구독/쓰기 래퍼 — 모든 세션이 이 파일을 통해서만 DB를 만진다.

   고칠 때 ─ Firebase 프로젝트 자체를 바꾸려면   → js/firebase.js
             문서 구조를 바꾸려면                 → 이 파일 + firebase/firestore.rules
   구조(forums/{FORUM_ID} 아래) ─
     (forum 문서 자체)      { session, teamCount, activeSession }
                            session       ← 진행자 탭바가 지금 어느 탭에 있는지(예전 "참여자가 진행자를
                                             그대로 따라간다" 방식의 흔적 — 지금은 아무도 안 구독한다)
                            teamCount     ← 오늘 진행할 조 수. 팀 화면 전체가 구독한다
                            activeSession ← 참여자 허브(js/team/sessions/hub.js)의 타일 잠금/진행/완료를
                                             결정하는 값. 진행자 탭바 "▶ 진행상태" 메뉴에서 바꾼다.
                                             ACTIVE_SESSIONS(아래) 중 하나.
     policy/live            { page, open, names:{ [teamNo]: "정책명" } }  대표정책 화면 상태(팀·투표 화면이 구독)
     policyVotes/{voterId}  { ranks:[조번호…], at }   공감투표. 문서 ID가 기기별 voterId — 같은 기기가
                            다시 내면 이전 표가 새 표로 덮어써진다(1인 1표 제한은 없음, 진행자 요청)
     quiz/state          { phase, index, open, revealed, showChart, openedAt, asked{} }  진행자 전용 상태
     quiz/live             { phase, index, open, revealed, item{...정답 없음}, reveal{...정답 공개 시에만} }  팀이 구독
     quizAnswers/{qid}      { "1":{choice,ms}, "2":{...} }      문항당 문서 1개, 팀 번호가 필드명
     teams/{teamNo}         { joinedAt, activeDevice }  activeDevice = 지금 이 조를 대표로 쓰고 있는 기기의 deviceId
                            (참여자 허브가 퀴즈 입장 전 "이미 참여 중" 경고에만 쓴다 — 강제 차단은 안 함)
     slides/opening         { index }
     slides/talk            { index }
     slides/board           { index }
     boardPhotos/{id}       { teamNo, url, path, at, voters:{ [voterId]: true } }  참여자가 직접 올린다(대표정책 제출)
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
  getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, addDoc, getDoc,
  serverTimestamp, deleteField,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig, FORUM_ID } from "./firebase.js";

const app = initializeApp(firebaseConfig);
export { app };
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
/** 실시간 구독 없이 한 번만 읽는다 — 퀴즈 대표 확인처럼 "지금 이 순간" 값만 필요할 때. */
export function getOnce(docPath) {
  return getDoc(doc(fs, docPath)).then(s => s.exists() ? s.data() : null);
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

/* ---- 참여자 허브: 진행 단계 ---- */
// 진행자 탭바 "▶ 진행상태" 메뉴와 참여자 허브(js/team/sessions/hub.js)가 함께 쓰는
// 순서 있는 목록 — 허브 타일의 잠금/진행/완료는 이 배열 안에서의 위치로 정해진다.
export const ACTIVE_SESSIONS = ['waiting', 'quiz', 'proposal_submit', 'proposal_vote', 'survey', 'ended'];

/** 퀴즈 조 대표 "claim" — teams/{no} 문서에 이 기기의 deviceId를 남긴다.
 *  이미 다른 기기가 대표로 있어도(허브가 미리 경고를 보여준 뒤) 그대로 덮어쓴다 —
 *  완전히 막지는 않는다(대표자 폰 배터리가 나가면 다른 폰으로 이어받아야 하므로). */
export function claimTeam(teamNo, deviceId) {
  return teamSet(path('teams', String(teamNo)), { joinedAt: Date.now(), activeDevice: deviceId });
}

/* ---- 퀴즈: 답변 제출 ---- */
/** 참가자가 답을 낸다. choice/ms만 자기 팀 번호 키로 병합 — 다른 팀 답에는 손대지 않는다. */
export function submitAnswer(qid, teamNo, choice, ms) {
  return setDoc(doc(fs, path('quizAnswers', qid)), { [String(teamNo)]: { choice, ms } }, { merge: true });
}

/* ---- 대표정책: 사진 ---- */
/** 조당 1장 — 문서 ID를 조 번호로 고정해서, 다시 올리면 그 자리를 덮어쓴다. */
export function saveMainPhoto(teamNo, photo) {
  return setDoc(doc(fs, path('boardPhotos', `${teamNo}-main`)), { teamNo, ...photo, at: Date.now() }, { merge: false });
}
/** 「+ 사진 추가」 — 조당 여러 장이 필요하면 자동 ID로 추가 문서를 만든다. */
export function addExtraPhoto(teamNo, photo) {
  return addDoc(collection(fs, path('boardPhotos')), { teamNo, ...photo, at: Date.now() });
}

/* ---- 공감투표 ----
   한 사람(기기)당 문서 하나. 문서 ID가 voterId라서 같은 기기는 덮어쓰기만 가능하고,
   화면에서는 이미 투표한 기기를 다시 못 들어오게 막는다.
   ranks = 1순위부터 순서대로 담은 조 번호 배열. 표 수는 순위별 가중치로 계산한다. */
export function submitVote(voterId, ranks) {
  return setDoc(doc(fs, path('policyVotes', voterId)), { ranks, at: Date.now() }, { merge: false });
}

/** 조 수에 따른 순위별 가중치 — 3팀 이하 [1](한 팀만) · 4팀 이상 [2,1](1순위 2표·2순위 1표) */
export function voteWeights(teamCount) {
  if (teamCount <= 3) return [1];
  return [2, 1];
}

/** 투표 결과 집계 — { [teamNo]: 표수 } */
export function tallyVotes(votes, teamCount) {
  const w = voteWeights(teamCount);
  const out = {};
  Object.values(votes || {}).forEach(v => {
    (v && v.ranks || []).forEach((teamNo, i) => {
      if (i < w.length && teamNo) out[teamNo] = (out[teamNo] || 0) + w[i];
    });
  });
  return out;
}

export { doc, collection, updateDoc, deleteField, serverTimestamp };
