# DefectFlow 실행 파일 경량화 및 구조 개선 작업계획서

## 1. 목적
- 실행 파일 또는 배포 산출물의 불필요한 크기를 줄여 배포, 전달, 보관 부담을 낮춘다.
- `js/app.js`에 집중된 화면/상태/이벤트/업무 로직을 분리해 유지보수성과 변경 안정성을 높인다.
- 향후 기능 추가 시 회귀 위험과 개발 리드타임을 줄인다.

## 1.1 이번 프로젝트 범위
- 대상: 프론트엔드 구조 개선, 실행/배포 산출물 경량화, 테스트 보강, 패키징 기준 정리
- 제외: 데이터베이스 테이블 구조 변경, 컬럼 추가/삭제, 제약조건 변경, 마이그레이션 적용
- 해석 기준: DB 쿼리 사용 방식과 서비스 코드 정리는 포함되지만, 실제 스키마 변경은 이번 프로젝트 범위에서 제외한다.
- 서비스 전환 목표: 현재 GitHub Pages와 Vercel에서 `defect_manage`로 서비스 중인 운영 저장소는 유지하되, cutover 시점에 기존 `defect_manage` 소스는 `defect_manage_old` 기준으로 보관하고 저장소 파일을 비운 뒤 `defect_manage2` 소스를 업로드해 운영 대상을 교체한다.
- 단계적 배포 전략안: GitHub Pages는 당분간 `defect_manage`를 계속 서비스하고, Vercel은 `defect_manage2`를 별도 테스트 운영 대상으로 연결해 실제 배포 환경에서 충분히 검증한 뒤 cutover를 진행한다.

## 2. 현재 현황 요약

### 2.1 용량 관점
- 현재 작업 디렉터리 전체 용량은 약 `57.99MB`이다.
- 이 중 `node_modules`가 약 `47.16MB`, `test-results`가 약 `7.14MB`, `test_view`가 약 `2.29MB`, `playwright-report`가 약 `0.51MB`를 차지한다.
- 개발/테스트 산출물을 제외한 lean 후보는 약 `0.68MB` 수준으로 확인되었다.
- 즉, 실행/배포 대상에 불필요한 산출물이 포함되면 현재 기준 약 `98.8%`까지 불필요하게 커질 수 있다.

### 2.2 구조 관점
- [js/app.js](/d:/Workspace/defect_manage/js/app.js)는 약 `3783` lines, 약 `208.85KB`이다.
- [js/storage.js](/d:/Workspace/defect_manage/js/storage.js)는 약 `687` lines, 약 `29.75KB`이다.
- `app.js` 안에 메서드가 약 `99`개 있으며, 이 중 `render*` 계열 메서드가 `19`개로 화면 렌더링 책임이 집중되어 있다.
- `app.js` 한 파일 안에 아래 책임이 함께 섞여 있다.
- 앱 초기화/라우팅
- 로그인/세션
- 관리자 기능
- 대시보드 집계/차트
- 결함 목록 조회/검색/페이지네이션
- 신규 등록/모바일 등록/조치 등록 폼
- 이미지 최적화 및 업로드 전처리
- 외부 위젯/확장프로그램 연동
- 저장 오류 로그 처리

### 2.3 테스트 관점
- `npm.cmd run check:syntax` 통과
- `npm.cmd run test:unit` 통과
- 단, 단위 테스트는 데이터 파일과 간단한 sanitize 수준 중심이며 구조 분해 후 회귀를 막기에는 커버리지가 충분하지 않다.

