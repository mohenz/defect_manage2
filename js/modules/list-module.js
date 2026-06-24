(function attachDefectFlowListModule(global) {
    const listModule = {
        render(app, container) {
            const config = app.state.listConfig;
            const search = config.search || {};

            const pagedData = app.state.defects;
            const totalItems = app.state.totalDefectCount;
            const totalPages = Math.max(1, Math.ceil(totalItems / config.pageSize));
            const pagination = app.buildPaginationRange(config.page, totalPages, 10);

            container.innerHTML = `
                <header class="animate-in">
                    <div>
                        <h1>결함 관리 목록</h1>
                        <p class="subtitle">시스템 내 모든 결함 데이터를 상세하게 조회합니다.</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="background: #166534; color: white;" onclick="App.downloadExcel()"><i class="fas fa-file-excel"></i> 엑셀 다운로드</button>
                        <button class="btn btn-primary" onclick="App.navigate('register')"><i class="fas fa-plus"></i> 새 결함 등록</button>
                    </div>
                </header>

                <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 1.5rem; padding: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; align-items: end;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">결함 ID</label>
                            <input type="text" id="searchDefectId" value="${app.sanitize(search.defectId || '')}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="예: 1024">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">테스트 구분</label>
                            <select id="searchTestType">
                                <option value="">전체</option>
                                ${app.getVisibleTestTypeCodes(search.testType).map((code) => `
                                    <option value="${code.code_value}" ${search.testType === code.code_value ? 'selected' : ''}>${code.code_name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">심각도</label>
                            <select id="searchSeverity">
                                <option value="">전체</option>
                                ${app.getCodesByGroup('SEVERITY').map((code) => `
                                    <option value="${code.code_value}" ${search.severity === code.code_value ? 'selected' : ''}>${code.code_name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">상태</label>
                            <select id="searchStatus">
                                <option value="">전체</option>
                                <option value="__NOT_COMPLETED__" ${search.statusPreset === '__NOT_COMPLETED__' ? 'selected' : ''}>조치 미완료</option>
                                ${app.getCodesByGroup('STATUS').map((code) => `
                                    <option value="${code.code_value}" ${search.status === code.code_value ? 'selected' : ''}>${code.code_name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">결함식별</label>
                            <select id="searchIdentification">
                                <option value="">전체</option>
                                <option value="__UNASSIGNED__" ${search.identificationUnassigned ? 'selected' : ''}>미입력</option>
                                ${app.getCodesByGroup('IDENTIFICATION').map((code) => `
                                    <option value="${code.code_value}" ${search.identification === code.code_value ? 'selected' : ''}>${code.code_name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">발생 화면</label>
                            <select id="searchScreenPath">
                                <option value="">전체</option>
                                ${app.getScreenPathOptions(search.screenPath).map((code) => `
                                    <option value="${app.sanitize(code.code_value)}" ${search.screenPath === code.code_value ? 'selected' : ''}>${app.sanitize(code.code_name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">결함 제목</label>
                            <input type="text" id="searchTitle" value="${search.title || ''}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="제목 키워드 검색 (Enter)">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">재현단계</label>
                            <input type="text" id="searchStepsToRepro" value="${search.stepsToRepro || ''}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="재현단계 키워드 검색 (Enter)">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">등록자</label>
                            <input type="text" id="searchCreator" value="${search.creator || ''}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="이름 검색 (Enter)">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">담당자</label>
                            <input type="text" id="searchAssignee" value="${search.assignee || ''}" onkeydown="if(event.key==='Enter') App.handleSearch()" placeholder="이름 검색 (Enter)">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">등록기간 (시작)</label>
                            <input type="date" id="searchDateStart" value="${search.dateStart || ''}">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem;">등록기간 (종료)</label>
                            <input type="date" id="searchDateEnd" value="${search.dateEnd || ''}">
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: flex-end; grid-column: span 2;">
                            <button class="btn btn-primary" onclick="App.handleSearch()" style="flex: 1; justify-content: center; height: 42px; font-size: 0.875rem; white-space: nowrap;"><i class="fas fa-search"></i> 조회</button>
                            <button class="btn" onclick="App.resetFilters()" style="flex: 1; height: 42px; font-size: 0.875rem; white-space: nowrap; background: var(--bg-secondary); border: 1px solid var(--border); justify-content: center;"><i class="fas fa-rotate-left"></i> 초기화</button>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        총 <strong>${totalItems}</strong>건 (${pagination.currentPage} / ${totalPages} 페이지)
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <label style="margin:0; font-size: 0.8125rem;">출력 개수:</label>
                        <select id="pageSizeSelect" onchange="App.handlePageSizeChange()" style="width: 80px; padding: 0.3rem;">
                            <option value="20" ${config.pageSize == 20 ? 'selected' : ''}>20</option>
                            <option value="50" ${config.pageSize == 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${config.pageSize == 100 ? 'selected' : ''}>100</option>
                            ${app.state.currentRole === '관리자' ? `<option value="${totalItems}" ${config.pageSize >= totalItems && totalItems > 100 ? 'selected' : ''}>All</option>` : ''}
                        </select>
                    </div>
                </div>

                <div class="data-table-container animate-in">
                    <table style="min-width: 1400px;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>구분</th>
                                <th>결함명</th>
                                <th>식별</th>
                                <th>심각도</th>
                                <th>우선순위</th>
                                <th>상태</th>
                                <th>메뉴/화면명</th>
                                <th>등록자</th>
                                <th>담당자</th>
                                <th>등록일</th>
                                <th>조치예정일</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagedData.map((defect) => `
                                <tr>
                                    <td>#${defect.defect_id}</td>
                                    <td>${app.getCodeName('TEST_TYPE', defect.test_type)}</td>
                                    <td style="max-width:250px; white-space:normal;">
                                        <strong class="clickable-link" onclick="App.editDefect(${defect.defect_id})">[${app.getCodeName('TEST_TYPE', defect.test_type).substring(0, 2)}] ${app.sanitize(defect.title)}</strong>
                                    </td>
                                    <td><span class="badge" style="background-color: ${app.getCodeColor('IDENTIFICATION', defect.defect_identification) || 'var(--bg-secondary)'}; color: white;">${app.getCodeName('IDENTIFICATION', defect.defect_identification)}</span></td>
                                    <td><span class="badge" style="background-color: ${app.getCodeColor('SEVERITY', defect.severity) || '#64748b'}; color: white;">${app.getCodeName('SEVERITY', defect.severity)}</span></td>
                                    <td>${app.getCodeName('PRIORITY', defect.priority)}</td>
                                    <td><span class="badge" style="background-color: ${app.getCodeColor('STATUS', defect.status) || '#64748b'}; color: white;">${app.getCodeName('STATUS', defect.status)}</span></td>
                                    <td>${app.sanitize(defect.menu_name || '-')}/${app.sanitize(defect.screen_name || '-')}</td>
                                    <td>${app.sanitize(defect.creator || '-')}</td>
                                    <td>${app.sanitize(defect.assignee || '-')}</td>
                                    <td>${app.formatDateKST(defect.created_at)}</td>
                                    <td>${defect.action_due_date ? app.formatDateKST(defect.action_due_date, false) : '-'}</td>
                                    <td>
                                        <div style="display:flex; gap:0.5rem;">
                                            ${['조치자', '관리자'].includes(app.state.currentRole) ? `
                                                <button class="btn" style="padding: 0.4rem; color: var(--info)" title="조치 결과 입력" onclick="App.actionDefect(${defect.defect_id})"><i class="fas fa-tools"></i> 조치</button>
                                            ` : ''}
                                            <button class="btn" style="padding: 0.4rem; color: var(--accent)" onclick="App.editDefect(${defect.defect_id})"><i class="fas fa-edit"></i></button>
                                            ${app.state.currentRole === '관리자' ? `
                                                <button class="btn" style="padding: 0.4rem; color: var(--error)" onclick="App.deleteDefect(${defect.defect_id})"><i class="fas fa-trash"></i></button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="13" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                ${totalPages > 1 ? `
                <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.5rem;">
                    <button class="btn" ${pagination.hasPreviousPage ? '' : 'disabled'} onclick="App.changePage(${pagination.currentPage - 1})" style="padding: 0.4rem 0.8rem;">이전</button>
                    ${pagination.hasPreviousGroup ? `
                        <button class="btn" onclick="App.changePage(${pagination.previousGroupPage})" style="padding: 0.4rem 0.8rem; background: var(--bg-secondary); border: 1px solid var(--border);">이전 10</button>
                    ` : ''}
                    ${pagination.pages.map((page) => `
                        <button class="btn" style="padding: 0.4rem 0.8rem; background: ${page === pagination.currentPage ? 'var(--accent)' : 'var(--bg-main)'}; color: ${page === pagination.currentPage ? 'white' : 'var(--text-primary)'}; border: 1px solid var(--border);" onclick="App.changePage(${page})">${page}</button>
                    `).join('')}
                    ${pagination.hasNextGroup ? `
                        <button class="btn" onclick="App.changePage(${pagination.nextGroupPage})" style="padding: 0.4rem 0.8rem; background: var(--bg-secondary); border: 1px solid var(--border);">다음 10</button>
                    ` : ''}
                    <button class="btn" ${pagination.hasNextPage ? '' : 'disabled'} onclick="App.changePage(${pagination.currentPage + 1})" style="padding: 0.4rem 0.8rem;">다음</button>
                </div>
                ` : ''}
            `;
        }
    };

    global.DefectFlowListModule = listModule;
})(window);
