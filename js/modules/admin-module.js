(function attachDefectFlowAdminModule(global) {
    const AdminSettingsModule = global.DefectFlowAdminSettingsModule;
    const adminModule = {
        renderUsers(app, container) {
            const config = app.state.userListConfig || { page: 1, pageSize: 15, pageGroupSize: 10 };
            const totalUsers = (app.state.users || []).length;
            const totalPages = Math.max(1, Math.ceil(totalUsers / config.pageSize));
            const pagination = app.buildPaginationRange(config.page, totalPages, config.pageGroupSize || 10);
            const startIndex = (pagination.currentPage - 1) * config.pageSize;
            const pagedUsers = (app.state.users || []).slice(startIndex, startIndex + config.pageSize);

            if (config.page !== pagination.currentPage) {
                app.state.userListConfig.page = pagination.currentPage;
            }

            container.innerHTML = `
                <header class="animate-in">
                    <div>
                        <h1>담당자 관리</h1>
                        <p class="subtitle">결함 등록 및 조치 담당자를 관리합니다.</p>
                    </div>
                    <button class="btn btn-primary" onclick="App.renderUserForm()"><i class="fas fa-user-plus"></i> 새 담당자 등록</button>
                </header>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; color: var(--text-secondary); font-size: 0.875rem; gap: 1rem; flex-wrap: wrap;">
                    <div>총 <strong>${totalUsers}</strong>명 (${pagination.currentPage} / ${totalPages} 페이지)</div>
                    <div>페이지당 <strong>${config.pageSize}</strong>명</div>
                </div>

                <div class="data-table-container animate-in">
                    <table>
                        <thead>
                            <tr>
                                <th>관리번호</th>
                                <th>역할</th>
                                <th>소속</th>
                                <th>이름</th>
                                <th>이메일</th>
                                <th>상태</th>
                                <th>등록일</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagedUsers.map((user) => `
                                <tr>
                                    <td>#${user.user_id}</td>
                                    <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-main); font-size: 0.75rem;">${user.role}</span></td>
                                    <td>${app.sanitize(user.department)}</td>
                                    <td><strong>${app.sanitize(user.name)}</strong></td>
                                    <td>${app.sanitize(user.email)}</td>
                                    <td><span class="badge" style="background: ${app.isUserActive(user.status) ? '#dcfce7' : '#fee2e2'}; color: ${app.isUserActive(user.status) ? '#166534' : '#991b1b'};">${user.status}</span></td>
                                    <td>${app.formatDateKST(user.created_at)}</td>
                                    <td>
                                        <div style="display:flex; gap:0.5rem;">
                                            <button class="btn" style="padding: 0.4rem; color: var(--accent)" onclick="App.renderUserForm(${user.user_id})"><i class="fas fa-edit"></i></button>
                                            <button class="btn" style="padding: 0.4rem; color: var(--error)" onclick="App.deleteUser(${user.user_id})"><i class="fas fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="8" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                ${totalPages > 1 ? `
                <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn" ${pagination.hasPreviousPage ? '' : 'disabled'} onclick="App.changeUserPage(${pagination.currentPage - 1})" style="padding: 0.4rem 0.8rem;">이전</button>
                    ${pagination.hasPreviousGroup ? `
                        <button class="btn" onclick="App.changeUserPage(${pagination.previousGroupPage})" style="padding: 0.4rem 0.8rem; background: var(--bg-secondary); border: 1px solid var(--border);">이전 10</button>
                    ` : ''}
                    ${pagination.pages.map((page) => `
                        <button class="btn" style="padding: 0.4rem 0.8rem; background: ${page === pagination.currentPage ? 'var(--accent)' : 'var(--bg-main)'}; color: ${page === pagination.currentPage ? 'white' : 'var(--text-primary)'}; border: 1px solid var(--border);" onclick="App.changeUserPage(${page})">${page}</button>
                    `).join('')}
                    ${pagination.hasNextGroup ? `
                        <button class="btn" onclick="App.changeUserPage(${pagination.nextGroupPage})" style="padding: 0.4rem 0.8rem; background: var(--bg-secondary); border: 1px solid var(--border);">다음 10</button>
                    ` : ''}
                    <button class="btn" ${pagination.hasNextPage ? '' : 'disabled'} onclick="App.changeUserPage(${pagination.currentPage + 1})" style="padding: 0.4rem 0.8rem;">다음</button>
                </div>
                ` : ''}
            `;
        },

        renderUserForm(app, id = null) {
            const user = id ? app.state.users.find((item) => item.user_id === id) : {};
            const title = id ? '담당자 정보 수정' : '신규 담당자 등록';

            const modalBody = document.getElementById('modalBody');
            modalBody.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <h1>${title}</h1>
                    <p class="subtitle">담당자 정보를 정확히 입력해 주세요.</p>
                </div>
                <form id="userForm">
                    <div class="form-group">
                        <label>역할</label>
                        <select name="role">
                            <option value="테스트" ${user.role === '테스트' ? 'selected' : ''}>테스트 (QA)</option>
                            <option value="테스터" ${user.role === '테스터' ? 'selected' : ''}>테스터</option>
                            <option value="조치자" ${user.role === '조치자' ? 'selected' : ''}>조치자 (Developer)</option>
                            <option value="관리자" ${user.role === '관리자' ? 'selected' : ''}>관리자 (Admin)</option>
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label>이름 (필수)</label>
                            <input type="text" name="name" value="${app.sanitize(user.name || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>소속</label>
                            <input type="text" name="department" value="${app.sanitize(user.department || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>이메일</label>
                        <input type="email" name="email" value="${app.sanitize(user.email || '')}" placeholder="example@company.com">
                    </div>
                    <div class="form-group">
                        <label>상태</label>
                        <select name="status">
                            ${app.getUserStatusOptions(user.status || '사용').map((option) => `<option value="${option.code_value}" ${user.status === option.code_value ? 'selected' : ''}>${option.code_name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">${id ? '저장하기' : '등록하기'}</button>
                        <button type="button" class="btn" style="flex: 1; background: var(--bg-secondary);" onclick="App.closeModal()">취소</button>
                    </div>
                </form>
            `;

            app.openModal();
            document.getElementById('userForm').onsubmit = (event) => {
                event.preventDefault();
                app.handleUserSubmit(id, new FormData(event.target));
            };
        },

        renderSettings(app, container) {
            return AdminSettingsModule.renderSettings(app, container);
        },

        renderCommonCodeForm(app, groupCode = '', codeValue = '') {
            return AdminSettingsModule.renderCommonCodeForm(app, groupCode, codeValue);
        },

        showDefectSaveErrorLogDetail(app, index) {
            return AdminSettingsModule.showDefectSaveErrorLogDetail(app, index);
        },

        renderDefectSaveErrorLogPanel(app) {
            return AdminSettingsModule.renderDefectSaveErrorLogPanel(app);
        },

        renderDefectActionRecheckPanel(app) {
            return AdminSettingsModule.renderDefectActionRecheckPanel(app);
        }
    };

    global.DefectFlowAdminModule = adminModule;
})(window);