### 2.4 프로젝트 준비 및 운영 결정 사항
- 원본 운영 저장소 [defect_manage](/d:/Workspace/defect_manage)는 유지하고, 개선 작업은 [defect_manage2](/d:/Workspace/defect_manage2)에서 진행한다.
- `defect_manage2`는 `2026-04-02` 기준 `defect_manage`를 바탕으로 lean 복사본으로 생성했다.
- 복사 시 제외한 항목은 `.git`, `node_modules`, `test-results`, `playwright-report`, `.server.err.log`, `.server.out.log`, `e2e_debug_final_*.txt`이다.
- `defect_manage2`에서 `npm.cmd install`, `npm.cmd run check:syntax`, `npm.cmd run test:unit`까지 확인했다.
- 원격 저장소는 `https://github.com/mohenz/defect_manage2.git`로 연결했다.
- 이번 프로젝트에서는 데이터베이스 스키마 변경은 제외한다.
- 개선 완료 전까지는 `defect_manage`가 운영 서비스 대상이고, 개선 완료 및 테스트 성공 후에는 기존 `defect_manage` 소스는 `defect_manage_old` 기준으로 보관한 뒤 현재 `defect_manage` 저장소 파일을 정리하고 `defect_manage2` 소스를 업로드하는 방식으로 운영 서비스를 교체한다.
- 커밋 시점은 준비 단계가 아니라 개선 작업 완료 및 검증 완료 이후로 잡는다.
- 세부 준비 기록은 [project_bootstrap_record_2026-04-02.md](/d:/Workspace/defect_manage2/docs/project_bootstrap_record_2026-04-02.md)에 별도 보관한다.

