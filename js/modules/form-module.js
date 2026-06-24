(function attachDefectFlowFormModule(global) {
    const BridgeService = global.DefectFlowBridgeService;

    function renderDefectManagementIdField(app, defectId) {
        const normalizedId = String(defectId || '').replace(/^#/, '').trim();
        if (!normalizedId) {
            return '';
        }

        const displayId = `#${normalizedId}`;
        const copyIdLiteral = JSON.stringify(normalizedId);

        return `
            <div class="form-group">
                <label style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    결함관리번호
                    <span
                        role="button"
                        tabindex="0"
                        style="font-size:0.75rem; color:var(--accent); font-weight:700; cursor:pointer;"
                        onclick="App.copyDefectManagementId(${copyIdLiteral})"
                        onkeydown="if(event.key==='Enter' || event.key===' '){ event.preventDefault(); App.copyDefectManagementId(${copyIdLiteral}); }"
                    >(클릭하여 복사)</span>
                </label>
                <input
                    type="text"
                    value="${app.sanitize(displayId)}"
                    readonly
                    title="클릭하여 복사"
                    aria-label="결함관리번호 ${app.sanitize(displayId)}"
                    style="font-weight:700; color:var(--accent); border:1px solid var(--accent); cursor:pointer; background:var(--bg-secondary);"
                    onclick="App.copyDefectManagementId(${copyIdLiteral})">
            </div>
        `;
    }

    const formModule = {
        renderForm(app, container, id = null, itemOverride = null) {
            const isAdmin = app.getEffectiveRole() === '관리자';
            const isNewDefect = !id;
            const currentUserName = app.state.currentUser?.name || '';
            const canAssign = isNewDefect || app.canEditAssignee();
            let item = itemOverride || (id ? app.getSelectedDefect(id) : {}) || {};
            app.state.pendingDefectSource = '';

            if (isNewDefect) {
                item = {
                    severity: 'Minor',
                    priority: 'Medium',
                    creator: currentUserName,
                    ...item
                };
            }

            if (!id) {
                const pending = BridgeService.resolvePendingDefectData({
                    messageData: app.state.pendingDefectData
                });

                if (pending.source) {
                    app.state.pendingDefectSource = pending.source;
                }

                if (pending.data) {
                    const data = pending.data;
                    if (pending.source === 'postMessage') {
                        console.log('[App] Using data from postMessage (Cross-Domain)');
                    } else if (pending.source === 'localStorage') {
                        console.log('[App] Using data from localStorage (Same-Domain)');
                    }

                    item = {
                        ...item,
                        title: data.title,
                        severity: data.severity,
                        priority: data.priority,
                        menu_name: data.menu_name,
                        screen_name: data.screen_name,
                        screen_url: app.normalizeScreenUrl(data.screen_url),
                        screenshot: data.screenshot,
                        env_info: data.env_info,
                        test_type: data.test_type,
                        steps_to_repro: data.steps_to_repro
                    };
                    console.log('[App] Pending defect data consumed. Screenshot status:', !!data.screenshot);
                }
            }

            if (isNewDefect) {
                item.severity = item.severity || 'Minor';
                item.priority = item.priority || 'Medium';
            }

            const screenshotSource = item.screenshot || '';
            const usesTransientScreenshot = screenshotSource.startsWith('data:image');
            app.state.transientScreenshotData = usesTransientScreenshot ? screenshotSource : '';
            const persistedScreenshot = usesTransientScreenshot ? '' : screenshotSource;
            const previewSource = app.state.transientScreenshotData || persistedScreenshot || '';

            const title = id ? '결함 정보 관리' : '신규 결함 등록';
            const selectedScreenPath = app.buildScreenPath(item.menu_name, item.screen_name);
            const parsedScreenPath = app.parseScreenPath(selectedScreenPath);
            const showMobileQuickLauncher = isAdmin && isNewDefect && !app.state.isMobileQuickMode;
            const resolvedCreator = id ? (item.creator || currentUserName) : currentUserName;
            const canViewScreenUrl = !!id && ['조치자', '관리자'].includes(app.state.currentRole);
            const normalizedScreenUrl = app.normalizeScreenUrl(item.screen_url || '');

            container.innerHTML = `
                <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h1>${title}</h1>
                        <p class="subtitle">결함을 상세하게 기록해 주세요.</p>
                    </div>
                    ${showMobileQuickLauncher ? `
                        <button type="button" class="btn" style="background: var(--bg-secondary); border: 1px solid var(--border);" onclick="App.openMobileQuickRegister()">
                            <i class="fas fa-mobile-screen-button"></i> 모바일 전용 화면 열기
                        </button>
                    ` : ''}
                </div>

                <div class="${id ? '' : 'form-container animate-in'}">
                    <form id="defectForm">
                        ${renderDefectManagementIdField(app, id)}

                        <div class="form-group">
                            <label>테스트 구분</label>
                            <select name="test_type" required>
                                ${app.getVisibleTestTypeCodes(item.test_type).map((code) => `<option value="${code.code_value}" ${item.test_type === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>결함 제목 (필수)</label>
                            <input type="text" name="title" value="${app.sanitize(item.title || '')}" required placeholder="간결하고 명확한 제목을 입력하세요">
                        </div>

                        <div class="form-group">
                            <label>결함 발생 화면</label>
                            <select name="screen_path" onchange="App.updateScreenPathPreview(this.value)">
                                <option value="">선택하세요</option>
                                ${app.getScreenPathOptions(selectedScreenPath).map((code) => `
                                    <option value="${app.sanitize(code.code_value)}" ${selectedScreenPath === code.code_value ? 'selected' : ''}>${app.sanitize(code.code_name)}</option>
                                `).join('')}
                            </select>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 공통코드의 화면 목록에서 선택하면 메뉴명과 화면명이 자동으로 매핑됩니다.${id ? '' : ' 자동 입력 후 직접 수정도 가능합니다.'}</p>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label>메뉴명</label>
                                <input type="text" id="menuNamePreview" name="menu_name" value="${app.sanitize(parsedScreenPath.menuName || item.menu_name || '')}" placeholder="${id ? '선택한 화면 기준으로 자동 입력' : '직접 입력하거나 화면 선택 후 자동 입력'}" ${id ? 'readonly' : ''}>
                            </div>
                            <div class="form-group">
                                <label>화면명</label>
                                <input type="text" id="screenNamePreview" name="screen_name" value="${app.sanitize(parsedScreenPath.screenName || item.screen_name || '')}" placeholder="${id ? '선택한 화면 기준으로 자동 입력' : '직접 입력하거나 화면 선택 후 자동 입력'}" ${id ? 'readonly' : ''}>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label>심각도</label>
                                <select name="severity" ${(!id || app.state.currentRole === '관리자' || (app.state.currentUser && item.creator === app.state.currentUser.name)) ? '' : 'disabled'}>
                                    ${app.getCodesByGroup('SEVERITY').map((code) => `<option value="${code.code_value}" ${item.severity === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                                </select>
                                ${(id && app.state.currentRole !== '관리자' && (app.state.currentUser && item.creator !== app.state.currentUser.name)) ? '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 심각도는 작성자 또는 관리자만 수정 가능합니다.</p>' : ''}
                            </div>
                            <div class="form-group">
                                <label>우선순위</label>
                                <select name="priority">
                                    ${app.getCodesByGroup('PRIORITY').map((code) => `<option value="${code.code_value}" ${item.priority === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>재현 단계 (Steps to Reproduce)</label>
                            <textarea name="steps_to_repro" rows="8" placeholder="1. 로그인 페이지 접속&#10;2. 아이디 입력...">${app.sanitize(item.steps_to_repro || '')}</textarea>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label>등록자</label>
                                <input type="text" value="${app.sanitize(resolvedCreator)}" readonly>
                                <input type="hidden" name="creator" value="${app.sanitize(resolvedCreator)}">
                            </div>
                            <div class="form-group">
                                <label>담당자 (조치자) ${canAssign ? '<i class="fas fa-edit" style="color:var(--accent); font-size:0.8rem;"></i>' : ''}</label>
                                <select name="assignee" ${canAssign ? '' : 'disabled'}>
                                    <option value="">선택 안함</option>
                                    ${app.state.users.filter((user) => app.isUserActive(user.status) && user.role === '조치자').map((user) => `
                                        <option value="${app.sanitize(user.name)}" ${item.assignee === user.name ? 'selected' : ''}>${app.sanitize(user.name)} (${user.department})</option>
                                    `).join('')}
                                </select>
                                ${isNewDefect
                ? '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 신규 등록 시 담당자(조치자)를 선택할 수 있습니다.</p>'
                : (canAssign
                    ? '<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 관리자와 조치자는 결함정보관리 화면에서 담당자 정보를 수정할 수 있습니다.</p>'
                    : '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 담당자 정보는 관리자 또는 조치자만 수정 가능합니다.</p>')
            }
                                ${!canAssign ? `<input type="hidden" name="assignee" value="${app.sanitize(item.assignee || '')}">` : ''}
                            </div>
                        </div>

                        ${canViewScreenUrl ? `
                        <div class="form-group">
                            <label>Screen URL</label>
                            <div style="display:flex; gap:0.75rem; align-items:flex-start; flex-wrap:wrap;">
                                <textarea rows="3" readonly style="flex:1 1 480px; min-height:88px; resize:vertical;">${app.sanitize(normalizedScreenUrl)}</textarea>
                                <button
                                    type="button"
                                    class="btn"
                                    style="background: var(--bg-secondary); border: 1px solid var(--border);"
                                    onclick="App.copyScreenUrl()"
                                    ${normalizedScreenUrl ? '' : 'disabled'}>
                                    <i class="fas fa-copy"></i> Screen URL 복사하기
                                </button>
                            </div>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
                                ${normalizedScreenUrl ? '조치자와 관리자는 등록 당시의 원본 화면 URL을 확인하고 복사할 수 있습니다.' : '등록된 Screen URL 정보가 없습니다.'}
                            </p>
                        </div>
                        ` : ''}

                        <div class="form-group">
                            <label>이미지 첨부</label>
                            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                                <button type="button" class="btn" style="background: var(--bg-secondary); border: 1px dashed var(--border);" onclick="document.getElementById('imageUpload').click()">
                                    <i class="fas fa-upload"></i> 이미지 직접 업로드
                                </button>
                                <span id="fileNameDisplay" style="font-size: 0.8125rem; color: var(--text-muted);">선택된 파일 없음</span>
                                <input type="file" id="imageUpload" accept="image/*" style="display: none;" onchange="
                                    const file = this.files[0];
                                    if(file) {
                                        document.getElementById('fileNameDisplay').textContent = file.name;
                                        App.handleImageUpload(this);
                                    }
                                ">
                            </div>
                        </div>

                        <input type="hidden" name="screen_url" value="${app.sanitize(normalizedScreenUrl)}">
                        <input type="hidden" name="screenshot" value="${app.sanitize(persistedScreenshot)}">

                        <div id="imagePreviewWrapper" style="margin-bottom: 2rem; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; ${(previewSource || normalizedScreenUrl) ? '' : 'display: none;'}">
                            <div style="background: var(--bg-secondary); padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8125rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                                <span><i class="fas fa-eye"></i> 이미지 미리보기</span>
                                <a href="javascript:void(0)"
                                   style="color: var(--accent); text-decoration: none;"
                                   onclick="App.viewCurrentPreview('${app.sanitize(normalizedScreenUrl)}');">
                                   <i class="fas fa-search-plus"></i> 클릭하여 확대 보기
                                </a>
                            </div>
                            <div id="imagePreviewArea" style="width: 100%; height: 350px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
                                ${(previewSource && app.isImageSource(previewSource))
                ? `<img src="${previewSource}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                : ((normalizedScreenUrl || screenshotSource)
                    ? '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">캡처 이미지가 없습니다. 상단의 확대 보기로 원본 화면을 확인해 주세요.</div>'
                    : '')
            }
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label>변경할 상태</label>
                                <select name="status">
                                    ${app.getCodesByGroup('STATUS').map((code) => `<option value="${code.code_value}" ${item.status === code.code_value ? 'selected' : ''}>${code.code_name} (${code.code_value})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>결함식별 (조치자/관리자 전용)</label>
                                <select name="defect_identification" ${(['조치자', '관리자'].includes(app.state.currentRole)) ? '' : 'disabled'}>
                                    <option value="">선택하세요</option>
                                    ${app.getCodesByGroup('IDENTIFICATION').map((code) => `<option value="${code.code_value}" ${item.defect_identification === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                                </select>
                                ${(!['조치자', '관리자'].includes(app.state.currentRole)) ? '<p style="font-size: 0.75rem; color: var(--error); margin-top: 0.25rem;">* 조치자 또는 관리자만 수정 가능합니다.</p>' : ''}
                            </div>
                        </div>

                        ${id ? `
                        <div style="margin: 2rem 0; padding-top: 1.5rem; border-top: 2px dashed var(--border);">
                            <h3 style="margin-bottom: 1.5rem; color: var(--info); font-size: 1rem;"><i class="fas fa-tools"></i> 결함 조치 결과 (Action Results)</h3>
                            
                            <div class="form-group">
                                <label>결함 조치 내용</label>
                                <textarea name="action_comment" rows="4" placeholder="원인 분석 및 조치 내용을 상세히 기록하세요">${app.sanitize(item.action_comment || '')}</textarea>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>조치 예정일</label>
                                    <input type="date" name="action_due_date" value="${app.getKSTDateString(item.action_due_date)}">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>조치 시작일</label>
                                    <input type="date" name="action_start" value="${app.getKSTDateString(item.action_start)}">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>조치 완료일</label>
                                    <input type="date" name="action_end" value="${app.getKSTDateString(item.action_end)}">
                                </div>
                            </div>
                        </div>
                        ` : ''}

                        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                            <button type="submit" class="btn btn-primary">${id ? '수정 완료' : '결함 등록'}</button>
                        </div>

                        ${!id ? `
                        <div style="margin-top: 2rem; padding: 1.25rem 1.5rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--bg-secondary);">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                <div>
                                    <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
                                        <i class="fas fa-puzzle-piece"></i> Chrome 확장프로그램으로 깨끗한 품질의 화면 캡쳐로 결함 등록이 가능합니다. 설치 안내를 확인해주세요.
                                    </p>
                                </div>
                                <button type="button" class="btn" style="background: white; border: 1px solid var(--border);" onclick="App.openExtensionGuide()">
                                    <i class="fas fa-download"></i> 설치하기
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </form>
                </div>
            `;

            document.getElementById('defectForm').addEventListener('submit', (event) => {
                event.preventDefault();
                app.handleFormSubmit(id);
            });
        },

        renderMobileQuickForm(app, container, itemOverride = null) {
            const currentUserName = app.state.currentUser?.name || '';
            let item = {
                severity: 'Minor',
                priority: 'Medium',
                creator: currentUserName,
                ...itemOverride
            };
            app.state.pendingDefectSource = '';

            const pending = BridgeService.resolvePendingDefectData({
                messageData: app.state.pendingDefectData
            });

            if (pending.source) {
                app.state.pendingDefectSource = pending.source;
            }

            if (pending.data) {
                const data = pending.data;
                item = {
                    ...item,
                    title: data.title,
                    severity: data.severity,
                    priority: data.priority,
                    menu_name: data.menu_name,
                    screen_name: data.screen_name,
                    screen_url: app.normalizeScreenUrl(data.screen_url),
                    test_type: data.test_type,
                    steps_to_repro: data.steps_to_repro
                };
            }

            app.state.transientScreenshotData = '';
            const selectedScreenPath = app.buildScreenPath(item.menu_name, item.screen_name);
            const parsedScreenPath = app.parseScreenPath(selectedScreenPath);
            const mobileScreenOptions = app.getMobileScreenPathOptions(selectedScreenPath);
            const envInfo = item.env_info || `Mobile Quick Entry | UA: ${navigator.userAgent}`;

            container.innerHTML = `
                <div style="margin-bottom: 1.5rem;">
                    <h1>모바일 결함 등록</h1>
                    <p class="subtitle">모바일웹 환경에서 필요한 최소 정보만 빠르게 등록합니다.</p>
                </div>

                <div class="form-container animate-in mobile-quick-form">
                    <form id="defectForm">
                        <div class="form-group">
                            <label>📝 결함 제목 (필수)</label>
                            <input type="text" name="title" value="${app.sanitize(item.title || '')}" required placeholder="결함 제목 입력">
                        </div>

                        <div class="form-group">
                            <label>📍 결함 발생 화면</label>
                            <select name="screen_path" onchange="App.updateScreenPathPreview(this.value)" required>
                                <option value="" ${selectedScreenPath ? '' : 'selected'}>선택하세요</option>
                                ${mobileScreenOptions.map((code) => `
                                    <option value="${app.sanitize(code.code_value)}" ${selectedScreenPath === code.code_value ? 'selected' : ''}>${app.sanitize(code.code_name)}</option>
                                `).join('')}
                            </select>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">* 화면 목록에서 선택하면 메뉴명과 화면명이 자동 입력됩니다. 자동 입력 후 직접 수정도 가능합니다.</p>
                        </div>

                        <div class="mobile-quick-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>메뉴명</label>
                                <input type="text" id="menuNamePreview" name="menu_name" value="${app.sanitize(parsedScreenPath.menuName || item.menu_name || '')}" placeholder="직접 입력하거나 화면 선택 후 자동 입력">
                            </div>
                            <div class="form-group">
                                <label>화면명</label>
                                <input type="text" id="screenNamePreview" name="screen_name" value="${app.sanitize(parsedScreenPath.screenName || item.screen_name || '')}" placeholder="직접 입력하거나 화면 선택 후 자동 입력">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>📄 결함 내용 또는 재현 절차 (필수)</label>
                            <textarea name="steps_to_repro" rows="5" required placeholder="결함내용을 입력하세요">${app.sanitize(item.steps_to_repro || '')}</textarea>
                        </div>

                        <div class="form-group">
                            <label>🧪 테스트 구분 (필수)</label>
                            <select name="test_type" required>
                                ${app.getVisibleTestTypeCodes(item.test_type).map((code) => `<option value="${code.code_value}" ${item.test_type === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="mobile-quick-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>🚨 심각도 (필수)</label>
                                <select name="severity" required>
                                    ${app.getCodesByGroup('SEVERITY').map((code) => `<option value="${code.code_value}" ${item.severity === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>🎯 우선순위 (필수)</label>
                                <select name="priority" required>
                                    ${app.getCodesByGroup('PRIORITY').map((code) => `<option value="${code.code_value}" ${item.priority === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>👤 등록자</label>
                            <input type="text" value="${app.sanitize(currentUserName)}" readonly>
                            <input type="hidden" name="creator" value="${app.sanitize(currentUserName)}">
                        </div>

                        <input type="hidden" name="screenshot" value="">
                        <input type="hidden" name="screen_url" value="${app.sanitize(item.screen_url || '')}">
                        <input type="hidden" name="status" value="${app.sanitize(item.status || 'Open')}">
                        <input type="hidden" name="assignee" value="${app.sanitize(item.assignee || '')}">
                        <input type="hidden" name="defect_identification" value="${app.sanitize(item.defect_identification || '')}">
                        <input type="hidden" name="action_comment" value="">
                        <input type="hidden" name="action_due_date" value="">
                        <input type="hidden" name="action_start" value="">
                        <input type="hidden" name="action_end" value="">
                        <input type="hidden" name="env_info" value="${app.sanitize(envInfo)}">

                        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                            <button type="submit" class="btn btn-primary">결함 등록</button>
                        </div>
                    </form>
                </div>
            `;

            document.getElementById('defectForm').addEventListener('submit', (event) => {
                event.preventDefault();
                app.handleFormSubmit(null);
            });
        },

        renderActionForm(app, container, id, itemOverride = null) {
            const item = itemOverride || app.getSelectedDefect(id) || {};
            container.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <h1>결함 조치 결과 입력</h1>
                    <p class="subtitle">#${id} - ${app.sanitize(item.title)}</p>
                </div>

                <form id="actionForm">
                    <div class="form-group">
                        <label>담당자 (조치자) (필수) ${['관리자', '조치자'].includes(app.state.currentRole) ? '<i class="fas fa-edit" style="color:var(--accent); font-size:0.8rem;"></i>' : ''}</label>
                        <select name="assignee" required ${['관리자', '조치자'].includes(app.state.currentRole) ? '' : 'disabled'}>
                            <option value="">선택하세요</option>
                            ${app.state.users.filter((user) => app.isUserActive(user.status) && user.role === '조치자').map((user) => `
                                <option value="${app.sanitize(user.name)}" ${(item.assignee || (app.state.currentUser ? app.state.currentUser.name : '')) === user.name ? 'selected' : ''}>${app.sanitize(user.name)} (${user.department})</option>
                            `).join('')}
                        </select>
                        ${!['관리자', '조치자'].includes(app.state.currentRole) ? `<input type="hidden" name="assignee" value="${app.sanitize(item.assignee || (app.state.currentUser ? app.state.currentUser.name : ''))}">` : ''}
                    </div>

                    <div class="form-group">
                        <label>결함 조치 내용</label>
                        <textarea name="action_comment" rows="6" placeholder="원인 분석 및 조치 내용을 상세히 기록하세요">${app.sanitize(item.action_comment || '')}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>조치 예정일</label>
                            <input type="date" name="action_due_date" value="${app.getKSTDateString(item.action_due_date)}">
                        </div>
                        <div class="form-group">
                            <label>조치 시작일</label>
                            <input type="date" name="action_start" value="${app.getKSTDateString(item.action_start)}">
                        </div>
                        <div class="form-group">
                            <label>조치 완료일</label>
                            <input type="date" name="action_end" value="${app.getKSTDateString(item.action_end)}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>변경할 상태</label>
                            <select name="status">
                                ${app.getCodesByGroup('STATUS').map((code) => `<option value="${code.code_value}" ${item.status === code.code_value ? 'selected' : ''}>${code.code_name} (${code.code_value})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>결함식별 (필수)</label>
                            <select name="defect_identification" ${(['조치자', '관리자'].includes(app.state.currentRole)) ? '' : 'disabled'}>
                                <option value="">선택하세요</option>
                                ${app.getCodesByGroup('IDENTIFICATION').map((code) => `<option value="${code.code_value}" ${item.defect_identification === code.code_value ? 'selected' : ''}>${code.code_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn" style="background: rgba(255,255,255,0.05)" onclick="App.closeModal()">취소</button>
                        <button type="submit" class="btn btn-primary" style="background: var(--info)">조치 결과 저장</button>
                    </div>
                </form>
            `;

            document.getElementById('actionForm').addEventListener('submit', async (event) => {
                event.preventDefault();
                const payload = app.buildDefectPayload(event.target, id);

                const saveResult = await StorageService.defects.save(payload, id);
                if (saveResult.ok) {
                    alert('조치 결과가 저장되었습니다.');
                    if (app.state.isStandalone) {
                        app.closeModal();
                        return;
                    }
                    try {
                        console.log('[App] 3. Fetching Common Codes...'); app.state.commonCodes = await StorageService.commonCodes.fetch(); console.log('[App] 4. Common Codes Loaded:', app.state.commonCodes.length);
                        console.log('[App] Common codes loaded:', app.state.commonCodes.length);
                    } catch (error) {
                        console.error('[App] Failed to load common codes:', error);
                        app.state.commonCodes = [];
                    }

                    console.log('[App] 5. Starting FetchData...'); await app.fetchData(); console.log('[App] 6. Init Finished.');
                    app.closeModal();
                    app.navigate('list');
                    return;
                }

                await app.handleDefectSaveFailure({
                    operation: 'action-update',
                    defectId: id,
                    payload,
                    saveResult,
                    userMessage: '조치 결과 저장에 실패했습니다.'
                });
            });
        }
    };

    global.DefectFlowFormModule = formModule;
})(window);
