# defect_manage2 프로젝트 준비 및 파악사항 기록

## 1. 기록 목적
- `defect_manage2` 착수 전에 확인된 사실, 결정사항, 준비 작업 결과를 한 곳에 남긴다.
- 이후 구조 개선, 테스트, 서비스 전환 시 기준선으로 사용한다.

## 2. 기준 일시
- 작성일: `2026-04-02`
- 기준 워크스페이스: `D:\Workspace`

## 3. 프로젝트 운영 기준
- 원본 운영 저장소는 [defect_manage](/d:/Workspace/defect_manage)이다.
- 개선 작업용 저장소는 [defect_manage2](/d:/Workspace/defect_manage2)이다.
- 개발 중에는 `defect_manage`와 `defect_manage2`를 분리 운영한다.
- 개선 완료와 테스트 성공 전까지 운영 서비스는 `defect_manage`를 유지한다.
- 개선 완료와 테스트 성공 후에는 기존 `defect_manage` 소스를 `defect_manage_old` 기준으로 보관하고, 현재 `defect_manage` 저장소 파일을 정리한 뒤 `defect_manage2` 소스를 업로드하는 방식으로 GitHub Pages / Vercel 운영 대상을 교체한다.
- 이 방식에서는 기존 `defect_manage` 서비스 경로를 유지하고 운영 소스만 `defect_manage2` 기준으로 바뀐다.
- 전환 후 `defect_manage_old`는 rollback 및 비교 기준 저장소/폴더로 유지한다.
- 추가 배포 전략안으로, GitHub Pages는 기존 `defect_manage`를 유지하고 Vercel은 `defect_manage2`를 별도 테스트 운영 대상으로 연결해 실제 배포 환경에서 충분히 검증한 뒤 최종 cutover 하는 방식을 채택할 수 있다.

## 4. 범위 확정 사항
- 포함:
- 프론트엔드 구조 개선
- 실행/배포 산출물 경량화
- 테스트 보강
- 패키징 기준 정리
- GitHub Pages / Vercel 서비스 전환 준비
- 제외:
- 데이터베이스 테이블 구조 변경
- 컬럼 추가/삭제
- 제약조건 변경
- 마이그레이션 적용
- 해석 기준:
- DB 쿼리 사용 방식 정리와 서비스 코드 정리는 포함
- 실제 DB 스키마 변경은 제외

## 5. 원본 defect_manage 기준선

### 5.1 용량 파악
- 전체 작업 디렉터리 용량: 약 `57.99MB`
- `node_modules`: 약 `47.16MB`
- `test-results`: 약 `7.14MB`
- `test_view`: 약 `2.29MB`
- `playwright-report`: 약 `0.51MB`
- 개발/테스트 산출물 제외 lean 후보: 약 `0.68MB`
- 제외 가능 비중: 약 `98.8%`

### 5.2 구조 파악
- [js/app.js](/d:/Workspace/defect_manage/js/app.js): 약 `3783` lines / `208.85KB`
- [js/storage.js](/d:/Workspace/defect_manage/js/storage.js): 약 `687` lines / `29.75KB`
- `app.js` 메서드 수: 약 `99`개
- `render*` 계열 메서드 수: `19`개
- 책임 집중 영역:
- 앱 초기화/라우팅
- 로그인/세션
- 관리자 기능
- 대시보드 집계/차트
- 결함 목록 조회/검색/페이지네이션
- 신규 등록/모바일 등록/조치 등록 폼
- 이미지 최적화 및 업로드 전처리
- 외부 위젯/확장프로그램 연동
- 저장 오류 로그 처리

### 5.3 구조상 추가 확인사항
- [js/storage.js](/d:/Workspace/defect_manage/js/storage.js)에 `getUsers()` 중복 정의가 확인되었다.
- 외부 연동 흐름은 `pending_defect`, `postMessage`, standalone, extension, widget이 서로 강결합되어 있다.
- 테스트는 존재하지만 구조 분해 회귀를 막기에는 범위가 좁다.

## 6. defect_manage2 준비 작업 기록

### 6.1 신규 작업 폴더 생성
- 생성 경로: [defect_manage2](/d:/Workspace/defect_manage2)
- 생성 방식: `defect_manage` 기준 lean 복사
- 복사 제외 항목:
- `.git`
- `node_modules`
- `test-results`
- `playwright-report`
- `.server.err.log`
- `.server.out.log`
- `e2e_debug_final_*.txt`