### 2.5 현재까지 반영된 개선 작업
- 패키징 기준 문서 [runtime_artifact_packaging_rules.md](/d:/Workspace/defect_manage2/docs/runtime_artifact_packaging_rules.md)를 추가해 실행 필수/제외 대상을 명문화했다.
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에서 결함 필터 조립 로직을 `applyDefectFilters()`로 통합하고 `getUsers()` 중복 정의를 제거했다.
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)의 export 컬럼 상수를 분리하고 신규 결함 insert의 중복 spread를 제거했다.
- [js/utils/app-utils.js](/d:/Workspace/defect_manage2/js/utils/app-utils.js), [image-service.js](/d:/Workspace/defect_manage2/js/services/image-service.js), [bridge-service.js](/d:/Workspace/defect_manage2/js/services/bridge-service.js)를 추가해 공통 유틸, 이미지 처리, 외부 연동 브리지 로직을 분리했다.
- [dashboard-module.js](/d:/Workspace/defect_manage2/js/modules/dashboard-module.js), [assignee-status-module.js](/d:/Workspace/defect_manage2/js/modules/assignee-status-module.js)를 추가해 대시보드와 조치 현황 화면 렌더링을 `app.js` 밖으로 이동했다.
- [auth-module.js](/d:/Workspace/defect_manage2/js/modules/auth-module.js), [list-module.js](/d:/Workspace/defect_manage2/js/modules/list-module.js), [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js), [form-module.js](/d:/Workspace/defect_manage2/js/modules/form-module.js)를 추가해 로그인/회원가입/비밀번호재설정/확장안내, 목록, 관리자, 등록/모바일/조치 폼 화면 렌더링을 `app.js` 밖으로 이동했다.
- [js/utils/storage-query-utils.js](/d:/Workspace/defect_manage2/js/utils/storage-query-utils.js)를 추가해 결함 필터/화면 경로 정규화 같은 순수 쿼리 로직을 `storage.js` 밖으로 분리했다.
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에 `history/commonCodes/defects/logs/users/settings` 도메인 접근점을 정리하고, 기존 `usersApi/settingsApi`는 호환 별칭으로 유지했다.
- [common-code-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/common-code-storage-service.js), [error-log-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/error-log-storage-service.js), [user-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/user-storage-service.js), [settings-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/settings-storage-service.js)를 추가해 `common code`, `오류 로그`, `사용자`, `설정` 도메인 본체를 `storage.js` 밖으로 분리했다.
- [history-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/history-storage-service.js), [defect-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/defect-storage-service.js)를 추가해 남아 있던 `history`, `defect` 도메인 본체도 `storage.js` 밖으로 분리했다.
- [admin-settings-module.js](/d:/Workspace/defect_manage2/js/modules/admin-settings-module.js)를 추가해 관리자 설정, 공통코드 폼, 저장 오류 로그 상세/패널, 결함조치재확인 패널을 [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js) 밖으로 분리했고, [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js)는 현재 약 `146` lines, 약 `9.55KB` 수준의 위임 레이어로 유지된다.
- [js/app.js](/d:/Workspace/defect_manage2/js/app.js)는 위 공통 모듈을 호출하는 조립 레이어로 일부 축소했다.
- [index.html](/d:/Workspace/defect_manage2/index.html)에 신규 공통 모듈 로딩 순서를 반영했다.
- [check-syntax.js](/d:/Workspace/defect_manage2/scripts/check-syntax.js)는 `js/` 하위 모든 스크립트를 재귀 점검하도록 확장했다.
- [storage-query-utils.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-query-utils.test.js)를 추가해 결함 필터 적용 규칙과 screen path 정규화 회귀를 자동 검증하도록 보강했다.
- [storage-error-log-service.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-error-log-service.test.js)를 추가해 오류 로그 정규화 회귀를 자동 검증하도록 보강했다.
- [storage-defect-service.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-defect-service.test.js)를 추가해 결함 저장 오류 상태 유지와 조치 재확인 필터 회귀를 자동 검증하도록 보강했다.
- [local_test_execution_checklist.md](/d:/Workspace/defect_manage2/docs/local_test_execution_checklist.md)를 추가해 로컬 수동 테스트 전 준비, 자동 검증 기준, 권장 수동 점검 순서, 종료 기준을 문서화했다.
- [server.js](/d:/Workspace/defect_manage2/server.js)는 `PORT` 환경변수를 지원하도록 정리해 수동 실행 `3000` 포트와 자동 E2E `3001` 포트를 분리했다.
- [playwright.config.js](/d:/Workspace/defect_manage2/playwright.config.js)는 전용 `3001` 포트와 `reuseExistingServer: false` 기준으로 정리해 다른 프로젝트의 `3000` 서버를 재사용하지 않도록 격리했다.
- [list-module.js](/d:/Workspace/defect_manage2/js/modules/list-module.js)는 결함목록 페이지 번호를 전체 출력하지 않고 현재 구간 기준 `10페이지` 단위로 노출하도록 정리했다.
- [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js)는 담당자관리 목록을 `15명` 단위로 분할해 페이지가 길어지지 않도록 페이징을 적용했다.
- [app-utils.js](/d:/Workspace/defect_manage2/js/utils/app-utils.js)에 공통 페이징 범위 계산 유틸을 추가했고, [app-utils.test.js](/d:/Workspace/defect_manage2/tests/unit/app-utils.test.js)로 `10페이지` 단위 페이징 계산 회귀를 검증한다.
- [form-module.js](/d:/Workspace/defect_manage2/js/modules/form-module.js)는 일반 결함 관리 화면에서만 `테스트 구분` 바로 위에 결함관리번호 표시 영역을 지원한다.
- 결함관리번호는 기존 결함 수정/관리 시에만 `#ID` 형식으로 표시되고, 신규 등록 폼과 모바일 퀵 등록 폼에서는 숨김 처리된다. 읽기 전용 입력창에 강조색/굵은 글씨를 적용해 식별성을 높였다.
- [app.js](/d:/Workspace/defect_manage2/js/app.js)에 `copyDefectManagementId()`를 추가해 결함관리번호 입력창 또는 `(클릭하여 복사)` 안내 텍스트를 클릭하면 ID 숫자를 클립보드에 복사하고 성공 알림을 표시한다.
- 반영 후 `npm.cmd run check:syntax`, `npm.cmd run test:unit`, `npx.cmd playwright test tests/e2e/defect.spec.js tests/e2e/simple.spec.js` 재검증을 통과했고, 현재 unit test는 `6`개 파일 `11`개 테스트, 비파괴 E2E는 `3`개 시나리오가 통과한다.
- 현재 [js/app.js](/d:/Workspace/defect_manage2/js/app.js)는 약 `1610` lines, 약 `69.09KB` 수준이다.
- 현재 [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)는 약 `219` lines, 약 `9.59KB` 수준으로 축소됐다.

## 3. 핵심 문제 정의

### 3.1 실행 파일 또는 배포물 크기 문제
- 현재 저장소에는 네이티브 `.exe` 빌드 스크립트는 없지만, 실제 실행 파일을 만들거나 패키징할 때 개발용 자산까지 같이 포함될 가능성이 크다.
- 특히 아래 자산은 실행에 필수 아님에도 용량에 큰 영향을 준다.
- `node_modules`
- `test-results`
- `playwright-report`
- `test_view`
- 디버그 텍스트 파일
- 문서/가이드성 파일 일부

