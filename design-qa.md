# 관심 종목 Design QA

- source visual truth: `/var/folders/2n/6zhmq7xn7_1b932xbhwyqkbc0000gn/T/codex-clipboard-bf7466fd-1202-46f8-b9ba-36a022b918ac.png`
- implementation screenshot: `/Users/choisunghoon/Documents/Aitime/flow-pulse_web/watchlist-implementation.png`
- viewport: 390 × 844 CSS px, deviceScaleFactor 1
- pixels: source 1706 × 922 (light/dark board), implementation 390 × 844
- normalization: source dark mobile panel was used as the visual region; implementation was captured at the UI specification's 390 × 844 viewport.
- state: dark theme, 진행 중 / 전체, SK하이닉스 대표 카드

## Full-view comparison evidence

- Information order, segment/filter hierarchy, featured timeline card, compact rows, market-close strip, and five-item bottom navigation match the selected mock.
- Typography uses the product's existing Pretendard variable family and restrained 400–500 weights. Supporting copy remains readable at the mobile viewport.
- Spacing follows the 14–16px mobile rhythm, 10–13px radii, 44px minimum action heights, and row separators from the source.
- Dark tokens reuse the existing first/second-page green-black surfaces, muted gray copy, mint/info/warning/danger semantics, and subtle borders.
- The reference contains no raster content assets; Lucide supplies the standard interface icons.
- App-specific copy, stock values, statuses, timeline, Confidence, Flow Shift, Persistence, and action labels match the reference/spec.

## Focused region comparison evidence

- Featured card: timeline and metric columns collapse vertically without clipped copy at 390px; action buttons remain side by side.
- Bottom navigation: five items remain visible and the explicitly enlarged icons/labels stay on one line.
- Desktop check: 1440px viewport produced a 760px content surface with no horizontal overflow.

## Comparison history

1. P1: `관찰 시작` initially opened 삼성전자 with SK하이닉스의 청산 timeline and buttons. Fixed by deriving the featured timeline, metrics, and actions from the selected item's stage. Post-fix evidence shows 삼성전자 with `확인 조건 2/3`, `진입 확인 대기`, `진입 기록`, and `상세 보기`.
2. P2: the enlarged `관심 종목` bottom label wrapped. Fixed with a compact letter-spacing and no-wrap rule. Post-fix mobile evidence keeps all five labels visible.

## Findings

- No actionable P0/P1/P2 visual differences remain for the implemented MVP state.
- P3: the source board shows both themes side by side, while browser evidence captures the active system dark theme; the matching light theme is implemented with the same semantic tokens but was not separately browser-captured.

## Primary interactions tested

- `관찰 시작` adds/selects the stock and opens the third tab.
- 진행 중 / 일반 관심 segment switching.
- 전체 / 보유 status filtering.
- Bottom navigation and representative stock selection.
- Browser console errors checked: none.

final result: passed
