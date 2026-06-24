(function attachDefectFlowAdminSettingsModule(global) {
    const adminSettingsModule = {
        renderSettings(app, container) {
            const types = app.getCodesByGroup('TEST_TYPE').map((code) => code.code_value);
            const enabled = app.state.settings.enabledTestTypes;
            const tabs = [
                { id: 'test-types', label: '테스트 구분 설정', icon: 'fa-vial' },
                { id: 'common-codes', label: '공통코드 관리', icon: 'fa-table-list' },
                { id: 'action-recheck', label: '결함조치재확인', icon: 'fa-clipboard-check' },
                { id: 'error-logs', label: '저장 오류 로그', icon: 'fa-triangle-exclamation' }
            ];
            const activeTab = app.state.settingsTab || 'test-types';
            const groupedCodes = [...new Set((app.state.commonCodes || []).map((code) => code.group_code))];

            container.innerHTML = `
                <header class="animate-in">
                    <div>
                        <h1>관리자 화면</h1>
                        <p class="subtitle">운영 현황과 전역 설정, 공통코드를 관리자 기준으로 관리합니다.</p>
                    </div>
                </header>

                <div class="form-container animate-in" style="max-width: 100%;">
                    <div style="display:flex; gap:0.75rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:1rem; flex-wrap:wrap;">
                        ${tabs.map((tab) => `
                            <button
                                type="button"
                                class="btn"
                                data-settings-tab="${tab.id}"
                                style="background:${activeTab === tab.id ? 'var(--accent)' : 'var(--bg-secondary)'}; color:${activeTab === tab.id ? 'white' : 'var(--text-primary)'}; border:1px solid var(--border);">
                                <i class="fas ${tab.icon}"></i> ${tab.label}
                            </button>
                        `).join('')}
                    </div>

                    <div id="settingsTabPanel">
                        ${activeTab === 'test-types' ? `
                            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-vial"></i> 테스트 구분 설정</h2>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
                                대시보드, 목록, 등록 화면에서 노출하고 관리할 테스트 단계를 선택하세요.
                            </p>

                            <form id="settingsForm">
                                <div style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-secondary); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                                    ${types.map((type) => `
                                        <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer; padding: 0.5rem; border-radius: 0.4rem; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                            <input type="checkbox" name="testTypes" value="${type}" ${enabled.includes(type) ? 'checked' : ''} style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                                            <span style="font-weight: 500;">${type}</span>
                                        </label>
                                    `).join('')}
                                </div>

                                <div style="margin-top: 2rem;">
                                    <button type="submit" class="btn btn-primary" style="width: 100%;"><i class="fas fa-save"></i> 설정 저장하기</button>
                                </div>
                            </form>
                        ` : activeTab === 'common-codes' ? `
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                                <div>
                                    <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-table-list"></i> 공통코드 관리</h2>
                                    <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                        테스트 구분, 상태, 심각도, 식별 등 공통 선택값을 전역으로 관리합니다.
                                    </p>
                                </div>
                                <button type="button" class="btn btn-primary" onclick="App.renderCommonCodeForm()">
                                    <i class="fas fa-plus"></i> 코드 추가
                                </button>
                            </div>

                            <div class="data-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>그룹코드</th>
                                            <th>코드값</th>
                                            <th>코드명</th>
                                            <th>색상</th>
                                            <th>정렬순서</th>
                                            <th>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${groupedCodes.map((group) => `
                                            <tr>
                                                <td colspan="6" style="background: var(--bg-secondary); font-weight: 700;">${group}</td>
                                            </tr>
                                            ${app.getCodesByGroup(group).map((code) => `
                                                <tr>
                                                    <td>${code.group_code}</td>
                                                    <td><strong>${code.code_value}</strong></td>
                                                    <td>${app.sanitize(code.code_name)}</td>
                                                    <td>
                                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                                            <span style="display:inline-block; width:16px; height:16px; border-radius:50%; border:1px solid var(--border); background:${code.color || '#ffffff'};"></span>
                                                            <span>${code.color || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td>${code.sort_order ?? 0}</td>
                                                    <td>
                                                        <div style="display:flex; gap:0.5rem;">
                                                            <button class="btn" style="padding:0.4rem; color: var(--accent)" onclick="App.renderCommonCodeForm('${code.group_code}', '${code.code_value}')"><i class="fas fa-edit"></i></button>
                                                            <button class="btn" style="padding:0.4rem; color: var(--error)" onclick="App.deleteCommonCode('${code.group_code}', '${code.code_value}')"><i class="fas fa-trash"></i></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem;">등록된 공통코드가 없습니다.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        ` : activeTab === 'action-recheck' ? `
                            ${app.renderDefectActionRecheckPanel()}
                        ` : `
                            ${app.renderDefectSaveErrorLogPanel()}
                        `}
                    </div>
                </div>
            `;

            document.querySelectorAll('[data-settings-tab]').forEach((button) => {
                button.onclick = () => {
                    app.state.settingsTab = button.dataset.settingsTab;
                    if (app.state.settingsTab === 'action-recheck' && !app.state.defectActionRecheckLoading) {
                        app.loadDefectActionRecheckItems({ silent: true });
                    }
                    if (app.state.settingsTab === 'error-logs' && !app.state.defectSaveErrorLogsLoading) {
                        app.loadDefectSaveErrorLogs({ silent: true });
                    }
                    app.render();
                };
            });

            if (activeTab === 'action-recheck' && !app.state.defectActionRecheckLoaded && !app.state.defectActionRecheckLoading) {
                app.loadDefectActionRecheckItems({ silent: true });
            }

            if (activeTab === 'error-logs' && !app.state.defectSaveErrorLogsLoaded && !app.state.defectSaveErrorLogsLoading) {
                app.loadDefectSaveErrorLogs({ silent: true });
            }

            const settingsForm = document.getElementById('settingsForm');
            if (settingsForm) {
                settingsForm.onsubmit = (event) => {
                    event.preventDefault();
                    const checked = Array.from(event.target.querySelectorAll('input[name="testTypes"]:checked')).map((input) => input.value);
                    if (checked.length === 0) {
                        alert('최소 하나 이상의 테스트 구분을 선택해야 합니다.');
                        return;
                    }
                    app.updateSettings({ enabledTestTypes: checked });
                };
            }
        },

        renderCommonCodeForm(app, groupCode = '', codeValue = '') {
            const code = groupCode && codeValue
                ? (app.state.commonCodes || []).find((item) => item.group_code === groupCode && item.code_value === codeValue)
                : null;
            const modalBody = document.getElementById('modalBody');

            modalBody.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <h1>${code ? '공통코드 수정' : '공통코드 추가'}</h1>
                    <p class="subtitle">공통 선택값과 표시 정보를 관리합니다.</p>
                </div>
                <form id="commonCodeForm">
                    <input type="hidden" name="original_group_code" value="${app.sanitize(code?.group_code || '')}">
                    <input type="hidden" name="original_code_value" value="${app.sanitize(code?.code_value || '')}">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                        <div class="form-group">
                            <label>그룹코드</label>
                            <input type="text" name="group_code" value="${app.sanitize(code?.group_code || '')}" required placeholder="예: STATUS">
                        </div>
                        <div class="form-group">
                            <label>코드값</label>
                            <input type="text" name="code_value" value="${app.sanitize(code?.code_value || '')}" required placeholder="예: Open">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:1.5rem;">
                        <div class="form-group">
                            <label>코드명</label>
                            <input type="text" name="code_name" value="${app.sanitize(code?.code_name || '')}" required placeholder="예: 진행중">
                        </div>
                        <div class="form-group">
                            <label>색상</label>
                            <input type="color" name="color" value="${code?.color || '#64748b'}">
                        </div>
                        <div class="form-group">
                            <label>정렬순서</label>
                            <input type="number" name="sort_order" value="${code?.sort_order ?? 0}" min="0" step="1">
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; margin-top:2rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">${code ? '저장하기' : '등록하기'}</button>
                        <button type="button" class="btn" style="flex:1; background: var(--bg-secondary);" onclick="App.closeModal()">취소</button>
                    </div>
                </form>
            `;

            app.openModal();
            document.getElementById('commonCodeForm').onsubmit = async (event) => {
                event.preventDefault();
                const formData = new FormData(event.target);
                const payload = {
                    group_code: String(formData.get('group_code') || '').trim().toUpperCase(),
                    code_value: String(formData.get('code_value') || '').trim(),
                    code_name: String(formData.get('code_name') || '').trim(),
                    color: String(formData.get('color') || '').trim(),
                    sort_order: String(formData.get('sort_order') || '0').trim()
                };
                const originalKey = formData.get('original_group_code') && formData.get('original_code_value')
                    ? {
                        group_code: String(formData.get('original_group_code')),
                        code_value: String(formData.get('original_code_value'))
                    }
                    : null;

                if (!payload.group_code || !payload.code_value || !payload.code_name) {
                    alert('그룹코드, 코드값, 코드명은 필수입니다.');
                    return;
                }

                if (await StorageService.commonCodes.save(payload, originalKey)) {
                    app.state.commonCodes = await StorageService.commonCodes.fetch();
                    app.closeModal();
                    app.render();
                    alert(code ? '공통코드가 수정되었습니다.' : '공통코드가 등록되었습니다.');
                } else {
                    alert('공통코드 저장에 실패했습니다.');
                }
            };
        },

        showDefectSaveErrorLogDetail(app, index) {
            const logs = app.state.defectSaveErrorLogsLoaded ? app.state.defectSaveErrorLogs : app.getDefectSaveErrorLogs();
            const entry = logs[index];
            if (!entry) {
                alert('선택한 오류 로그를 찾지 못했습니다.');
                return;
            }

            const modalBody = document.getElementById('modalBody');
            modalBody.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <h1>저장 오류 로그 상세</h1>
                    <p class="subtitle">오류 로그 ID: ${app.sanitize(entry.log_id)}</p>
                </div>
                <div style="display:flex; justify-content:space-between; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                    <span class="badge" style="background: #fee2e2; color: #991b1b;">${app.sanitize(entry.operation || '-')}</span>
                    <span style="font-size:0.875rem; color: var(--text-secondary);">${app.formatDateKST(entry.created_at)}</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
                    <div style="padding:0.85rem 1rem; border:1px solid var(--border); border-radius:0.75rem; background: var(--bg-secondary);">
                        <div style="font-size:0.75rem; color: var(--text-muted); margin-bottom:0.25rem;">등록자</div>
                        <div style="font-weight:600;">${app.sanitize(entry.creator_name || entry.payload_summary?.creator || '-')}</div>
                    </div>
                    <div style="padding:0.85rem 1rem; border:1px solid var(--border); border-radius:0.75rem; background: var(--bg-secondary);">
                        <div style="font-size:0.75rem; color: var(--text-muted); margin-bottom:0.25rem;">실제 작업자</div>
                        <div style="font-weight:600;">${app.sanitize(entry.reporter_name || entry.runtime?.current_user || '-')}</div>
                    </div>
                </div>
                <pre style="margin:0; padding:1rem; border:1px solid var(--border); border-radius:0.75rem; background: var(--bg-secondary); color: var(--text-primary); overflow:auto; max-height: 60vh; white-space: pre-wrap;">${app.sanitize(JSON.stringify(entry, null, 2))}</pre>
                <div style="margin-top: 1.5rem; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-primary" onclick="App.closeModal()">닫기</button>
                </div>
            `;
            app.state.currentModal = 'save-error-log';
            app.openModal();
        },

        renderDefectSaveErrorLogPanel(app) {
            const logs = app.state.defectSaveErrorLogs || [];
            const localBackupCount = app.getDefectSaveErrorLogs().length;
            const loadingMessage = app.state.defectSaveErrorLogsLoading
                ? '<tr><td colspan="8" style="text-align:center; padding:2rem;">중앙 오류 로그를 불러오는 중입니다.</td></tr>'
                : '';
            const emptyMessage = !app.state.defectSaveErrorLogsLoading && logs.length === 0
                ? '<tr><td colspan="8" style="text-align:center; padding:2rem;">중앙 저장 오류 로그가 없습니다.</td></tr>'
                : '';
            const errorBanner = app.state.defectSaveErrorLogsError
                ? `<div style="margin-bottom:1rem; padding:0.9rem 1rem; border-radius:0.75rem; background:#fff7ed; border:1px solid #fdba74; color:#9a3412; font-size:0.875rem;">중앙 로그 조회 실패: ${app.sanitize(app.state.defectSaveErrorLogsError)}</div>`
                : '';

            return `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-triangle-exclamation"></i> 결함 저장 오류 로그</h2>
                        <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.7;">
                            저장 실패 시 중앙 DB 테이블에 로그를 남기고, 이 브라우저에는 최근 ${global.DEFECT_SAVE_ERROR_LOG_LIMIT || 50}건의 로컬 백업을 함께 유지합니다.
                        </p>
                        <p style="color: var(--text-muted); font-size: 0.8125rem; line-height: 1.6; margin-top: 0.35rem;">
                            현재 로컬 백업 로그 수: ${localBackupCount}건
                        </p>
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button type="button" class="btn" style="background: var(--bg-secondary); border:1px solid var(--border);" onclick="App.loadDefectSaveErrorLogs()">
                            <i class="fas fa-rotate-right"></i> 중앙 로그 새로고침
                        </button>
                        <button type="button" class="btn" style="background: var(--bg-secondary); border:1px solid var(--border);" onclick="App.downloadDefectSaveErrorLogs()">
                            <i class="fas fa-download"></i> JSON 다운로드
                        </button>
                        <button type="button" class="btn" style="background: #fee2e2; color:#991b1b; border:1px solid #fecaca;" onclick="App.clearDefectSaveErrorLogs()">
                            <i class="fas fa-trash"></i> 로컬 백업 초기화
                        </button>
                    </div>
                </div>

                ${errorBanner}

                <div class="data-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>발생 시각</th>
                                <th>작업</th>
                                <th>연동 경로</th>
                                <th>제목</th>
                                <th>등록자</th>
                                <th>캡처</th>
                                <th>오류 메시지</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${loadingMessage || logs.map((entry, index) => `
                                <tr>
                                    <td>${app.formatDateKST(entry.created_at)}</td>
                                    <td>${app.sanitize(entry.operation || '-')}</td>
                                    <td>${app.sanitize(entry.pending_source || '-')}</td>
                                    <td style="max-width:240px; white-space:normal;">${app.sanitize(entry.payload_summary?.title || '-')}</td>
                                    <td>${app.sanitize(entry.creator_name || entry.payload_summary?.creator || '-')}</td>
                                    <td>${entry.payload_summary?.has_screenshot ? `${Number(entry.payload_summary.screenshot_length || 0).toLocaleString('ko-KR')} chars` : '-'}</td>
                                    <td style="max-width:280px; white-space:normal;">${app.sanitize(entry.message || '-')}</td>
                                    <td>
                                        <button type="button" class="btn" style="padding:0.4rem 0.75rem; color: var(--accent);" onclick="App.showDefectSaveErrorLogDetail(${index})">
                                            <i class="fas fa-file-lines"></i> 상세
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || emptyMessage}
                        </tbody>
                    </table>
                </div>
            `;
        },

        renderDefectActionRecheckPanel(app) {
            const items = app.state.defectActionRecheckItems || [];
            const loadingMessage = app.state.defectActionRecheckLoading
                ? '<tr><td colspan="3" style="text-align:center; padding:2rem;">결함조치재확인 목록을 불러오는 중입니다.</td></tr>'
                : '';
            const emptyMessage = !app.state.defectActionRecheckLoading && items.length === 0
                ? '<tr><td colspan="3" style="text-align:center; padding:2rem;">재확인이 필요한 결함이 없습니다.</td></tr>'
                : '';
            const errorBanner = app.state.defectActionRecheckError
                ? `<div style="margin-bottom:1rem; padding:0.9rem 1rem; border-radius:0.75rem; background:#fff7ed; border:1px solid #fdba74; color:#9a3412; font-size:0.875rem;">목록 조회 실패: ${app.sanitize(app.state.defectActionRecheckError)}</div>`
                : '';

            return `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-clipboard-check"></i> 결함조치재확인</h2>
                        <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.7;">
                            상태가 완료 계열(<code>Closed</code>, <code>Resolved</code>, <code>Staging</code>)인데도 결함식별과 조치내용이 모두 비어 있는 항목을 확인합니다.
                        </p>
                        <p style="color: var(--text-muted); font-size: 0.8125rem; line-height: 1.6; margin-top: 0.35rem;">
                            현재 대상 건수: ${items.length}건
                        </p>
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button type="button" class="btn" style="background: var(--bg-secondary); border:1px solid var(--border);" onclick="App.loadDefectActionRecheckItems()">
                            <i class="fas fa-rotate-right"></i> 목록 새로고침
                        </button>
                    </div>
                </div>

                ${errorBanner}

                <div class="data-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Defect ID</th>
                                <th>담당자</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${loadingMessage}
                            ${!app.state.defectActionRecheckLoading ? items.map((item) => `
                                <tr>
                                    <td><strong class="clickable-link" onclick="App.viewDefectInList(${item.defect_id})">#${item.defect_id}</strong></td>
                                    <td>${app.sanitize(item.assignee || '-')}</td>
                                    <td>
                                        <span class="badge" style="background-color: ${app.getCodeColor('STATUS', item.status) || '#64748b'}; color: white;">
                                            ${app.getCodeName('STATUS', item.status)}
                                        </span>
                                    </td>
                                </tr>
                            `).join('') : ''}
                            ${emptyMessage}
                        </tbody>
                    </table>
                </div>
            `;
        }
    };

    global.DefectFlowAdminSettingsModule = adminSettingsModule;
})(window);