### 3.2 구조 집중 문제
- [js/app.js](/d:/Workspace/defect_manage/js/app.js)가 사실상 `application service + router + controller + renderer + utility` 역할을 동시에 수행한다.
- 화면 단위 수정이 공통 상태 로직과 직접 맞물려 있어 작은 수정도 전체 회귀 위험으로 연결된다.
- 외부 연동(`pending_defect`, `postMessage`)과 등록 폼 로직이 강결합되어 분리 없이 기능 추가 시 복잡도가 빠르게 증가한다.

### 3.3 서비스 계층 정리 미흡
- [js/storage.js](/d:/Workspace/defect_manage/js/storage.js)에는 사용자 조회 함수 `getUsers()`가 중복 정의되어 있다.
- 저장소 접근 규칙, 오류 정규화, 조회 쿼리 구성, 도메인별 API가 아직 명확히 분리되어 있지 않다.

## 4. 영향도 분석

### 4.1 용량 개선 영향도
- 영향도: 높음
- 기대 효과:
- 패키징 결과물 크기 대폭 감소
- 배포 아티팩트 업로드/다운로드 시간 단축
- 팀 전달 파일 관리 단순화
- 리스크:
- 제외 규칙을 잘못 잡으면 `extension.zip`, 런타임 이미지, 필수 스크립트가 누락될 수 있다.
- 대응:
- “실행 필수 파일 목록”을 먼저 확정하고, 제외 규칙을 문서화한 뒤 패키징 검증을 수행한다.

### 4.2 구조 개선 영향도
- 영향도: 매우 높음
- 기대 효과:
- 화면별 수정 범위 축소
- 코드 리뷰 난이도 완화
- 결함 등록/조치/조회 기능의 독립 테스트 가능
- 신규 기능 추가 시 병렬 작업 용이
- 리스크:
- 기존 `window.App` 전역 구조에 의존한 이벤트 바인딩이 깨질 수 있다.
- 모달, standalone, extension bridge 흐름에서 회귀가 발생할 수 있다.
- 대응:
- 단계적 분리 방식으로 진행하고, 각 단계마다 기존 공개 인터페이스를 유지한다.

### 4.3 테스트 보강 영향도
- 영향도: 높음
- 기대 효과:
- 구조 분해 시 회귀 조기 발견
- 외부 연동 흐름의 안정성 확보
- 리스크:
- 초기에는 테스트 작성 비용이 증가한다.
- 대응:
- 전체 테스트 확대보다 “깨지기 쉬운 흐름” 우선으로 최소 회귀 세트를 먼저 구축한다.

### 4.4 서비스 전환 영향도
- 영향도: 매우 높음
- 기대 효과:
- 현재 `defect_manage` 운영 서비스를 `defect_manage2`로 교체 가능
- 개선 결과를 실제 운영 경로에 반영 가능
- `defect_manage`와 `defect_manage2`의 이중 운영 기간 최소화
- 기존 `defect_manage` 서비스 URL을 유지한 채 내부 소스만 교체 가능
- 리스크:
- 전환 시 기존 `defect_manage` 저장소 파일 삭제와 `defect_manage2` 소스 업로드 순서가 어긋나면 일시적으로 서비스 공백이 생길 수 있다.
- 기존 `defect_manage_old` 보관본과 운영 저장소의 기준이 혼동될 수 있다.
- 대응:
- 전환 전 URL, rewrite, 외부 연동 스크립트, extension 연결 주소를 점검하고, `defect_manage_old` 보관 기준, 저장소 비우기 순서, 업로드 순서, rollback 기준을 함께 운영한다.

## 5. 개선 방향

### 5.1 용량 최적화 방향
- 실행/배포 대상과 개발/검증 대상을 분리한다.
- 패키징 시 포함 대상과 제외 대상을 명시한다.
- 가능하면 테스트 자산과 운영 자산의 경로를 더 명확히 분리한다.

### 5.2 구조 개선 방향
- `window.App`를 한 번에 제거하지 않고, 기능별 모듈을 분리한 뒤 `App`는 조립/호출 레이어로 축소한다.
- 화면 렌더링과 데이터 처리 로직을 분리한다.
- 외부 연동 브리지, 이미지 처리, 저장 페이로드 생성 로직을 공통 유틸 또는 서비스로 승격한다.

