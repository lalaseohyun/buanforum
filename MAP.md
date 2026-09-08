# 파일 지도 — 뭘 바꾸려면 어디를 열어야 하는가

이 문서 하나만 보고 "내가 지금 뭘 고치고 싶은지"에 맞는 파일을 바로 찾을 수 있어야 한다.
전체 구조를 다시 읽을 필요 없이, 아래 표에서 줄 하나만 찾으면 된다.

## 자주 고치는 것 — 문구·데이터 (전부 `content/` 안, 코드 아님)

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 행사명·날짜·장소·조 이름·조 번호 | [content/forum.json](content/forum.json) |
| 오프닝 스몰토크 카드 문구 | [content/01-opening.json](content/01-opening.json) |
| 퀴즈 문항·정답·해설·그래프 수치 | [content/02-quiz.json](content/02-quiz.json) |
| 토크콘서트 큐시트·패널 소개 | [content/03-talk.json](content/03-talk.json) |
| 원탁토론 첫 화면·STEP1~3·참고자료 요약(예산표) | [content/04-board.json](content/04-board.json) |
| 원탁토론 참고자료 P1~P5(분야별 49개 사업 목록) | [src/data/policies-2026.json](src/data/policies-2026.json) — `content/`가 아니라 여기 있다(가공된 슬라이드 문구가 아니라 시행계획 원자료라 구분) |
| 만족도조사 문항 문구(설문 폼·실시간 화면 공용) | [content/07-survey.json](content/07-survey.json) |

`content/*.json`은 GitHub 저장소에서 웹으로 직접 열어 고치고 저장하면 끝난다. 로컬 개발 환경이 필요 없다.

**오늘 몇 조로 할지는 파일이 아니라 행사장에서 고른다.** 진행자 화면 하단 탭바의 `⛶ 전체화면` 옆 `☰` 메뉴를 열어 조 수를 누르면 그 값이 저장되고, 퀴즈 참여현황·최종순위·대표정책 갤러리·공감투표가 전부 그 조 수만큼만 쓴다(빔프로젝터에 큰 버튼으로 안 뜨게 일부러 메뉴 안에 넣었다). `forum.json`의 `teamCount`는 처음 기본값일 뿐이다.

**참여자 허브(루트 주소)의 타일이 지금 열려 있는지는 진행자가 직접 누른다.** 같은 탭바의 `☰` 옆 `▶ 진행상태` 메뉴에서 `대기/퀴즈/정책 제출/정책 투표/만족도조사/행사 종료` 중 하나를 고르면, 참여자 폰의 4개 타일(퀴즈·시행계획·대표정책·만족도조사)이 그 값에 맞춰 실시간으로 잠기거나 열린다 — 아래 "참여자 허브" 참고.

## 화면 색·크기

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 전체 색·폰트(브랜드가 바뀌면 여기만) | [css/tokens.css](css/tokens.css) |
| 공통 버튼·배지·연결 끊김 표시 | [css/base.css](css/base.css) |
| 진행자 화면 셸(탭바·조작바·무대모드) | [css/host.css](css/host.css) |
| 참여자 화면 셸(상단바) | [css/team.css](css/team.css) |
| 오프닝·토크콘서트·원탁토론(진행자 화면) 첫화면/STEP 모양 | [css/sessions/slides.css](css/sessions/slides.css) (홈 로고·부제도 여기) |
| 퀴즈 화면(문제·보기·정답·순위) 모양 — 진행자·참여자 공용 | [css/sessions/quiz.css](css/sessions/quiz.css) |
| 원탁토론 참고자료 패널 모양(진행자 화면, 분야별 P1~P5) | [css/sessions/board.css](css/sessions/board.css) |
| 대표정책(사진 갤러리·확대·공감투표 표) 모양 — 진행자·참여자 공용 | [css/sessions/policy.css](css/sessions/policy.css) |
| 6. 우수정책 시상 타이틀 모양 | [css/sessions/slides.css](css/sessions/slides.css) 의 `.awardslide` 부분 |
| 만족도조사(QR·실시간 화면·설문 폼·관리 화면) 모양 | [css/sessions/survey.css](css/sessions/survey.css) |
| 참여자 허브(타일·조 확인 화면·대표정책 사진 업로드) 모양 | [css/sessions/hub.css](css/sessions/hub.css) |
| 참여자 시행계획(분야 목록·사업 카드) 모양 | [css/sessions/policyref.css](css/sessions/policyref.css) |

## 진행 흐름·버튼 로직 — 진행자 화면(빔프로젝터)

