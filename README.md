# matchview-collector

매치뷰 2 앱이 내려받아 쓰는 **수집 코드와 중계 정보**예요. 경기 데이터는 들어 있지 않고, 각 사이트에서 일정을 읽는 방법만 들어 있어요.

- `collector.js` : 리그·컵·e스포츠 일정과 순위 수집 코드
- `broadcast.json` : 국가(대한민국·미국·일본)별 중계 서비스와 링크
- `manifest.json` : 버전. 앱은 이 값이 자기 것보다 높을 때만 새 파일을 받아요.
- `test/` : 실제 응답 샘플로 하는 자동 테스트 (`node --test test/collector.test.js`)
- `tools/healthcheck.js` : 실제 사이트에 붙어 보는 점검. **매주 월요일** GitHub Actions에서 돌고, 고장 난 리그가 있으면 실패로 표시돼요.

## 고칠 때
1. `collector.js` 수정 → 안의 `VERSION`과 `manifest.json`의 `collector`를 같이 올려요 (예: 2.0.0 → 2.0.1).
2. 중계 정보만 바꿀 때는 `broadcast.json`의 `version`(날짜)과 `manifest.json`의 `broadcast`를 같이 바꿔요.
3. 올리면 앱이 12시간 안에(또는 설정 → "지금 업데이트 확인") 받아 써요. 새 APK는 필요 없어요.