### 5.3 배포 전환 방향
- 개발 기간에는 `defect_manage`와 `defect_manage2`를 분리 운영한다.
- 개선 완료 전까지 기존 서비스 대상은 `defect_manage`를 유지한다.
- 사전 검증 단계에서는 GitHub Pages는 기존 `defect_manage`를 유지하고, Vercel은 `defect_manage2`를 테스트 운영 대상으로 연결해 실제 호스팅 환경에서 동작을 검증한다.
- 이 단계에서는 가능하면 현재 운영 Vercel 프로젝트의 연결 저장소를 즉시 교체하기보다, `defect_manage2` 전용 Vercel 프로젝트 또는 도메인이 자동 부여되지 않는 staged 배포 방식으로 검증하는 편이 안전하다.
- `defect_manage2`에서 기능/테스트/수동 점검이 완료되면, 기존 `defect_manage` 소스는 `defect_manage_old` 기준으로 보관하고 현재 `defect_manage` 저장소 파일을 정리한 뒤 `defect_manage2` 소스를 업로드한다.
- 이 방식에서는 GitHub Pages / Vercel의 기존 `defect_manage` 서비스 경로를 유지한 채 내부 소스만 `defect_manage2` 기준으로 교체한다.
- 전환 후 `defect_manage_old`는 rollback 및 비교 기준 저장소/폴더로 유지한다.

## 6. 권장 목표 구조

### 6.1 프론트엔드 모듈 분리안
- `js/app-shell.js`
  앱 초기화, 공통 상태, 라우팅, 전역 이벤트 연결
- `js/modules/auth.js`
  로그인, 회원가입, 비밀번호 초기화, 세션 복원
- `js/modules/dashboard.js`
  대시보드 집계 계산, 차트/표 렌더링
- `js/modules/list.js`
  검색 조건, 목록 조회, 페이지네이션, 엑셀 다운로드
- `js/modules/register-form.js`
  신규 등록, 폼 렌더링, payload 생성
- `js/modules/mobile-form.js`
  모바일 간편 등록 전용 흐름
- `js/modules/action-form.js`
  결함 조치 결과 입력 전용 흐름
- `js/modules/admin.js`
  사용자 관리, 공통코드 관리, 저장 오류 로그, 재확인 탭
- `js/modules/bridge.js`
  `pending_defect`, `postMessage`, standalone/extension 연동
- `js/services/image-service.js`
  이미지 로드, 리사이즈, 압축, preview 생성
- `js/services/storage-service.js`
  Supabase 접근, 쿼리, 저장 오류 정규화
- `js/utils/*.js`
  날짜, sanitize, screen path, 통계 공통 함수

### 6.2 패키징/배포 관리 분리안
- 운영 배포 필수 경로
- `index.html`
- `css/`
- `js/`
- `local/legacy-images/`
- `extension/`
- `server.js`
- `package.json`
- 운영 배포 제외 후보
- `node_modules/`
- `tests/`
- `test_view/`
- `test-results/`
- `playwright-report/`
- `e2e_debug_final_*.txt`
- 일부 문서 파일

## 7. 단계별 작업 계획

### Phase 1. 기준선 정리
- 목표:
- 현재 용량과 구조 기준선을 문서화하고, 패키징 포함/제외 규칙을 확정한다.
- 작업:
- 실행 필수 파일 목록 작성
- 제외 대상 목록 작성
- 패키징 방식 확정
- `docs`에 배포 아티팩트 기준 문서 추가
- 산출물:
- 패키징 기준 문서
- 예상 효과:
- 잘못된 경량화로 인한 누락 방지
- 영향도:
- 낮음

### Phase 2. 서비스 계층 정리
- 목표:
- [js/storage.js](/d:/Workspace/defect_manage/js/storage.js)의 중복과 책임 혼재를 먼저 줄인다.
- 작업:
- `getUsers()` 중복 제거
- 결함 조회/저장/로그/사용자/설정 API를 도메인별 함수군으로 정리
- 오류 정규화 함수와 쿼리 조합 함수를 분리
- 현재 반영:
- `users/settings` 도메인 접근점 정리 및 기존 별칭 호환 유지
- 쿼리 조합과 screen path 정규화 로직을 [storage-query-utils.js](/d:/Workspace/defect_manage2/js/utils/storage-query-utils.js)로 분리
- `common code`, `오류 로그`, `사용자`, `설정` 도메인 본체를 `js/services/storage/` 하위 서비스로 분리
- `history`, `defect` 도메인 본체를 `js/services/storage/` 하위 서비스로 분리
- 산출물:
- 정리된 storage service
- 영향도:
- 중간
- 리스크:
- 데이터 조회/저장 회귀 가능