### 6.2 복사 후 확인
- 기본 디렉터리와 실행 관련 파일 복사 완료
- `tests`, `test_view`, `docs`, `extension`, `js`, `css`, `server.js`, `package.json` 유지

### 6.3 의존성 및 검증
- `npm.cmd install` 완료
- `npm.cmd run check:syntax` 통과
- `npm.cmd run test:unit` 통과

### 6.4 1차 개선 배치 반영
- 패키징 기준 문서 [runtime_artifact_packaging_rules.md](/d:/Workspace/defect_manage2/docs/runtime_artifact_packaging_rules.md) 추가
- [js/utils/app-utils.js](/d:/Workspace/defect_manage2/js/utils/app-utils.js) 추가
- [image-service.js](/d:/Workspace/defect_manage2/js/services/image-service.js) 추가
- [bridge-service.js](/d:/Workspace/defect_manage2/js/services/bridge-service.js) 추가
- [js/app.js](/d:/Workspace/defect_manage2/js/app.js)에서 util / image / bridge 호출 위임 적용
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에서 `applyDefectFilters()` 공통화 및 `getUsers()` 중복 제거
- [check-syntax.js](/d:/Workspace/defect_manage2/scripts/check-syntax.js)에서 `js/` 하위 재귀 점검 지원
- 반영 후 `npm.cmd run check:syntax`, `npm.cmd run test:unit` 재통과

### 6.5 2차 개선 배치 반영
- [dashboard-module.js](/d:/Workspace/defect_manage2/js/modules/dashboard-module.js) 추가
- [assignee-status-module.js](/d:/Workspace/defect_manage2/js/modules/assignee-status-module.js) 추가
- [js/app.js](/d:/Workspace/defect_manage2/js/app.js)에서 `renderDashboard()`, `renderAssigneeStatusScreen()`, `renderAssigneeStatusPanel()`을 화면 모듈 위임 구조로 축소
- [index.html](/d:/Workspace/defect_manage2/index.html)에 화면 모듈 로딩 순서 반영
- 검증 기준으로 `npm.cmd run check:syntax` 재통과

### 6.6 3차 개선 배치 반영
- [auth-module.js](/d:/Workspace/defect_manage2/js/modules/auth-module.js) 추가
- [list-module.js](/d:/Workspace/defect_manage2/js/modules/list-module.js) 추가
- [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js) 추가
- [form-module.js](/d:/Workspace/defect_manage2/js/modules/form-module.js) 추가
- [index.html](/d:/Workspace/defect_manage2/index.html)에 auth/list/admin/form 모듈 로딩 추가
- [js/app.js](/d:/Workspace/defect_manage2/js/app.js)에서 `renderStandaloneShell()`, `renderLogin()`, `renderSignup()`, `renderPasswordReset()`, `renderExtensionGuide()`, `renderUsers()`, `renderUserForm()`, `renderSettings()`, `renderCommonCodeForm()`, `renderList()`, `renderForm()`, `renderMobileQuickForm()`, `renderActionForm()`을 모듈 위임 구조로 축소
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에 `history/commonCodes/defects/logs/usersApi/settingsApi` 도메인 별칭 추가
- 현재 [js/app.js](/d:/Workspace/defect_manage2/js/app.js)는 약 `1751` lines / `80.96KB` 수준으로 축소
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit` 재통과

### 6.7 4차 개선 배치 반영
- [storage-query-utils.js](/d:/Workspace/defect_manage2/js/utils/storage-query-utils.js) 추가
- [index.html](/d:/Workspace/defect_manage2/index.html)에 storage query util 로딩 순서 반영
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에서 결함 필터, screen path 정규화, 공란 판별 같은 순수 쿼리 로직을 외부 유틸 사용 구조로 정리
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)의 사용자/설정 접근점을 `users/settings` 도메인명으로 정리하고, `usersApi/settingsApi`는 호환 별칭으로 유지
- [js/app.js](/d:/Workspace/defect_manage2/js/app.js)와 [auth-module.js](/d:/Workspace/defect_manage2/js/modules/auth-module.js)가 `StorageService.users`, `StorageService.settings`를 사용하도록 치환
- [storage-query-utils.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-query-utils.test.js) 추가로 결함 필터 적용 규칙과 screen path 정규화 회귀 테스트 보강
- 현재 [js/app.js](/d:/Workspace/defect_manage2/js/app.js)는 약 `1860` lines / `68.54KB` 수준
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit` 재통과
- [defect.spec.js](/d:/Workspace/defect_manage2/tests/e2e/defect.spec.js)의 홈 진입 기대값을 로그인 기본 화면 기준으로 정리
- 비파괴 E2E smoke로 `tests/e2e/simple.spec.js`, `tests/e2e/defect.spec.js --grep "Home should show login screen when logged out"` 통과