호스트 세션은 `js/host/sessions/<이름>.js` 하나씩이다. **하나를 고칠 때 다른 세션 파일은 열 필요가 없다.**

| 세션 | 파일 |
|---|---|
| 홈(타이틀→2×2 카드) | [js/host/sessions/home.js](js/host/sessions/home.js) |
| 1. 오프닝 스몰토크 | [js/host/sessions/opening.js](js/host/sessions/opening.js) |
| 2. 청년정책 퀴즈 | [js/host/sessions/quiz.js](js/host/sessions/quiz.js) (예전엔 정답 공개 뒤 그래프 화면이 하나 더 있었는데 2026-09-08에 없앴다) |
| 3. 토크콘서트 | [js/host/sessions/talk.js](js/host/sessions/talk.js) |
| 4. 원탁토론(첫화면+STEP1~3+참고자료 P1~P5, 사진 없음) | [js/host/sessions/board.js](js/host/sessions/board.js) |
| 5. 대표정책(사진 갤러리 → 공감투표) | [js/host/sessions/policy.js](js/host/sessions/policy.js) |
| 6. 우수정책 시상 | [js/host/sessions/award.js](js/host/sessions/award.js) |
| 7. 만족도조사(QR·카운터 → 실시간 오픈엔디드) | [js/host/sessions/survey.js](js/host/sessions/survey.js) + [js/host/sessions/surveyWall.js](js/host/sessions/surveyWall.js)(카드 애니메이션) |

세션을 하나 더 추가하려면: `js/host/sessions/새이름.js` 작성(아래 계약 참고) → [js/host/main.js](js/host/main.js)의 `SESSIONS` 배열에 한 줄 등록 → `content/forum.json`의 `sessions`에 한 항목 추가. 기존 세션 파일은 하나도 안 건드린다.

## 참여자 허브 — 루트 주소(`index.html`)

**참여자는 더 이상 진행자 화면을 그대로 따라가지 않는다.** 루트 주소를 열면 처음부터 끝까지 하나의
"허브"([js/team/sessions/hub.js](js/team/sessions/hub.js))만 떠 있고, 2×2 타일 중 원하는 걸 직접 눌러 들어간다.
QR을 밤새 하나만 쓰면 되고, 지금 뭘 할 수 있는지는 타일 상태(●진행중 / ✓완료 / 🔒대기)로 보여준다
(docs/참여자용페이지_구상안.md 원안).

타일 상태는 진행자가 정하는 `activeSession` 값(위 "오늘 몇 조로 할지…" 문단 참고, [js/db.js](js/db.js)의
`ACTIVE_SESSIONS`)으로 결정된다. **시행계획 타일만 항상 열려 있고**, 만족도조사는 `ended`가 돼도 계속 열려 있다.

| 타일 | 조 선택 필요? | 들어가는 파일 |
|---|---|---|
| 청년정책 퀴즈 | 필요(대표 확인 단계 있음 — 이미 다른 폰이 하고 있으면 경고) | [js/team/sessions/quiz.js](js/team/sessions/quiz.js) |
| 2026 부안군 청년정책 시행계획(48개 사업) | 불필요, 항상 열림 | [js/team/sessions/policyBrowse.js](js/team/sessions/policyBrowse.js) |
| 대표정책 제안 | 필요(단순 조 선택만) — `activeSession`이 `proposal_submit`이면 사진 업로드, `proposal_vote`면 투표 | [js/team/sessions/proposalSubmit.js](js/team/sessions/proposalSubmit.js) / [js/team/sessions/vote.js](js/team/sessions/vote.js)(자기 조는 목록에서 빠진다) |
| 청년포럼 만족도조사 | 불필요 | 화면이 아니라 [survey.html](survey.html)로 그냥 이동 |

조 번호·기기 식별자는 [js/team/teamId.js](js/team/teamId.js)에 있다(localStorage 기반, 허브·퀴즈·대표정책이 공유).
타일 하나를 고치고 싶으면 그 파일만 보면 되고, "언제 열리는지" 규칙 자체는 hub.js 위쪽 `RANGE`/`statusOf`에 모여 있다.

## 만족도조사 전용 페이지 — 세션 라우터 밖에 있다

QR·실시간 화면(위 7번)은 host.html 안의 세션이지만, **설문 폼과 진행자 관리 화면은 완전히 별도의 정적 페이지**다(참가자가 조 선택 없이 바로 들어오고, 관리 화면은 참가자에게 아예 안 보여야 하기 때문).

