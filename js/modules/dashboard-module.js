(function attachDefectFlowDashboardModule(global) {
    const dashboardModule = {
        render(app, container) {
                    const stats = app.state.stats;
                    // All necessary summary data is now in state.allDefectsSummary
                    const defects = app.state.allDefectsSummary.filter(d => app.isTestTypeEnabled(d.test_type));
                    const severityCodes = app.getCodesByGroup('SEVERITY');
                    const statusCodes = app.getCodesByGroup('STATUS');
                    const completedStatuses = ['Resolved', 'Staging', 'Closed'];
            
                    // 1. 등록자별/심각도별 통계 계산
                    const creatorStats = {};
                    const grandTotal = { total: 0 };
                    severityCodes.forEach(c => grandTotal[c.code_value] = 0);
            
                    defects.forEach(d => {
                        const creator = d.creator || '미지정';
                        if (!creatorStats[creator]) {
                            creatorStats[creator] = { total: 0 };
                            severityCodes.forEach(c => creatorStats[creator][c.code_value] = 0);
                        }
                        creatorStats[creator].total++;
                        grandTotal.total++;
                        if (creatorStats[creator][d.severity] !== undefined) {
                            creatorStats[creator][d.severity]++;
                            grandTotal[d.severity]++;
                        }
                    });
                    const sortedCreators = Object.entries(creatorStats).sort((a, b) => b[1].total - a[1].total);
            
                    // 2. 심각도별 조치 현황 계산
                    const severityStatusStats = {};
                    const severityStatusGrandTotal = { total: 0, completed: 0 };
                    statusCodes.forEach(c => severityStatusGrandTotal[c.code_value] = 0);
            
                    defects.forEach(d => {
                        const severity = d.severity || 'Minor';
                        if (!severityStatusStats[severity]) {
                            severityStatusStats[severity] = { total: 0, completed: 0 };
                            statusCodes.forEach(c => severityStatusStats[severity][c.code_value] = 0);
                        }
                        severityStatusStats[severity].total++;
                        severityStatusGrandTotal.total++;
                        if (severityStatusStats[severity][d.status] !== undefined) {
                            severityStatusStats[severity][d.status]++;
                            severityStatusGrandTotal[d.status]++;
                        }
                        if (completedStatuses.includes(d.status)) {
                            severityStatusStats[severity].completed++;
                            severityStatusGrandTotal.completed++;
                        }
                    });
            
                    const severityStatusRows = [
                        ...severityCodes
                            .map(code => ({
                                codeValue: code.code_value,
                                codeName: code.code_name,
                                color: code.color,
                                ...(severityStatusStats[code.code_value] || {})
                            }))
                            .filter(row => row.total > 0),
                        ...Object.entries(severityStatusStats)
                            .filter(([severity]) => !severityCodes.some(code => code.code_value === severity))
                            .map(([severity, counts]) => ({
                                codeValue: severity,
                                codeName: severity,
                                color: null,
                                ...counts
                            }))
                    ].map(row => ({
                        ...row,
                        completionRate: row.total > 0 ? app.pct(row.completed || 0, row.total) : 0
                    }));
            
                    severityStatusGrandTotal.completionRate = severityStatusGrandTotal.total > 0
                        ? app.pct(severityStatusGrandTotal.completed, severityStatusGrandTotal.total)
                        : 0;
            
                    // 3. 결함 조치 현황 계산 (테스트 구분별)
                    const statusStats = {};
                    const statusGrandTotal = { total: 0, completed: 0 };
                    statusCodes.forEach(c => statusGrandTotal[c.code_value] = 0);

                    defects.forEach(d => {
                        const type = d.test_type || '단위테스트';
                        if (!statusStats[type]) {
                            statusStats[type] = { total: 0, completed: 0 };
                            statusCodes.forEach(c => statusStats[type][c.code_value] = 0);
                        }
                        statusStats[type].total++;
                        statusGrandTotal.total++;
                        if (statusStats[type][d.status] !== undefined) {
                            statusStats[type][d.status]++;
                            statusGrandTotal[d.status]++;
                        }
                        if (completedStatuses.includes(d.status)) {
                            statusStats[type].completed++;
                            statusGrandTotal.completed++;
                        }
                    });
                    const sortedStatusTypes = Object.entries(statusStats)
                        .map(([type, stats]) => ({
                            type,
                            ...stats,
                            completionRate: stats.total > 0 ? app.pct(stats.completed || 0, stats.total) : 0
                        }))
                        .sort((a, b) => b.total - a.total);
                    statusGrandTotal.completionRate = statusGrandTotal.total > 0
                        ? app.pct(statusGrandTotal.completed, statusGrandTotal.total)
                        : 0;
            
                    // 4. 결함식별 통계 계산
                    const identificationStats = { total: defects.length, unassigned: 0 };
                    app.getCodesByGroup('IDENTIFICATION').forEach(c => identificationStats[c.code_value] = 0);
            
                    defects.forEach(d => {
                        if (identificationStats[d.defect_identification] !== undefined) {
                            identificationStats[d.defect_identification] += 1;
                        } else {
                            identificationStats.unassigned += 1;
                        }
                    });
            
                    // 비중(%) 계산 헬퍼
            
            
                    container.innerHTML = `
                        <header class="animate-in">
                            <div>
                                <h1>대시보드</h1>
                                <p class="subtitle">실시간 결함 현황 및 통계</p>
                            </div>
                        </header>
                        
                        <div class="stats-grid animate-in">
                            <div class="stat-card">
                                <div class="stat-label">전체 결함</div>
                                <div class="stat-value" style="color: var(--accent)">${stats.total}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">진행 중</div>
                                <div class="stat-value" style="color: var(--info); display: flex; align-items: baseline; gap: 0.5rem;">
                                    <span>${stats.inProgress}</span>
                                    <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${app.pct(stats.inProgress, stats.total)}%)</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">조치 미완료</div>
                                <div class="stat-value" style="color: var(--warning); display: flex; align-items: baseline; gap: 0.5rem;">
                                    ${stats.notCompleted > 0
                    ? `<button type="button" title="조치 미완료 결함 목록 조회" onclick="App.viewNotCompletedDefects()" style="padding: 0; margin: 0; border: none; background: none; color: var(--warning); font: inherit; font-size: inherit; font-weight: inherit; line-height: 1; cursor: pointer;"><span>${stats.notCompleted}</span></button>`
                    : '<span>0</span>'}
                                    <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${app.pct(stats.notCompleted, stats.total)}%)</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">조치 완료</div>
                                <div class="stat-value" style="color: var(--success); display: flex; align-items: baseline; gap: 0.5rem;">
                                    <span>${stats.resolved}</span>
                                    <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${app.pct(stats.resolved, stats.total)}%)</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">크리티컬</div>
                                <div class="stat-value" style="color: var(--error); display: flex; align-items: baseline; gap: 0.5rem;">
                                    <span>${stats.critical}</span>
                                    <span style="font-size: 1rem; font-weight: 500; opacity: 0.75;">(${app.pct(stats.critical, stats.total)}%)</span>
                                </div>
                            </div>
                        </div>
            
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                            <div class="form-container animate-in" style="max-width: 100%;">
                                <h2 style="margin-bottom: 1.5rem;">결함 상태별 비중</h2>
                                <div style="height: 100px;">
                                    <canvas id="statusChart"></canvas>
                                </div>
                            </div>
                            <div class="form-container animate-in" style="max-width: 100%;">
                                <h2 style="margin-bottom: 1.5rem;">심각도별 비중</h2>
                                <div style="height: 100px;">
                                    <canvas id="severityChart"></canvas>
                                </div>
                            </div>
                        </div>
            
                        <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 2rem;">
                            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-chart-bar"></i> 결함 조치 현황 (테스트 구분별)</h2>
                            <div class="data-table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>테스트 구분</th>
                                            <th style="text-align: center;">전체 건수</th>
                                            ${statusCodes.map(c => `
                                                <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name} (${c.code_value})</th>
                                            `).join('')}
                                            <th style="text-align: center;">조치완료율</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sortedStatusTypes.map(row => `
                                            <tr>
                                                <td><strong>${app.getCodeName('TEST_TYPE', row.type)}</strong></td>
                                                <td style="text-align: center;"><strong>${row.total}</strong></td>
                                                ${statusCodes.map(c => `
                                                    <td style="text-align: center;">${row[c.code_value]}${row.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${app.pct(row[c.code_value], row.total)}%)</span>` : ''}</td>
                                                `).join('')}
                                                <td style="text-align: center;">
                                                    <strong class="completion-rate-text signal-${app.getCompletionSignal(row.completionRate).key}">${row.completionRate}%</strong>
                                                </td>
                                            </tr>
                                        `).join('') || `<tr><td colspan="${3 + statusCodes.length}" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>`}
                                    </tbody>
                                    ${sortedStatusTypes.length > 0 ? `
                                    <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                                        <tr>
                                            <td style="padding: 1rem;">합계 (Total)</td>
                                            <td style="text-align: center; padding: 1rem;">${statusGrandTotal.total}</td>
                                            ${statusCodes.map(c => `
                                                <td style="text-align: center; padding: 1rem; color: ${c.color || 'inherit'};">
                                                    ${statusGrandTotal[c.code_value]}${statusGrandTotal.total > 0 ? ` <span style="font-size:0.8rem;opacity:0.8;">(${app.pct(statusGrandTotal[c.code_value], statusGrandTotal.total)}%)</span>` : ''}
                                                </td>
                                            `).join('')}
                                            <td style="text-align: center; padding: 1rem;">
                                                <strong class="completion-rate-text signal-${app.getCompletionSignal(statusGrandTotal.completionRate).key}">${statusGrandTotal.completionRate}%</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                    ` : ''}
                                </table>
                            </div>
                            </div>
                        </div>
            
                        <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 2rem;">
                            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-microscope"></i> 심각도별 조치 현황</h2>
                            <div class="data-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>심각도</th>
                                            <th style="text-align: center;">전체 건수</th>
                                            ${statusCodes.map(c => `
                                                <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name}</th>
                                            `).join('')}
                                            <th style="text-align: center;">조치완료율</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${severityStatusRows.map(row => `
                                            <tr>
                                                <td><strong style="color: ${row.color || 'inherit'};">${app.sanitize(row.codeName)}</strong></td>
                                                <td style="text-align: center;">
                                                    ${row.total > 0
                            ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(37, 99, 235, 0.08); color: ${row.color || 'var(--accent)'}; border: 1px solid rgba(37, 99, 235, 0.2); justify-content:center;" onclick='App.viewSeverityDefects(${JSON.stringify(row.codeValue)})'><strong>${row.total}</strong></button>`
                            : '<strong>0</strong>'}
                                                </td>
                                                ${statusCodes.map(c => `
                                                    <td style="text-align: center;">
                                                        ${(row[c.code_value] || 0) > 0
                                    ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(37, 99, 235, 0.08); color: ${c.color || 'var(--accent)'}; border: 1px solid rgba(37, 99, 235, 0.2); justify-content:center;" onclick='App.viewSeverityDefects(${JSON.stringify(row.codeValue)}, ${JSON.stringify(c.code_value)})'><strong>${row[c.code_value]}</strong></button>${row.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${app.pct(row[c.code_value], row.total)}%)</span>` : ''}`
                                    : '0'}
                                                    </td>
                                                `).join('')}
                                                <td style="text-align: center;">
                                                    <strong class="completion-rate-text signal-${app.getCompletionSignal(row.completionRate).key}">${row.completionRate}%</strong>
                                                </td>
                                            </tr>
                                        `).join('') || `<tr><td colspan="${3 + statusCodes.length}" style="text-align: center; padding: 2rem;">데이터가 없습니다.</td></tr>`}
                                    </tbody>
                                    ${severityStatusRows.length > 0 ? `
                                    <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                                        <tr>
                                            <td style="padding: 1rem;">합계 (Total)</td>
                                            <td style="text-align: center; padding: 1rem;">${severityStatusGrandTotal.total}</td>
                                            ${statusCodes.map(c => `
                                                <td style="text-align: center; padding: 1rem; color: ${c.color || 'inherit'};">
                                                    ${severityStatusGrandTotal[c.code_value]}${severityStatusGrandTotal.total > 0 ? ` <span style="font-size:0.8rem;opacity:0.8;">(${app.pct(severityStatusGrandTotal[c.code_value], severityStatusGrandTotal.total)}%)</span>` : ''}
                                                </td>
                                            `).join('')}
                                            <td style="text-align: center; padding: 1rem;">
                                                <strong class="completion-rate-text signal-${app.getCompletionSignal(severityStatusGrandTotal.completionRate).key}">${severityStatusGrandTotal.completionRate}%</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                    ` : ''}
                                </table>
                            </div>
                        </div>
            
                        <div class="form-container animate-in" style="max-width: 100%; margin-bottom: 2rem;">
                            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-tags"></i> 결함식별 통계</h2>
                            <div class="data-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>구분</th>
                                            <th style="text-align: center;">전체 건수</th>
                                            ${app.getCodesByGroup('IDENTIFICATION').map(c => `
                                                <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name}</th>
                                            `).join('')}
                                            <th style="text-align: center;">미입력</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>전체</strong></td>
                                            <td style="text-align: center;"><strong>${identificationStats.total}</strong></td>
                                            ${app.getCodesByGroup('IDENTIFICATION').map(c => `
                                                <td style="text-align: center;">
                                                    ${identificationStats[c.code_value] > 0
                                            ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(37, 99, 235, 0.08); color: ${c.color || 'var(--accent)'}; border: 1px solid rgba(37, 99, 235, 0.2); justify-content:center;" onclick='App.viewIdentificationDefects(${JSON.stringify(c.code_value)})'><strong>${identificationStats[c.code_value]}</strong></button>${identificationStats.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${app.pct(identificationStats[c.code_value], identificationStats.total)}%)</span>` : ''}`
                                            : '0'}
                                                </td>
                                            `).join('')}
                                            <td style="text-align: center;">
                                                ${identificationStats.unassigned > 0
                            ? `<button type="button" class="btn" style="padding:0.35rem 0.65rem; background: rgba(100, 116, 139, 0.08); color: var(--text-secondary); border: 1px solid rgba(100, 116, 139, 0.2); justify-content:center;" onclick="App.viewIdentificationUnassignedDefects()"><strong>${identificationStats.unassigned}</strong></button>${identificationStats.total > 0 ? ` <span style="color:var(--text-secondary);font-size:0.8rem;">(${app.pct(identificationStats.unassigned, identificationStats.total)}%)</span>` : ''}`
                            : '0'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
            
                        <div class="form-container animate-in" style="max-width: 100%; margin-top: 2rem;">
                            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-users-viewfinder"></i> 등록자별 결함 통계</h2>
                            <div class="data-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>등록자</th>
                                            <th style="text-align: center;">전체 건수</th>
                                            ${app.getCodesByGroup('SEVERITY').map(c => `
                                                <th style="text-align: center; color: ${c.color || 'inherit'};">${c.code_name}</th>
                                            `).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sortedCreators.map(([name, s]) => `
                                            <tr>
                                                <td><strong>${app.sanitize(name)}</strong></td>
                                                <td style="text-align: center;"><strong>${s.total}</strong></td>
                                                <td style="text-align: center;">${s.Critical}</td>
                                                <td style="text-align: center;">${s.Major}</td>
                                                <td style="text-align: center;">${s.Minor}</td>
                                                <td style="text-align: center;">${s.Simple}</td>
                                            </tr>
                                        `).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem;">집계된 데이터가 없습니다.</td></tr>'}
                                    </tbody>
                                    ${sortedCreators.length > 0 ? `
                                    <tfoot style="background: rgba(255,255,255,0.05); font-weight: 700; border-top: 2px solid var(--border);">
                                        <tr>
                                            <td style="padding: 1rem;">합계 (Total)</td>
                                            <td style="text-align: center; padding: 1rem;">${grandTotal.total}</td>
                                            <td style="text-align: center; padding: 1rem; color: var(--error);">${grandTotal.Critical}</td>
                                            <td style="text-align: center; padding: 1rem; color: var(--warning);">${grandTotal.Major}</td>
                                            <td style="text-align: center; padding: 1rem; color: var(--accent);">${grandTotal.Minor}</td>
                                            <td style="text-align: center; padding: 1rem; color: var(--success);">${grandTotal.Simple}</td>
                                        </tr>
                                    </tfoot>
                                    ` : ''}
                                </table>
                            </div>
                        </div>
            `;
            
                    // Chart.js Initialization (Weighted Stacked Bar)
                    const statusCounts = {
                        'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Staging': 0, 'Closed': 0, 'Reopened': 0
                    };
                    const statusMap = {
                        'Open': '접수', 'In Progress': '조치 중', 'Resolved': '조치 완료', 'Staging': '스테이징 배포', 'Closed': '종료', 'Reopened': '재오픈'
                    };
                    let totalDefectsCount = 0;
                    defects.forEach(d => {
                        if (statusCounts[d.status] !== undefined) {
                            statusCounts[d.status]++;
                            totalDefectsCount++;
                        }
                    });
            
                    const ctx = document.getElementById('statusChart');
                    if (ctx) {
                        new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: ['전체'],
                                datasets: Object.keys(statusCounts).map((status, index) => {
                                    const count = statusCounts[status];
                                    const percentage = totalDefectsCount > 0 ? (count / totalDefectsCount * 100).toFixed(1) : 0;
                                    const colors = [
                                        '#fbbf24', '#f59e0b', '#10b981', '#6b7280', '#ef4444'
                                    ];
            
                                    return {
                                        label: statusMap[status] || status,
                                        data: [percentage], // Weight as percentage
                                        backgroundColor: colors[index] + 'a0',
                                        borderColor: colors[index],
                                        borderWidth: 1,
                                        count: count // Store raw count for tooltip
                                    };
                                })
                            },
                            options: {
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: {
                                            color: '#334155',
                                            font: { size: 11 }
                                        }
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function (context) {
                                                const raw = context.raw; // percentage
                                                const count = context.dataset.count;
                                                return `${context.dataset.label}: ${raw}% (${count}건)`;
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    x: {
                                        stacked: true,
                                        display: false, // Hide X axis
                                        max: 100
                                    },
                                    y: {
                                        stacked: true,
                                        display: false // Hide Y axis
                                    }
                                }
                            }
                        });
                    }
            
                    // Severity Chart
                    const severityCounts = { 'Critical': 0, 'Major': 0, 'Minor': 0, 'Simple': 0 };
                    defects.forEach(d => {
                        if (severityCounts[d.severity] !== undefined) severityCounts[d.severity]++;
                        else severityCounts['Minor']++; // Default fallback
                    });
            
                    const ctxSeverity = document.getElementById('severityChart');
                    if (ctxSeverity) {
                        new Chart(ctxSeverity, {
                            type: 'bar',
                            data: {
                                labels: ['전체'],
                                datasets: Object.keys(severityCounts).map((sev, index) => {
                                    const count = severityCounts[sev];
                                    const percentage = totalDefectsCount > 0 ? (count / totalDefectsCount * 100).toFixed(1) : 0;
                                    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
            
                                    return {
                                        label: sev,
                                        data: [percentage],
                                        backgroundColor: colors[index] + 'a0',
                                        borderColor: colors[index],
                                        borderWidth: 1,
                                        count: count
                                    };
                                })
                            },
                            options: {
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'bottom', labels: { color: '#334155', font: { size: 11 } } },
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => `${context.dataset.label}: ${context.raw}% (${context.dataset.count}건)`
                                        }
                                    }
                                },
                                scales: {
                                    x: { stacked: true, display: false, max: 100 },
                                    y: { stacked: true, display: false }
                                }
                            }
                        });
                    }
        }
    };

    global.DefectFlowDashboardModule = dashboardModule;
})(window);