### Phase 3. 공통 유틸 및 이미지 처리 분리
- 목표:
- `app.js`의 하단 공통 함수와 이미지 처리 함수를 먼저 외부 모듈로 이동한다.
- 작업:
- `sanitize`, 날짜 포맷, screen path, 통계 helper 분리
- `readFileAsDataUrl`, `optimizeImageDataUrl`, `prepareUploadedImage` 분리
- 산출물:
- `utils`, `image-service` 계층
- 영향도:
- 중간
- 리스크:
- 등록/수정 폼의 이미지 preview 회귀 가능

### Phase 4. 외부 연동 브리지 분리
- 목표:
- extension, widget, standalone 등록 흐름을 공통 브리지 모듈로 정리한다.
- 작업:
- `pending_defect` 처리 로직 통합
- `DEFECTFLOW_READY`, `DEFECTFLOW_DATA`, `DEFECTFLOW_CLOSE` 처리 분리
- register form과 bridge의 책임 경계 분리
- 산출물:
- `bridge.js`
- 영향도:
- 높음
- 리스크:
- 외부 사이트 연동과 팝업 등록 흐름 회귀 위험이 가장 큼

### Phase 5. 화면별 렌더러 분리
- 목표:
- [js/app.js](/d:/Workspace/defect_manage/js/app.js)의 가장 큰 책임을 화면 단위로 분리한다.
- 작업:
- 1차 완료: `dashboard`, `assignee-status` 화면을 모듈로 분리
- 2차 완료: `login`, `signup`, `password-reset`, `extension-guide`, `list`, `users`, `settings`, `register`, `mobile`, `action` 화면을 모듈로 분리
- `dashboard`, `list`, `admin`, `register`, `mobile`, `action` 순으로 분리
- `App.render()`는 화면 선택과 위임만 담당하도록 축소
- 산출물:
- 화면별 모듈
- 영향도:
- 매우 높음
- 리스크:
- 이벤트 핸들러와 전역 상태 참조 누락 가능

### Phase 6. 테스트 보강 및 경량 패키징 검증
- 목표:
- 구조 분해 후 주요 동작을 검증하고, 실제 경량화 효과를 수치로 확인한다.
- 작업:
- 단위 테스트 추가
- 주요 E2E 회귀 시나리오 추가
- 패키징 전/후 용량 비교
- 산출물:
- 회귀 테스트 세트
- 용량 비교 결과
- 영향도:
- 높음

### Phase 7. 서비스 전환 준비 및 cutover
- 목표:
- 현재 `defect_manage`로 서비스 중인 GitHub Pages와 Vercel 운영 대상을 `defect_manage2`로 교체한다.
- 사전 운영 전략:
- GitHub Pages: 기존 `defect_manage` 유지
- Vercel: `defect_manage2` 연결 후 테스트 운영
- 진입 조건:
- `check:syntax`, `test:unit` 통과
- 주요 E2E 및 수동 점검 완료
- 외부 연동, extension, standalone 등록 흐름 확인 완료
- 작업:
- `defect_manage2` 저장소를 기준으로 Vercel 테스트 운영 환경 구성
- 필요 시 Vercel에서 production domain 자동 연결을 막는 staged 배포 방식 또는 별도 프로젝트 방식 선택
- Vercel 테스트 URL 기준으로 standalone, `test_view`, extension, 외부 위젯 호출 동작 검증
- GitHub Pages 배포 기준 경로와 저장소 설정 점검
- Vercel 프로젝트 연결 대상과 rewrite 동작 점검
- `/`, `/test_page`, `/mobile_test_page` 라우트 정상 동작 확인
- 외부 위젯, extension, 문서 내 연결 URL이 새 서비스 기준으로 정리됐는지 점검
- 기존 `defect_manage` 소스를 `defect_manage_old` 기준으로 보관
- 현재 운영 저장소 파일 삭제 순서 확정
- `defect_manage2` 소스 업로드 및 배포 반영 순서 확정
- cutover 체크리스트 작성
- rollback 절차와 기준 시점 정의
- 전환 직후 smoke test 수행
- 산출물:
- 서비스 전환 체크리스트
- 전환 완료 기록
- rollback 절차 문서
- 영향도:
- 매우 높음
- 리스크:
- 현재 운영 중인 Vercel 프로젝트의 연결 저장소를 바로 `defect_manage2`로 교체하면 프로덕션 도메인 반영 시점 통제가 어려울 수 있음
- 저장소 파일 삭제 후 새 소스 업로드 전까지 짧은 공백 구간이 생길 수 있음
- `defect_manage_old` 보관본과 현행 운영 저장소가 혼동될 수 있음
- Vercel 프로젝트 연결 대상을 잘못 지정하면 테스트 경로가 깨질 수 있음

