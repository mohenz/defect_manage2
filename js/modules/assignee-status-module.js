(function attachDefectFlowAssigneeStatusModule(global) {
    const assigneeStatusModule = {
        render(app, container) {
            if (!app.state.defectActionRecheckLoaded && !app.state.defectActionRecheckLoading) {
                app.loadDefectActionRecheckItems({ silent: true });
            }

            container.innerHTML = `
                <header class="animate-in">
                    <div>
                        <h1>결함 조치 현황</h1>
                        <p class="subtitle">조치자별 결함 배정 현황과 상태별 처리 건수를 확인합니다.</p>
                    </div>
                </header>

                <div class="form-container animate-in" style="max-width: 100%;">
                    ${assigneeStatusModule.renderPanel(app)}
                </div>

                <div class="form-container animate-in" style="max-width: 100%; margin-top: 1.5rem;">
                    ${app.renderDefectActionRecheckPanel()}
                </div>
            `;
        },

        renderPanel(app) {
                    const defects = (app.state.allDefectsSummary || []).filter(d => app.isTestTypeEnabled(d.test_type));
                    const assignees = (app.state.users || [])
                        .filter(user => user.role === '조치자' && app.isUserActive(user.status))
                        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                    const statusCodes = app.getCodesByGroup('STATUS');
                    const completedStatuses = ['Resolved', 'Staging', 'Closed'];
                    const buildStatusRow = (label, department, userStatus, assignedDefects, isUnassigned = false) => {
                        const counts = {};
                        statusCodes.forEach(code => {
                            counts[code.code_value] = assignedDefects.filter(defect => defect.status === code.code_value).length;
                        });
                        const completed = assignedDefects.filter(defect => completedStatuses.includes(defect.status)).length;
            
                        return {
                            user: {
                                name: label,
                                department,
                                status: userStatus
                            },
                            total: assignedDefects.length,
                            counts,
                            completed,
                            completionRate: assignedDefects.length > 0 ? app.pct(completed, assignedDefects.length) : 0,
                            isUnassigned
                        };
                    };
                    const rows = assignees.map(user => {
                        const assignedDefects = defects.filter(defect => defect.assignee === user.name);
                        return buildStatusRow(user.name, user.department || '-', user.status || '-', assignedDefects);
                    });
                    const unassignedDefects = defects.filter(defect => !defect.assignee);
                    if (unassignedDefects.length > 0) {
                        rows.push(buildStatusRow('미배정', '-', '미배정', unassignedDefects, true));
                    }
                    const totals = {
                        total: rows.reduce((sum, row) => sum + row.total, 0),
                        counts: {}
                    };
                    statusCodes.forEach(code => {
                        totals.counts[code.code_value] = rows.reduce((sum, row) => sum + (row.counts[code.code_value] || 0), 0);
                    });
                    totals.completed = rows.reduce((sum, row) => sum + row.completed, 0);
                    totals.completionRate = totals.total > 0 ? app.pct(totals.completed, totals.total) : 0;
            
                    const totalAssignedDefects = totals.total;
                    const activeAssigneeCount = rows.filter(row => row.total > 0).length;
                    const unassignedCount = defects.filter(defect => !defect.assignee).length;
                    const completedDefects = defects.filter(defect =>
                        completedStatuses.includes(defect.status)
                    ).length;
                    const completionRate = defects.length > 0
                        ? Math.round((completedDefects / defects.length) * 100)
                        : 0;
                    const overallSignal = app.getCompletionSignal(completionRate);
            
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                            <div>
                                <h2 style="margin-bottom: 0.5rem;"><i class="fas fa-user-check"></i> 결함 조치 현황</h2>
                                <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                    조치자별 결함 배정 현황과 상태별 처리 건수를 확인합니다.
                                </p>
                            </div>
                        </div>
            
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                            <div class="stat-card">
                                <div class="stat-value">${assignees.length}</div>
                                <div class="stat-label">등록된 조치자</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${activeAssigneeCount}</div>
                                <div class="stat-label">배정된 조치자</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${totalAssignedDefects}</div>
                                <div class="stat-label">집계 대상 결함 수</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${unassignedCount}</div>
                                <div class="stat-label">미배정 결함 수</div>
                            </div>
                            <div class="stat-card completion-signal-card signal-${overallSignal.key}">
                                <div class="stat-value" style="display: flex; align-items: baseline; gap: 0.5rem;">
                                    <span class="completion-rate-text signal-${overallSignal.key}">${completionRate}%</span>
                                    <span style="font-size: 1rem; font-weight: 600; color: var(--text-secondary);">${completedDefects}/${defects.length}</span>
                                </div>
                                <div class="stat-label">조치완료율</div>
                            </div>
                        </div>
            
                        <div class="data-table-container">
                            <table style="min-width: 1200px;">
                                <thead>
                                    <tr>
                                        <th>조치자</th>
                                        <th style="text-align:center;">총 건수</th>
                                        ${statusCodes.map(code => `
                                            <th style="text-align:center; color:${code.color || 'inherit'};">${code.code_name}</th>
                                        `).join('')}
                                        <th style="text-align:center;">조치완료율</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows.map(row => `
                                        <tr>
                                            <td><strong>${app.sanitize(row.user.name)}</strong></td>
                                            <td style="text-align:center;">
                                                ${row.isUnassigned
                            ? row.total > 0
                                ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(217, 119, 6, 0.08); color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); justify-content:center;" onclick="App.viewUnassignedDefects()"><strong>${row.total}</strong></button>`
                                : '<strong>0</strong>'
                            : row.total > 0
                                ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(37, 99, 235, 0.08); color: var(--accent); border: 1px solid rgba(37, 99, 235, 0.2); justify-content:center;" onclick="App.viewAssigneeDefects('${app.sanitize(row.user.name)}')"><strong>${row.total}</strong></button>`
                                : '<strong>0</strong>'}
                                            </td>
                                            ${statusCodes.map(code => `
                                                <td style="text-align:center;">
                                                    ${row.isUnassigned && (row.counts[code.code_value] || 0) > 0
                                        ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(217, 119, 6, 0.08); color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); justify-content:center;" onclick="App.viewUnassignedDefects('${code.code_value}')"><strong>${row.counts[code.code_value]}</strong></button>`
                                        : !row.isUnassigned && code.code_value === 'Resolved' && (row.counts[code.code_value] || 0) > 0
                                            ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(5, 150, 105, 0.08); color: var(--success); border: 1px solid rgba(5, 150, 105, 0.2); justify-content:center;" onclick="App.viewAssigneeDefectsByStatus('${app.sanitize(row.user.name)}', 'Resolved')"><strong>${row.counts[code.code_value]}</strong></button>`
                                            : (row.counts[code.code_value] || 0)}
                                                </td>
                                            `).join('')}
                                            <td style="text-align:center;">
                                                <strong class="completion-rate-text signal-${app.getCompletionSignal(row.completionRate).key}">${row.completionRate}%</strong>
                                                <div style="font-size:0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${row.completed}/${row.total}</div>
                                            </td>
                                        </tr>
                                    `).join('') || `<tr><td colspan="${3 + statusCodes.length}" style="text-align:center; padding:2rem;">등록된 조치자가 없습니다.</td></tr>`}
                                </tbody>
                                ${rows.length > 0 ? `
                                    <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                                        <tr>
                                            <td colspan="1" style="padding: 1rem;">합계</td>
                                            <td style="text-align:center; padding: 1rem;">${totals.total}</td>
                                            ${statusCodes.map(code => `
                                                <td style="text-align:center; padding: 1rem; color:${code.color || 'inherit'};">${totals.counts[code.code_value] || 0}</td>
                                            `).join('')}
                                            <td style="text-align:center; padding: 1rem;">
                                                <strong class="completion-rate-text signal-${app.getCompletionSignal(totals.completionRate).key}">${totals.completionRate}%</strong>
                                                <div style="font-size:0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${totals.completed}/${totals.total}</div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                ` : ''}
                            </table>
                        </div>
                    `;
        }
    };

    global.DefectFlowAssigneeStatusModule = assigneeStatusModule;
})(window);
