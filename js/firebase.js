/* ───────────────────────────────────────
   Firebase 프로젝트 연결 — 이 파일만 고치면 된다.

   Firebase 콘솔(console.firebase.google.com) → 프로젝트 생성 →
   ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱 추가 → "구성" 탭에 뜨는
   firebaseConfig 객체를 아래에 그대로 붙여넣는다.

   진행자 키(HOST_KEY)는 여기서 정하고, Firestore의
   forums/<forumId>/config/host 문서에도 { key: "같은 값" }으로
   저장해 두어야 한다 (firebase/firestore.rules가 이 문서와 대조해서
   진행자 쓰기를 허용/차단한다). 진행자 화면은
   host.html?k=<HOST_KEY> 로 연다.
   ─────────────────────────────────────── */

export const firebaseConfig = {
  apiKey: "AIzaSyATcscW7wHTxEWqnUhdYGhTRa49SLZWfks",
  authDomain: "buanforum.firebaseapp.com",
  projectId: "buanforum",
  storageBucket: "buanforum.firebasestorage.app",
  messagingSenderId: "460128859633",
  appId: "1:460128859633:web:f255283375774e5e004050",
};

// forums/{FORUM_ID} 아래에 이 행사의 모든 데이터가 들어간다 (content/forum.json의 id와 일치시킨다)
export const FORUM_ID = "buan2026";
