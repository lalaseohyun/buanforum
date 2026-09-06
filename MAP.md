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
| 원탁토론 첫 화면·STEP1~3·참고자료(예산표) | [content/04-board.json](content/04-board.json) |

`content/*.json`은 GitHub 저장소에서 웹으로 직접 열어 고치고 저장하면 끝난다. 로컬 개발 환경이 필요 없다.

**오늘 몇 조로 할지는 파일이 아니라 행사장에서 고른다.** 진행자 화면 하단 탭바의 `⛶ 전체화면` 옆 `☰` 메뉴를 열어 조 수를 누르면 그 값이 저장되고, 퀴즈 참여현황·최종순위·대표정책 갤러리·공감투표가 전부 그 조 수만큼만 쓴다(빔프로젝터에 큰 버튼으로 안 뜨게 일부러 메뉴 안에 넣었다). `forum.json`의 `teamCount`는 처음 기본값일 뿐이다.

## 화면 색·크기

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 전체 색·폰트(브랜드가 바뀌면 여기만) | [css/tokens.css](css/tokens.css) |
| 공통 버튼·배지·연결 끊김 표시 | [css/base.css](css/base.css) |
| 진행자 화면 셸(탭바·조작바·무대모드) | [css/host.css](css/host.css) |
| 참여자 화면 셸(상단바) | [css/team.css](css/team.css) |
| 오프닝·토크콘서트·원탁토론 첫화면/STEP 모양 | [css/sessions/slides.css](css/sessions/slides.css) (홈 로고·부제도 여기) |
| 퀴즈 화면(문제·보기·정답·순위) 모양 | [css/sessions/quiz.css](css/sessions/quiz.css) |
| 정답 뒤 그래프/표 화면 모양 | [css/sessions/chart.css](css/sessions/chart.css) |
| 원탁토론 참고자료 패널 모양 | [css/sessions/board.css](css/sessions/board.css) |
| 대표정책(사진 갤러리·확대·공감투표 표) 모양 | [css/sessions/policy.css](css/sessions/policy.css) |
| 6. 우수정책 시상 타이틀 모양 | [css/sessions/slides.css](css/sessions/slides.css) 의 `.awardslide` 부분 |

## 진행 흐름·버튼 로직 (세션별로 완전히 분리돼 있다)

각 세션은 `js/host/sessions/<이름>.js` + `js/team/sessions/<이름>.js` 한 쌍이다.
**하나를 고칠 때 다른 세션 파일은 열 필요가 없다.**

| 세션 | 진행자 화면 | 참여자 화면 |
|---|---|---|
| 홈(타이틀→2×2 카드) | [js/host/sessions/home.js](js/host/sessions/home.js) | (참여자는 홈 화면이 없음 — 대기화면으로 통일) |
| 1. 오프닝 스몰토크 | [js/host/sessions/opening.js](js/host/sessions/opening.js) | [js/team/sessions/wait.js](js/team/sessions/wait.js) 공용 |
| 2. 청년정책 퀴즈 | [js/host/sessions/quiz.js](js/host/sessions/quiz.js) | [js/team/sessions/quiz.js](js/team/sessions/quiz.js) |
| ⭐ 정답 뒤 그래프 화면 | [js/host/sessions/chart.js](js/host/sessions/chart.js) (quiz.js가 불러 씀, 독립 세션 아님) | — |
| 3. 토크콘서트 | [js/host/sessions/talk.js](js/host/sessions/talk.js) | wait.js 공용 |
| 4. 원탁토론(첫화면+STEP1~3, 사진 없음) | [js/host/sessions/board.js](js/host/sessions/board.js) | [js/team/sessions/board.js](js/team/sessions/board.js) |
| 5. 대표정책(사진 갤러리 → 공감투표) | [js/host/sessions/policy.js](js/host/sessions/policy.js) | [js/team/sessions/vote.js](js/team/sessions/vote.js) (투표 화면. `?vote=1`로 들어온 폰만 뜬다) |
| 6. 우수정책 시상 | [js/host/sessions/award.js](js/host/sessions/award.js) | wait.js 공용 |

세션을 하나 더 추가하려면: `js/host/sessions/새이름.js` 작성(아래 계약 참고) → [js/host/main.js](js/host/main.js)의 `SESSIONS` 배열에 한 줄 등록 → `content/forum.json`의 `sessions`에 한 항목 추가. 기존 세션 파일은 하나도 안 건드린다.

## 셸(모든 세션이 공유하는 틀) — 어지간해선 안 열어도 되는 파일

| 파일 | 역할 |
|---|---|
| [host.html](host.html) | 진행자 화면 뼈대 — css/js 로드 목록만 있음 |
| [index.html](index.html) | 참여자 화면 뼈대 |
| [js/host/main.js](js/host/main.js) | 세션 라우팅·탭바·전체화면(무대모드)·단축키 |
| [js/host/controls.js](js/host/controls.js) | 하단 조작바를 "어떻게 그리는가" |
| [js/team/main.js](js/team/main.js) | 조 선택·세션 라우팅 |
| [js/db.js](js/db.js) | Firestore 문서 구조 전부가 여기 주석에 정리돼 있다. 구조를 바꾸면 여기 + firebase/firestore.rules 둘 다 고쳐야 함 |
| [js/content.js](js/content.js) | `content/*.json` 로더 |
| [js/storage.js](js/storage.js) | 사진 리사이즈·업로드 |
| [js/util.js](js/util.js) | esc·문장분리·글자맞춤 |
| [js/score.js](js/score.js) | **채점 규칙의 유일한 정의.** `node tools/test-score.js`로 검증됨 |
| [js/db.js](js/db.js) 의 `voteWeights` | **공감투표 규칙의 유일한 정의.** 조가 3개 이하면 1표, 4조 이상이면 1순위 2표·2순위 1표 |
| [js/firebase.js](js/firebase.js) | Firebase 프로젝트 연결 값 (배포 시 여기부터 채운다) |

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
`ctx`가 주는 것(참여자): `root`, `forum`, `team`(조 번호), `leaveTeam()`.

## Firestore 문서 구조

정확한 필드는 [js/db.js](js/db.js) 맨 위 주석에 있다(코드가 바뀌면 여기가 항상 최신이다 — 이 문서에 따로 옮겨 적지 않는 이유).

## 배포·운영

행사 당일 실행 방법, Firebase 프로젝트 만드는 단계별 안내, 사고 대비는 [README.md](README.md)에 있다.