| 파일 | 역할 |
|---|---|
| [survey.html](survey.html) + [js/surveyForm.js](js/surveyForm.js) | 참여자 설문 폼(모바일 전용). 퀴즈·공감투표와 QR을 하나로 통일하면서, 이제 QR은 이 페이지가 아니라 허브(루트)를 가리키고 허브의 "만족도조사" 타일이 이 페이지로 이동시킨다 |
| [admin.html](admin.html) + [js/adminPanel.js](js/adminPanel.js) | 진행자 관리 화면 — 응답별 숨김 토글·전체 일시정지·엑셀 다운로드(SheetJS). `admin.html?k=진행자키`로 열어야 조작 버튼이 뜬다(host.html과 같은 방식) |
| [js/survey.js](js/survey.js) | 응답 저장·구독 래퍼 — 이 셋(7번 세션·survey.html·admin.html)이 전부 이 파일을 통해서만 데이터를 만진다 |

**⚠ 만족도조사는 Firestore가 아니라 별도 제품인 Realtime Database를 쓴다.** 아직 Firebase 콘솔에서 켜지 않았다면 [README.md](README.md)의 "만족도조사(Realtime Database) 설정" 을 먼저 볼 것 — 안 켜면 설문 제출·실시간 화면·관리 화면이 전부 "불러오는 중"에서 안 넘어간다.

## 셸(모든 세션이 공유하는 틀) — 어지간해선 안 열어도 되는 파일

| 파일 | 역할 |
|---|---|
| [host.html](host.html) | 진행자 화면 뼈대 — css/js 로드 목록만 있음 |
| [index.html](index.html) | 참여자 화면 뼈대 |
| [js/host/main.js](js/host/main.js) | 세션 라우팅·탭바·전체화면(무대모드)·단축키 |
| [js/host/controls.js](js/host/controls.js) | 하단 조작바를 "어떻게 그리는가" |
| [js/team/main.js](js/team/main.js) | 허브 ↔ 타일 화면 라우팅(얇다 — 실제 판단은 hub.js 안에 있음) |
| [js/team/teamId.js](js/team/teamId.js) | "내 조" 번호·기기 식별자(localStorage) — 허브·퀴즈·대표정책이 공유 |
| [js/db.js](js/db.js) | Firestore 문서 구조 전부가 여기 주석에 정리돼 있다. 구조를 바꾸면 여기 + firebase/firestore.rules 둘 다 고쳐야 함 |
| [js/content.js](js/content.js) | `content/*.json` 로더 |
| [js/storage.js](js/storage.js) | 사진 리사이즈·업로드 |
| [js/util.js](js/util.js) | esc·문장분리·글자맞춤 |
| [js/score.js](js/score.js) | **채점 규칙의 유일한 정의.** `node tools/test-score.js`로 검증됨 |
| [js/db.js](js/db.js) 의 `voteWeights` | **공감투표 규칙의 유일한 정의.** 조가 3개 이하면 1표, 4조 이상이면 1순위 2표·2순위 1표 |
| [js/firebase.js](js/firebase.js) | Firebase 프로젝트 연결 값 (배포 시 여기부터 채운다) |
| [js/vendor/qrcode.min.js](js/vendor/qrcode.min.js) | QR 생성 라이브러리(host.html 전용). CDN 대신 로컬로 갖고 있는 이유는 파일 맨 위 주석 참고 |

## 세션 모듈 계약

```js
export default {
  id: 'quiz',                 // js/host/main.js의 SESSIONS 배열/탭바가 쓰는 식별자
  mount(ctx) {                // 이 세션으로 들어올 때 1회 호출
    // ...구독 시작, 렌더...
    return { unmount() { /* 구독 해제 */ } };
  },
};
```
`ctx`가 주는 것(진행자): `root`(그릴 DOM), `forum`(content/forum.json), `hostKey`, `setControls(buttons)`, `setKeys(map)`, `goSession(id)`.
`ctx`가 주는 것(참여자): `root`, `forum`, `team`(조 번호, 없으면 null), `backToHub()`, `leaveTeam()`(조 지우고 허브로),
`enterTile(id, opts)`(hub.js만 쓴다 — 조 확인이 끝나면 이걸로 실제 화면에 넘긴다).

## Firestore 문서 구조

정확한 필드는 [js/db.js](js/db.js) 맨 위 주석에 있다(코드가 바뀌면 여기가 항상 최신이다 — 이 문서에 따로 옮겨 적지 않는 이유).

## 배포·운영

행사 당일 실행 방법, Firebase 프로젝트 만드는 단계별 안내, 사고 대비는 [README.md](README.md)에 있다.