### 6.8 5차 storage 도메인 분리 배치 반영
- [common-code-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/common-code-storage-service.js) 추가
- [error-log-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/error-log-storage-service.js) 추가
- [user-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/user-storage-service.js) 추가
- [settings-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/settings-storage-service.js) 추가
- [index.html](/d:/Workspace/defect_manage2/index.html)에 storage 도메인 서비스 로딩 순서 반영
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에서 `common code`, `오류 로그`, `사용자`, `설정` 메서드 본체를 서비스 팩토리 결합 구조로 전환
- 현재 [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)는 약 `451` lines / `17.28KB` 수준으로 축소
- [storage-error-log-service.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-error-log-service.test.js) 추가로 오류 로그 정규화 회귀 테스트 보강
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit`, `tests/e2e/defect.spec.js --grep "Home should show login screen when logged out"` 통과

### 6.9 6차 defect/history 도메인 분리 배치 반영
- [history-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/history-storage-service.js) 추가
- [defect-storage-service.js](/d:/Workspace/defect_manage2/js/services/storage/defect-storage-service.js) 추가
- [index.html](/d:/Workspace/defect_manage2/index.html)에 history/defect storage 서비스 로딩 순서 반영
- [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)에서 남아 있던 `history`, `defect` 본체를 서비스 팩토리 결합 구조로 전환
- 현재 [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)는 약 `247` lines / `9.59KB` 수준으로 축소
- [storage-defect-service.test.js](/d:/Workspace/defect_manage2/tests/unit/storage-defect-service.test.js) 추가로 결함 저장 오류 상태와 재확인 필터 회귀 테스트 보강
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit`, `npx.cmd playwright test tests/e2e/defect.spec.js` 통과

### 6.10 7차 로컬 테스트 준비 배치 반영
- [admin-settings-module.js](/d:/Workspace/defect_manage2/js/modules/admin-settings-module.js) 추가
- [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js)에서 관리자 설정, 공통코드 폼, 저장 오류 로그, 결함조치재확인 패널 렌더링을 신규 모듈 위임 구조로 전환
- 현재 [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js)는 약 `146` lines / `9.55KB` 수준의 위임 레이어
- 현재 [js/app.js](/d:/Workspace/defect_manage2/js/app.js)는 약 `1610` lines / `69.09KB` 수준
- 현재 [js/storage.js](/d:/Workspace/defect_manage2/js/storage.js)는 약 `219` lines / `9.59KB` 수준
- [local_test_execution_checklist.md](/d:/Workspace/defect_manage2/docs/local_test_execution_checklist.md) 추가로 로컬 수동 테스트 전 준비, 자동 검증, 수동 점검 순서, 종료 기준을 문서화
- [server.js](/d:/Workspace/defect_manage2/server.js)가 `PORT` 환경변수를 지원하도록 정리되어 수동 실행 `3000` 포트와 Playwright 자동 검증 `3001` 포트를 분리
- [playwright.config.js](/d:/Workspace/defect_manage2/playwright.config.js)가 전용 `3001` 포트와 `reuseExistingServer: false` 기준으로 정리되어 다른 프로젝트 서버 재사용 충돌을 방지
- [defect.spec.js](/d:/Workspace/defect_manage2/tests/e2e/defect.spec.js)와 [simple.spec.js](/d:/Workspace/defect_manage2/tests/e2e/simple.spec.js)를 함께 실행하는 비파괴 E2E 세트를 기준 검증으로 확정
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit`, `npx.cmd playwright test tests/e2e/defect.spec.js tests/e2e/simple.spec.js` 통과
- 자동 검증 결과는 unit test `5`개 파일 `9`개 테스트 통과, 비파괴 E2E `3`개 시나리오 통과
- 현재 상태는 “실제 수동 로컬 테스트를 수행할 수 있는 직전 단계”로 정리

### 6.11 리팩토링 중 주요 UI 변경사항 반영
- [list-module.js](/d:/Workspace/defect_manage2/js/modules/list-module.js)에서 결함목록 페이지 번호 표시를 현재 구간 기준 `10페이지` 단위로 제한해 전체 페이지 번호가 한 번에 모두 보이지 않도록 정리
- [admin-module.js](/d:/Workspace/defect_manage2/js/modules/admin-module.js)에서 담당자관리 목록을 `15명` 단위로 나누는 페이징 적용
- [app.js](/d:/Workspace/defect_manage2/js/app.js)에 담당자관리 전용 페이지 상태 `userListConfig`와 `changeUserPage()`를 추가
- [app-utils.js](/d:/Workspace/defect_manage2/js/utils/app-utils.js)에 공통 페이징 범위 계산 유틸 `buildPaginationRange()` 추가
- [app-utils.test.js](/d:/Workspace/defect_manage2/tests/unit/app-utils.test.js) 추가로 페이지 구간 계산 회귀 테스트 보강
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit`, `npx.cmd playwright test tests/e2e/defect.spec.js tests/e2e/simple.spec.js` 재통과
- 자동 검증 결과는 unit test `6`개 파일 `11`개 테스트 통과, 비파괴 E2E `3`개 시나리오 통과

