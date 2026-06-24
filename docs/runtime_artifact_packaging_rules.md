# DefectFlow 런타임 아티팩트 포함/제외 규칙

## 1. 목적
- `defect_manage2` 개선 작업 중 실행 및 배포에 필요한 파일만 유지한다.
- 개발/테스트 산출물이 서비스 아티팩트에 포함되어 실행 파일 또는 배포본이 비대해지는 문제를 방지한다.

## 2. 적용 기준
- 기준 프로젝트: [defect_manage2](/d:/Workspace/defect_manage2)
- 적용 대상:
- 로컬 전달용 실행 패키지
- GitHub Pages 배포 준비 산출물
- Vercel 서비스용 정적/서버 파일

## 3. 실행 필수 포함 대상
- 루트 파일:
- [index.html](/d:/Workspace/defect_manage2/index.html)
- [server.js](/d:/Workspace/defect_manage2/server.js)
- [package.json](/d:/Workspace/defect_manage2/package.json)
- [package-lock.json](/d:/Workspace/defect_manage2/package-lock.json)
- [vercel.json](/d:/Workspace/defect_manage2/vercel.json)

- 프론트엔드 경로:
- [css](/d:/Workspace/defect_manage2/css)
- [js](/d:/Workspace/defect_manage2/js)
- [images](/d:/Workspace/defect_manage2/images)
- [extension](/d:/Workspace/defect_manage2/extension)

- 운영 참고 문서:
- [README.md](/d:/Workspace/defect_manage2/README.md)
- [docs/README_ko.md](/d:/Workspace/defect_manage2/docs/README_ko.md)

## 4. 기본 제외 대상
- 개발 의존성/캐시:
- `node_modules/`
- `.git/`
- `.DS_Store`

- 테스트 산출물:
- `test-results/`
- `playwright-report/`
- `e2e_debug_final_*.txt`

- 테스트용 자산:
- `tests/`
- `test_view/`

- 작업 중 임시 로그:
- `.server.err.log`
- `.server.out.log`
- `*.log`

## 5. 조건부 제외 대상
- `docs/`
  운영 문서 제공이 필요 없으면 배포 아티팩트에서는 제외 가능
- `.github/`
  런타임에는 불필요하므로 전달용 패키지에서는 제외 가능
- `.agent/`
  런타임에는 불필요하므로 제외 가능
- `database/`
  이번 프로젝트 범위는 DB 구조 변경이 아니므로 운영 패키지 필수 대상은 아님. 다만 참고용 SQL 보관이 필요하면 저장소에는 유지 가능

## 6. 권장 패키징 원칙
- 원칙 1: 화이트리스트 우선
  포함 대상을 먼저 확정하고 나머지를 제외하는 방식으로 패키징한다.
- 원칙 2: 서비스와 검증을 분리
  GitHub Pages / Vercel 서비스 아티팩트와 테스트 실행 파일 세트는 분리 관리한다.
- 원칙 3: extension 경로 유지
  Chrome 확장프로그램 다운로드/안내 흐름 때문에 `extension/extension.zip`과 `extension/defectflow-reporter/`는 누락되지 않게 유지한다.
- 원칙 4: 외부 연동 경로 사전 확인
  `test_page`, `mobile_test_page`, standalone 등록, extension 안내에서 참조하는 경로를 배포 직전 확인한다.

## 7. 서비스 교체 시 주의사항
- 최종 목표는 현재 `defect_manage`로 서비스 중인 GitHub Pages / Vercel 운영 대상을 `defect_manage2`로 교체하는 것이다.
- 따라서 패키징 규칙은 “새 서비스 추가”가 아니라 “기존 운영 서비스 대체” 기준으로 검토해야 한다.
- 교체 직전 아래 항목을 다시 확인한다.
- 정적 경로
- 외부 위젯 URL
- extension 연결 주소
- `vercel.json` rewrite
- `/test_page`, `/mobile_test_page`

## 8. 다음 작업
- 필요 시 실제 배포용 아티팩트 생성 스크립트 추가
- GitHub Pages / Vercel cutover 체크리스트와 연결
