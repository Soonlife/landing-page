# 순라이프 랜딩페이지 (soonlife.net)

순라이프 앱(iOS · Android · 웹 동시 출시 예정)을 소개하는 정적 페이지. 빌드 없이 파일 그대로 올린다.
구성은 Apple macOS 소개 페이지처럼 검은 첫 화면 → 하이라이트 → 기능 묶음(머리말 + 옆으로 넘기는 카드)이다.
카드에는 화면 전체가 아니라 기능을 알 수 있는 UI 조각 하나만 넣는다.

## 실행

```bash
python3 -m http.server 8080   # http://localhost:8080
```

`index.html`이 CSS를 `@import`하므로 `file://`로 열지 말고 로컬 서버로 연다.

## 구조

```
index.html                 페이지 전체 (첫 화면 → 하이라이트 → 순맵 · 순버스 · 순라이프 AI · 학교 소식 · 학교 생활 → 그 밖의 기능 → 출시 예정)
resources/styles/
  root.css                 reset · font · color를 불러오고 기본 요소 스타일
  color.css                라이트/다크 · 고대비 색 토큰
  font.css                 Pretendard GOV(서브셋) · 산토끼체 워드마크(워드마크 글자만 담은 서브셋)
  index.css                랜딩 페이지 레이아웃과 목업 카드
resources/scripts/index.js 스크롤 등장 효과, 기능 메뉴 위치 표시, 하이라이트 넘기기, 카드 화살표
resources/images/          파비콘 · 애플 터치 아이콘 · OG 이미지 · 앱 아이콘(app-icon.png, 400px)
```

워드마크 서브셋에는 `순 라 이 프 A I 맵 밥 버 스 +`만 들어 있다(첫 화면 워드마크 애니메이션용). 워드마크에 다른 글자를 쓰려면 폰트를 다시 서브셋해야 한다.

아이콘은 Tabler Icons(MIT)를 `index.html` 맨 위 SVG 스프라이트로 넣었다. 카드 위 화면 조각(`.Frag`, `.A*`)은 순라이프 앱의 색 토큰·글자 크기·모서리를 그대로 옮긴 HTML/CSS이고, 다크 모드와 하이라이트의 검은 무대에서는 앱 다크 토큰을 쓴다.

## 순버스 3D 버스

순버스 "노선별로 골라 보기" 카드는 전체 → 등교 → 하교 → 학내순환 칩을 2.4초마다 고르고, 그때마다 앱의 3D 셔틀버스(`resources/models/shuttle-bus.glb`)가 한 바퀴 돌며 노선 색으로 바뀐다.
색은 앱 `routeColor`의 대표 노선 색(등교직행 #2D85F0, 하교직행 #ED7B35, 학내순환 #049A5C)이고, 전체는 모델의 원래 색이다.

- `resources/build/bus3d.js`(three.js, 압축 약 160KB)와 모델(72KB)은 카드가 화면 가까이 왔을 때만 불러오고, 화면 밖이나 움직임 줄이기 설정에서는 돌지 않는다.
- 차체 칠하기 규칙과 재질은 앱 `src/map/shuttle-model-layer.ts`와 같은 값을 `tools/bus3d/entry.ts`에 옮겼다. 앱 모델이 바뀌면 glb를 다시 복사하고 번들을 다시 만든다.

```bash
node tools/bus3d/build.mjs              # 기본: ../app 의 node_modules(three)를 씀
```

## 사전 예약

사전 예약은 네이버 폼으로 받는다. 상단 바, 첫 화면, 마지막 패널, 약관 페이지의 "사전 예약" 버튼(`data-preregister`)에 네이버 폼 주소를 넣는다. 주소가 정해지기 전까지는 `href="#"`이다.

## 3D 실내 안내 이미지

순맵의 "3D 실내 안내" 카드와 하이라이트 5번째 카드는 앱의 3D 실내 화면(멀티미디어관 5층)을 캡처한 이미지다. 페이지에서 3D를 돌리지 않는다.

- `resources/images/app/indoor-5f-card-{light,dark}.webp` (800×928): 순맵 카드용 세로 캡처. 배경은 카드 색(#F2F2F7 / #1C1C1E)과 같고, 화면 모드에 따라 바뀐다.
- `resources/images/app/indoor-5f-dark.webp` (1220×780): 하이라이트(검은 무대)용 가로 캡처.

앱의 `createBuildingScene`과 `building-viewer.tsx`의 색으로 그린 뒤 캡처했다. 앱의 평면이 바뀌면 같은 방식으로 다시 캡처한다.