### 6.12 결함관리번호 표시 및 클릭 복사 UX 반영
- [form-module.js](/d:/Workspace/defect_manage2/js/modules/form-module.js)에서 일반 결함 관리 화면의 `테스트 구분` 바로 위에 결함관리번호 표시 영역을 추가
- 기존 결함 수정 시에만 `#ID` 형식의 읽기 전용 입력창을 노출하고, 신규 등록 폼과 모바일 퀵 등록 폼에서는 해당 영역을 숨김 처리
- 결함관리번호 입력창에 굵은 글씨와 강조색을 적용하고 커서를 `pointer`로 바꿔 클릭 가능 상태를 명확히 표시
- 라벨 옆 `(클릭하여 복사)` 안내 텍스트를 추가하고, 입력창 또는 안내 텍스트 클릭 시 결함관리번호 숫자를 클립보드에 복사하도록 처리
- [app.js](/d:/Workspace/defect_manage2/js/app.js)에 `copyDefectManagementId()`를 추가해 `결함관리번호 #ID를 복사했습니다.` 알림을 표시
- 검증 기준으로 `npm.cmd run check:syntax`, `npm.cmd run test:unit` 재통과

## 7. 저장소 및 버전관리 기준
- 원격 저장소: `https://github.com/mohenz/defect_manage2.git`
- 로컬 Git 저장소 초기화 완료
- 기본 브랜치: `main`
- 현재 방침:
- 준비 단계에서는 커밋하지 않음
- 구조 개선과 테스트가 완료된 뒤 의미 있는 완료 단위로 커밋

## 8. 서비스 전환 시 확인할 항목
- GitHub Pages 저장소 기준 경로
- Vercel 프로젝트 연결 대상
- [vercel.json](/d:/Workspace/defect_manage2/vercel.json) rewrite 동작
- `/`, `/test_page`, `/mobile_test_page` 라우트 정상 여부
- 외부 위젯 스크립트 URL
- Chrome extension 연결 주소
- 문서 내 안내 URL
- 기존 `defect_manage` 소스의 `defect_manage_old` 보관 시점
- 운영 저장소 파일 삭제 순서와 새 소스 업로드 순서
- Vercel 테스트 운영을 별도 프로젝트로 둘지, 기존 프로젝트의 staged deployment로 둘지 결정
- Vercel 테스트 URL 기준 extension / standalone / 외부 위젯 호출 검증 여부
- smoke test 및 rollback 절차

## 9. 다음 작업 기준
- [local_test_execution_checklist.md](/d:/Workspace/defect_manage2/docs/local_test_execution_checklist.md) 기준으로 실제 수동 로컬 테스트 수행
- 결함목록 `10페이지` 단위 번호 표시와 담당자관리 `15명` 단위 페이징 동작 수동 확인
- 일반 수정 폼에서 결함관리번호 표시/클릭 복사, 신규 등록 및 모바일 퀵 등록에서 숨김 동작 수동 확인
- 수동 테스트 중 발견 이슈 기록 및 우선순위 분류
- 특이사항이 없으면 `git` 반영 준비
- Vercel 테스트 운영 전략 확정
- 이후 `defect_manage_old` 보관, 운영 저장소 파일 정리, `defect_manage2` 소스 업로드 순서를 포함한 cutover 체크리스트 정리

## 10. 참조 문서
- 메인 계획서: [executable_size_structure_improvement_plan.md](/d:/Workspace/defect_manage2/docs/executable_size_structure_improvement_plan.md)
- 프로젝트 상태: [defect_manage2_current.md](/d:/Workspace/project_control/states/defect_manage2_current.md)
