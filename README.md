# 순라이프 랜딩페이지 (soonlife.net)

순라이프 서비스를 소개하는 정적 페이지. 빌드 없이 파일 그대로 올린다.
모든 시작 버튼은 웹 서비스 https://chat.soonlife.net 으로 연결된다.

## 실행

```bash
python3 -m http.server 8080   # http://localhost:8080
```

`index.html`이 CSS를 `@import`하므로 `file://`로 열지 말고 로컬 서버로 연다.

## 구조

```
index.html                 페이지 전체 (섹션: Hero → 기능 모아 보기 → AI · 공지 · 학사 일정 · 학식 → 시작하기)
resources/styles/
  root.css                 reset · font · color를 불러오고 기본 요소 스타일
  color.css                라이트/다크 · 고대비 색 토큰
  font.css                 Pretendard GOV(서브셋) · 산토끼체 워드마크(「순라이프 AI」 글자만 담은 서브셋)
  index.css                랜딩 페이지 레이아웃과 목업 카드
resources/scripts/index.js 스크롤 등장 효과
resources/images/          파비콘 · 애플 터치 아이콘 · OG 이미지
```

워드마크 서브셋에는 `순 라 이 프 A I`만 들어 있다. 워드마크에 다른 글자를 쓰려면 폰트를 다시 서브셋해야 한다.