## 8. 우선순위
- 1순위: 패키징 기준 수립 및 불필요 산출물 제외
- 2순위: `storage.js` 정리
- 3순위: 공통 유틸/이미지 처리 분리
- 4순위: 외부 연동 브리지 분리
- 5순위: 화면별 렌더러 분리
- 6순위: 테스트 보강
- 7순위: GitHub Pages / Vercel 서비스 전환

## 9. 예상 효과

### 9.1 단기 효과
- 배포/전달 산출물 크기 즉시 감소
- 코드 읽기 범위 축소
- 수정 시 영향 범위 파악 용이

### 9.2 중기 효과
- 신규 기능 추가 속도 향상
- 기능별 병렬 작업 가능
- 회귀 테스트 설계 용이

### 9.3 장기 효과
- 바닐라 JS 구조를 유지하면서도 모듈 경계가 명확한 운영 가능
- 향후 빌드 도구 도입 또는 프레임워크 전환 여부 판단이 쉬워짐

## 10. 주요 리스크 및 대응
- 리스크: external widget/extension/standalone 등록 흐름 회귀
- 대응: 브리지 분리 전후로 동일 시나리오 E2E 확인

- 리스크: 전역 `window.App` 참조 깨짐
- 대응: 초기에 `App`를 facade로 유지하고 내부만 분리

- 리스크: 패키징 제외 규칙 오설정
- 대응: 필수 파일 화이트리스트 기반 패키징 적용

- 리스크: 테스트 부족으로 구조 분해 회귀 미탐지
- 대응: 등록, 조회, 조치, 관리자, 외부연동 최소 5개 핵심 시나리오 우선 자동화

- 리스크: 기존 `defect_manage` 저장소를 비운 뒤 `defect_manage2` 소스를 올리는 과정에서 공백 또는 누락 발생
- 대응: `defect_manage_old` 보관본 확보, 업로드 순서 체크리스트, 전환 직후 smoke test, 필요 시 보관본 기준 rollback 준비

- 리스크: Vercel 테스트 운영이 기존 운영 도메인과 충돌하거나, 자동 프로덕션 반영으로 이어질 수 있음
- 대응: 별도 Vercel 프로젝트 또는 staged production deployment 사용, 테스트 URL 분리, 최종 cutover 전 수동 promote 또는 도메인 전환 기준 명확화

## 11. 즉시 실행 권장 항목
- `storage.js` 중복/공통 정리부터 시작
- `app.js`에서 이미지 처리 및 util 함수 먼저 분리
- 외부 연동 브리지 분리는 별도 단계로 분리하여 단독 검증
- 경량화는 코드 리팩토링과 별개로 먼저 적용 가능하므로 선행 수행

## 12. 결론
- 이 작업은 단순 파일 분할이 아니라 “배포 경량화”와 “기능 경계 재정의”를 동시에 수행하는 구조 개선 작업이다.
- 완료 시점에는 기존 `defect_manage` 소스를 `defect_manage_old` 기준으로 보관하고, 현재 `defect_manage` 저장소 파일을 정리한 뒤 `defect_manage2` 소스를 업로드해 GitHub Pages와 Vercel 운영 대상을 교체하는 전환 작업까지 포함한다.
- 우선순위는 `불필요 산출물 제외 -> 서비스 계층 정리 -> 공통 유틸 분리 -> 외부 연동 분리 -> 화면 분리 -> 테스트 보강 -> 서비스 전환` 순이 적절하다.
- 현재 구조에서는 한 번에 전체 재작성보다, 기존 동작을 유지한 상태에서 단계적으로 모듈을 분리하는 방식이 가장 안전하다.
