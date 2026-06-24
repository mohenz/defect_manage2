/**
 * DefectFlow Core Application Logic
 */

const AppUtils = window.DefectFlowAppUtils;
const ImageService = window.DefectFlowImageService;
const BridgeService = window.DefectFlowBridgeService;
const AuthModule = window.DefectFlowAuthModule;
const ListModule = window.DefectFlowListModule;
const AdminModule = window.DefectFlowAdminModule;
const FormModule = window.DefectFlowFormModule;
const DashboardModule = window.DefectFlowDashboardModule;
const AssigneeStatusModule = window.DefectFlowAssigneeStatusModule;
const DEFECT_SAVE_ERROR_LOG_KEY = 'defect_save_error_logs';
const DEFECT_SAVE_ERROR_LOG_LIMIT = 50;
const DEFECT_COMPLETED_STATUSES = ['Resolved', 'Staging', 'Closed'];
const DEFECT_NOT_COMPLETED_STATUSES = ['Open', 'In Progress', 'Reopened'];
const LIST_STATUS_PRESET_NOT_COMPLETED = '__NOT_COMPLETED__';
const createDefaultListSearch = (overrides = {}) => ({
    defectId: '',
    severity: '',
    status: '',
    statusPreset: '',
    title: '',
    stepsToRepro: '',
    creator: '',
    assignee: '',
    assigneeUnassigned: false,
    identificationUnassigned: false,
    testType: '',
    dateStart: '',
    dateEnd: '',
    identification: '',
    screenPath: '',
    ...overrides
});

window.App = {
    // --- Utils ---
    pct(val, total) {
        return AppUtils.pct(val, total);
    },

    getCompletionSignal(rate) {
        return AppUtils.getCompletionSignal(rate);
    },

    createLocalLogId(prefix = 'ERR') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    },

    getDefectSaveErrorLogs() {
        try {
            const raw = localStorage.getItem(DEFECT_SAVE_ERROR_LOG_KEY);
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('[App] Failed to read defect save error logs:', error);
            return [];
        }
    },

    setDefectSaveErrorLogs(logs) {
        try {
            const normalizedLogs = Array.isArray(logs) ? logs.slice(0, DEFECT_SAVE_ERROR_LOG_LIMIT) : [];
            localStorage.setItem(DEFECT_SAVE_ERROR_LOG_KEY, JSON.stringify(normalizedLogs));
        } catch (error) {
            console.error('[App] Failed to persist defect save error logs:', error);
        }
    },

    buildDefectPayloadSummary(payload = {}) {
        const screenshot = typeof payload.screenshot === 'string' ? payload.screenshot : '';
        const screenUrl = typeof payload.screen_url === 'string' ? payload.screen_url : '';
        let screenUrlOrigin = '';
        let screenUrlPathname = '';
        let screenUrlQueryLength = 0;

        try {
            if (screenUrl) {
                const parsedUrl = new URL(screenUrl, window.location.href);
                screenUrlOrigin = parsedUrl.origin || '';
                screenUrlPathname = parsedUrl.pathname || '';
                screenUrlQueryLength = (parsedUrl.search || '').length;
            }
        } catch (error) {
            screenUrlPathname = screenUrl.slice(0, 120);
        }

        return {
            test_type: payload.test_type || '',
            title: payload.title || '',
            title_length: String(payload.title || '').length,
            severity: payload.severity || '',
            priority: payload.priority || '',
            status: payload.status || '',
            menu_name: payload.menu_name || '',
            screen_name: payload.screen_name || '',
            screen_url: screenUrl,
            screen_url_length: screenUrl.length,
            screen_url_origin: screenUrlOrigin,
            screen_url_pathname: screenUrlPathname,
            screen_url_query_length: screenUrlQueryLength,
            creator: payload.creator || '',
            assignee: payload.assignee || '',
            steps_length: String(payload.steps_to_repro || '').length,
            env_info_length: String(payload.env_info || '').length,
            has_screenshot: !!screenshot,
            screenshot_length: screenshot.length,
            screenshot_kind: screenshot
                ? (screenshot.startsWith('data:image') ? 'inline-data-url' : 'url-or-path')
                : 'none'
        };
    },

    recordDefectSaveError(context = {}) {
        const storageError = context.error || StorageService.getLastDefectSaveError?.() || null;
        const payloadSummary = this.buildDefectPayloadSummary(context.payload || {});
        const creatorName = payloadSummary.creator || this.state.currentUser?.name || '';
        const reporterName = this.state.currentUser?.name || '';
        const entry = {
            log_id: this.createLocalLogId('DEFECT'),
            created_at: new Date().toISOString(),
            operation: context.operation || 'create',
            defect_id: context.defectId || null,
            stage: storageError?.stage || context.stage || 'submit',
            error_type: storageError?.type || 'unknown',
            message: storageError?.message || context.message || '알 수 없는 저장 오류',
            pending_source: this.state.pendingDefectSource || 'manual',
            runtime: {
                href: window.location.href,
                current_view: this.state.currentView,
                current_modal: this.state.currentModal,
                is_standalone: this.state.isStandalone,
                is_mobile_quick_mode: this.state.isMobileQuickMode,
                is_logged_in: this.state.isLoggedIn,
                current_role: this.state.currentRole || '',
                current_user: this.state.currentUser?.name || '',
                user_agent: navigator.userAgent
            },
            payload_summary: payloadSummary,
            storage_error: storageError,
            creator_name: creatorName,
            reporter_name: reporterName,
            extra: {
                ...(context.extra || {}),
                creator_name: creatorName,
                reporter_name: reporterName
            }
        };

        const logs = [entry, ...this.getDefectSaveErrorLogs()].slice(0, DEFECT_SAVE_ERROR_LOG_LIMIT);
        this.setDefectSaveErrorLogs(logs);
        return entry;
    },

    async persistCentralDefectSaveErrorLog(entry) {
        const centralResult = await StorageService.logs.saveDefectSaveError(entry);
        const updatedEntry = {
            ...entry,
            central_saved: centralResult.ok
        };

        if (centralResult.ok) {
            updatedEntry.central_log_id = centralResult.data?.central_log_id || null;
            updatedEntry.central_created_at = centralResult.data?.created_at || entry.created_at;
        } else {
            updatedEntry.central_save_error = centralResult.error || null;
        }

        const nextLogs = [
            updatedEntry,
            ...this.getDefectSaveErrorLogs().filter(log => log.log_id !== entry.log_id)
        ].slice(0, DEFECT_SAVE_ERROR_LOG_LIMIT);
        this.setDefectSaveErrorLogs(nextLogs);

        if (this.state.currentView === 'settings' && this.state.settingsTab === 'error-logs') {
            this.loadDefectSaveErrorLogs({ silent: true });
        }

        return updatedEntry;
    },

    async handleDefectSaveFailure({ operation = 'create', defectId = null, payload = {}, saveResult = null, userMessage = '저장에 실패했습니다.' } = {}) {
        const localLogEntry = this.recordDefectSaveError({
            operation,
            defectId,
            payload,
            error: saveResult?.error || null
        });
        const logEntry = await this.persistCentralDefectSaveErrorLog(localLogEntry);
        const reason = saveResult?.error?.message ? `\n원인: ${saveResult.error.message}` : '';
        const centralNote = logEntry.central_saved
            ? '\n중앙 오류 로그에도 저장되었습니다.'
            : '\n중앙 오류 로그 저장에는 실패하여 이 브라우저의 로컬 백업에만 남았습니다.';
        alert(`${userMessage}${reason}\n오류 로그 ID: ${logEntry.log_id}${centralNote}`);
        return logEntry;
    },

    clearDefectSaveErrorLogs() {
        if (!confirm('이 브라우저의 로컬 백업 오류 로그를 모두 삭제하시겠습니까?')) {
            return;
        }

        localStorage.removeItem(DEFECT_SAVE_ERROR_LOG_KEY);
        if (this.state.currentView === 'settings' && this.state.settingsTab === 'error-logs') {
            this.render();
        }
    },

    downloadDefectSaveErrorLogs() {
        const logs = (this.state.defectSaveErrorLogsLoaded ? this.state.defectSaveErrorLogs : this.getDefectSaveErrorLogs());
        if (logs.length === 0) {
            alert('다운로드할 저장 오류 로그가 없습니다.');
            return;
        }

        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `defect_save_error_logs_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
    },

    showDefectSaveErrorLogDetail(index) {
        return AdminModule.showDefectSaveErrorLogDetail(this, index);
    },

    async loadDefectSaveErrorLogs(options = {}) {
        this.state.defectSaveErrorLogsLoading = true;
        this.state.defectSaveErrorLogsError = '';

        if (!options.silent && this.state.currentView === 'settings' && this.state.settingsTab === 'error-logs') {
            this.render();
        }

        try {
            const logs = await StorageService.logs.getDefectSaveErrors(100);
            this.state.defectSaveErrorLogs = logs;
            this.state.defectSaveErrorLogsLoaded = true;
            this.state.defectSaveErrorLogsError = '';
        } catch (error) {
            this.state.defectSaveErrorLogsLoaded = true;
            this.state.defectSaveErrorLogsError = error?.message || '중앙 오류 로그를 불러오지 못했습니다.';
        } finally {
            this.state.defectSaveErrorLogsLoading = false;
            if (this.state.currentView === 'settings' && this.state.settingsTab === 'error-logs') {
                this.render();
            }
        }
    },

    async loadDefectActionRecheckItems(options = {}) {
        this.state.defectActionRecheckLoading = true;
        this.state.defectActionRecheckError = '';

        const shouldRenderActionRecheck = this.state.currentView === 'assignee-status'
            || (this.state.currentView === 'settings' && this.state.settingsTab === 'action-recheck');

        if (!options.silent && shouldRenderActionRecheck) {
            this.render();
        }

        try {
            this.state.defectActionRecheckItems = await StorageService.defects.getNeedingActionRecheck();
            this.state.defectActionRecheckLoaded = true;
            this.state.defectActionRecheckError = '';
        } catch (error) {
            this.state.defectActionRecheckItems = [];
            this.state.defectActionRecheckLoaded = true;
            this.state.defectActionRecheckError = error?.message || '결함조치재확인 목록을 불러오지 못했습니다.';
        } finally {
            this.state.defectActionRecheckLoading = false;
            if (shouldRenderActionRecheck) {
                this.render();
            }
        }
    },

    renderDefectSaveErrorLogPanel() {
        return AdminModule.renderDefectSaveErrorLogPanel(this);
    },

    renderDefectActionRecheckPanel() {
        return AdminModule.renderDefectActionRecheckPanel(this);
    },

    // --- Common Codes Helpers ---
    getCodesByGroup(group) {
        if (!this.state.commonCodes) return [];
        return this.state.commonCodes.filter(c => c.group_code === group);
    },

    getCodeName(group, value) {
        const codes = this.getCodesByGroup(group);
        const code = codes.find(c => c.code_value === value);
        return code ? code.code_name : value;
    },

    getCodeColor(group, value) {
        const codes = this.getCodesByGroup(group);
        const code = codes.find(c => c.code_value === value);
        return code ? code.color : null;
    },

    getEnabledTestTypes() {
        return this.state.settings?.enabledTestTypes || [];
    },

    isTestTypeEnabled(testType) {
        const normalizedType = testType || '단위테스트';
        const enabledTypes = this.getEnabledTestTypes();
        return enabledTypes.length === 0 || enabledTypes.includes(normalizedType);
    },

    getVisibleTestTypeCodes(selectedValue = '') {
        const enabledTypes = this.getEnabledTestTypes();
        const codes = this.getCodesByGroup('TEST_TYPE');

        if (enabledTypes.length === 0) {
            return codes;
        }

        const filteredCodes = codes.filter(c => enabledTypes.includes(c.code_value));

        if (selectedValue && !filteredCodes.some(c => c.code_value === selectedValue)) {
            const selectedCode = codes.find(c => c.code_value === selectedValue);
            if (selectedCode) {
                return [...filteredCodes, selectedCode];
            }
        }

        return filteredCodes;
    },

    normalizeScreenPath(screenPath = '') {
        return String(screenPath || '')
            .split('>')
            .map(part => part.replace(/\u3000/g, ' ').trim())
            .filter(Boolean)
            .join(' > ');
    },

    buildScreenPath(menuName = '', screenName = '') {
        return this.normalizeScreenPath([menuName, screenName].filter(Boolean).join(' > '));
    },

    parseScreenPath(screenPath = '') {
        const normalizedPath = this.normalizeScreenPath(screenPath);
        if (!normalizedPath) {
            return {
                screenPath: '',
                menuName: '',
                screenName: ''
            };
        }

        const parts = normalizedPath.split(' > ').filter(Boolean);
        const screenName = parts.pop() || '';

        return {
            screenPath: normalizedPath,
            menuName: parts.join(' > '),
            screenName
        };
    },

    getScreenPathOptions(selectedValue = '') {
        const normalizedSelected = this.normalizeScreenPath(selectedValue);
        const codes = this.getCodesByGroup('SCREEN_PATH').map(code => ({
            ...code,
            code_value: this.normalizeScreenPath(code.code_value),
            code_name: this.normalizeScreenPath(code.code_name || code.code_value)
        })).filter(code => code.code_value);

        if (normalizedSelected && !codes.some(code => code.code_value === normalizedSelected)) {
            return [
                ...codes,
                {
                    group_code: 'SCREEN_PATH',
                    code_value: normalizedSelected,
                    code_name: normalizedSelected,
                    sort_order: Number.MAX_SAFE_INTEGER
                }
            ];
        }

        return codes;
    },

    isMobileFrontOfficeScreenPath(screenPath = '') {
        const normalized = this.normalizeScreenPath(screenPath);
        return /^FO\s*\(MO\)\s*>/i.test(normalized);
    },

    getMobileScreenPathOptions(selectedValue = '') {
        const normalizedSelected = this.normalizeScreenPath(selectedValue);
        const codes = this.getScreenPathOptions(selectedValue).filter(code =>
            this.isMobileFrontOfficeScreenPath(code.code_value)
        );

        if (normalizedSelected && !codes.some(code => code.code_value === normalizedSelected) && this.isMobileFrontOfficeScreenPath(normalizedSelected)) {
            return [
                ...codes,
                {
                    group_code: 'SCREEN_PATH',
                    code_value: normalizedSelected,
                    code_name: normalizedSelected,
                    sort_order: Number.MAX_SAFE_INTEGER
                }
            ];
        }

        return codes;
    },

    getRegisterUrl(mode = 'standalone') {
        const baseUrl = new URL(window.location.href);
        baseUrl.search = '';
        baseUrl.hash = '';
        baseUrl.searchParams.set('mode', mode);
        baseUrl.hash = 'register';
        return baseUrl.toString();
    },

    getExtensionZipUrl() {
        return new URL('./extension/extension.zip', window.location.href).toString();
    },

    getCenteredPopupFeatures(width, height, extraFeatures = []) {
        return BridgeService.getCenteredPopupFeatures(width, height, extraFeatures, window);
    },

    getMobileQuickPopupSize() {
        return BridgeService.getMobileQuickPopupSize(window);
    },

    buildPendingDefectSeed(source = {}) {
        return BridgeService.buildPendingDefectSeed(source, {
            buildScreenPath: (menuName, screenName) => this.buildScreenPath(menuName, screenName),
            parseScreenPath: (screenPath) => this.parseScreenPath(screenPath),
            normalizeScreenUrl: (rawUrl) => this.normalizeScreenUrl(rawUrl),
            currentHref: window.location.href
        });
    },

    openMobileQuickRegister() {
        const form = document.getElementById('defectForm');
        let seed = this.buildPendingDefectSeed({
            creator: this.state.currentUser?.name || '',
            screen_url: window.location.href
        });

        if (form) {
            const payload = this.buildDefectPayload(form, null);
            seed = this.buildPendingDefectSeed(payload);
        }

        try {
            BridgeService.savePendingDefect(seed);
        } catch (error) {
            console.error('[App] Failed to save mobile quick seed:', error);
        }

        const popupSize = this.getMobileQuickPopupSize();
        const popup = window.open(
            this.getRegisterUrl('mobile'),
            'DefectFlowMobileQuickRegister',
            this.getCenteredPopupFeatures(popupSize.width, popupSize.height)
        );

        if (!popup) {
            alert('팝업 차단을 해제해주세요.');
            return;
        }

        popup.focus?.();
    },

    openExtensionGuide() {
        if (!this.requireLogin('extension-guide')) {
            return;
        }

        const modalBody = document.getElementById('modalBody');
        if (this.state.currentModal && modalBody) {
            this.state.currentModal = 'extension-guide';
            this.renderExtensionGuide(modalBody, { insideModal: true });
            this.openModal();
            return;
        }

        this.navigate('extension-guide');
    },

    updateScreenPathPreview(screenPath = '') {
        const parsed = this.parseScreenPath(screenPath);
        const menuInput = document.getElementById('menuNamePreview');
        const screenInput = document.getElementById('screenNamePreview');

        if (menuInput) {
            menuInput.value = parsed.menuName;
        }

        if (screenInput) {
            screenInput.value = parsed.screenName;
        }
    },

    getCurrentFormScreenshot(fallback = '') {
        const screenshotInput = document.querySelector('input[name="screenshot"]');
        return this.state.transientScreenshotData || screenshotInput?.value || fallback || '';
    },

    viewCurrentPreview(fallback = '') {
        const source = this.getCurrentFormScreenshot(fallback);
        if (!source) {
            alert('표시할 이미지 또는 화면 정보가 없습니다.');
            return;
        }
        this.viewExternal(source);
    },

    getUserStatusOptions(selectedValue = '') {
        const defaults = [
            { code_value: '사용', code_name: '사용' },
            { code_value: '미사용', code_name: '미사용' }
        ];

        if (selectedValue && !defaults.some(option => option.code_value === selectedValue)) {
            return [...defaults, { code_value: selectedValue, code_name: selectedValue }];
        }

        return defaults;
    },

    getActiveUserOptions(selectedValue = '') {
        const selected = String(selectedValue || '').trim();
        const users = (this.state.users || [])
            .filter(user => this.isUserActive(user.status))
            .map(user => ({
                name: user.name || '',
                department: user.department || ''
            }))
            .filter(user => user.name);

        if (selected && !users.some(user => user.name === selected)) {
            return [
                ...users,
                {
                    name: selected,
                    department: ''
                }
            ];
        }

        return users;
    },

    isUserActive(status) {
        return status === '사용';
    },

    state: {
        currentView: 'dashboard',
        defects: [],
        allDefectsSummary: [],
        users: [],
        stats: { total: 0, open: 0, resolved: 0, critical: 0 },
        initialRouteHandled: false,
        currentModal: null, // 'register', 'edit', 'action'
        isStandalone: false,
        isMobileQuickMode: false,
        isLoggedIn: false,
        currentUser: null,
        currentRole: '테스터', // '테스터', '조치자', '관리자'
        listConfig: {
            page: 1,
            pageSize: 20,
            search: createDefaultListSearch()
        },
        userListConfig: {
            page: 1,
            pageSize: 15,
            pageGroupSize: 10
        },
        settings: {
            enabledTestTypes: ['선오픈', '통합테스트', '3자테스트(I&C)', '3자테스트(W2)', '단위테스트']
        },
        pendingDefectData: null, // Stores data received via postMessage for cross-domain support
        pendingDefectSource: '',
        transientScreenshotData: '',
        defectSaveErrorLogs: [],
        defectSaveErrorLogsLoaded: false,
        defectSaveErrorLogsLoading: false,
        defectSaveErrorLogsError: '',
        defectActionRecheckItems: [],
        defectActionRecheckLoaded: false,
        defectActionRecheckLoading: false,
        defectActionRecheckError: '',
        selectedDefect: null,
        commonCodes: [],
        settingsTab: 'test-types',
        userManualContent: '',
        userManualLoading: false,
        userManualError: '',
        returnTo: null,
        sessionRestoreComplete: false
    },

    createSessionSnapshot(user) {
        if (!user) {
            return null;
        }

        return {
            user_id: user.user_id ?? null,
            name: user.name || '',
            email: user.email || '',
            department: user.department || '',
            role: user.role || '테스터',
            status: user.status || '사용'
        };
    },

    setAuthenticatedUser(user, options = {}) {
        const sessionUser = this.createSessionSnapshot(user);
        if (!sessionUser) {
            this.clearAuthenticatedUser();
            return;
        }

        this.state.isLoggedIn = true;
        this.state.currentUser = sessionUser;
        this.state.currentRole = sessionUser.role;
        document.body.classList.add('logged-in');

        if (options.persist !== false) {
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        }
    },

    clearAuthenticatedUser() {
        this.state.isLoggedIn = false;
        this.state.currentUser = null;
        this.state.currentRole = '테스터';
        localStorage.removeItem('currentUser');
        document.body.classList.remove('logged-in');
    },

    async restoreSavedSession() {
        const savedUser = localStorage.getItem('currentUser');
        if (!savedUser) {
            this.clearAuthenticatedUser();
            return false;
        }

        try {
            const parsedUser = JSON.parse(savedUser);
            if (!parsedUser?.email) {
                throw new Error('Saved session is missing email.');
            }

            const freshUser = await StorageService.users.findByEmail(parsedUser.email);
            if (!freshUser || !this.isUserActive(freshUser.status)) {
                console.warn('[App] Saved session is no longer valid.');
                this.clearAuthenticatedUser();
                return false;
            }

            this.setAuthenticatedUser(freshUser);
            return true;
        } catch (error) {
            console.warn('[App] Failed to restore saved session:', error);
            this.clearAuthenticatedUser();
            return false;
        }
    },

    resetModalState() {
        this.state.currentModal = null;
        this.state.selectedDefect = null;
        this.state.transientScreenshotData = '';

        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }

        const modalContent = document.getElementById('modalContent');
        if (modalContent) {
            modalContent.classList.remove('maximize');
        }

        const maximizeBtn = document.getElementById('maximizeBtn');
        if (maximizeBtn) {
            maximizeBtn.className = 'fas fa-expand-alt modal-control-btn';
        }

        document.body.style.overflow = '';
    },

    requireLogin(targetView = 'dashboard') {
        if (this.state.isLoggedIn) {
            return true;
        }

        this.state.returnTo = targetView;
        this.resetModalState();
        this.state.currentView = 'login';
        this.render();
        return false;
    },

    handleIncomingDefectData() {
        if (!this.state.sessionRestoreComplete) {
            return;
        }

        if (this.state.isLoggedIn) {
            this.showRegisterModal();
        } else {
            this.requireLogin('register');
        }
    },

    async init() {
        console.log("[App] 1. Initializing...");
        try {
            console.log("[App] 2. StorageService Init..."); StorageService.init();
            this.initializeRuntimeContext();
            this.bindEvents();
            await this.restoreSavedSession();
            this.state.sessionRestoreComplete = true;

            // Load Common Codes
            try {
                console.log("[App] 3. Fetching Common Codes..."); this.state.commonCodes = await StorageService.commonCodes.fetch(); console.log("[App] 4. Common Codes Loaded:", this.state.commonCodes.length);
            } catch (err) {
                console.error("[App] Common codes load failed:", err);
            }

            await this.loadSettings();

            console.log("[App] 5. Starting FetchData..."); await this.fetchData(); console.log("[App] 6. Init Finished.");
        } catch (err) {
            console.error("[App] Init failed:", err);
        }
    },

    initializeRuntimeContext() {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        this.state.isMobileQuickMode = mode === 'mobile';
        this.state.isStandalone = mode === 'standalone' || this.state.isMobileQuickMode;

        if (this.state.isStandalone) {
            document.body.classList.add('standalone-mode');
            if (this.state.isMobileQuickMode) {
                document.body.classList.add('mobile-quick-mode');
            }
            const requestedView = window.location.hash.substring(1) || 'register';
            this.state.returnTo = requestedView;
            BridgeService.notifyReady(window);
        }
    },

    async loadSettings() {
        const localSettings = localStorage.getItem('app_settings');
        if (localSettings) {
            try {
                this.state.settings = { ...this.state.settings, ...JSON.parse(localSettings) };
            } catch (err) {
                console.error('[App] Failed to parse local app settings:', err);
            }
        }

        try {
            const globalSettings = await StorageService.settings.get();
            if (globalSettings) {
                this.state.settings = { ...this.state.settings, ...globalSettings };
                localStorage.setItem('app_settings', JSON.stringify(this.state.settings));
            }
        } catch (err) {
            console.error('[App] Failed to load global app settings:', err);
        }

        if (this.state.listConfig.search.testType && !this.isTestTypeEnabled(this.state.listConfig.search.testType)) {
            this.state.listConfig.search.testType = '';
        }
    },

    getDataTargetView(viewHint = '') {
        if (viewHint) return viewHint;

        const hashView = window.location.hash.substring(1);
        if (!this.state.initialRouteHandled) {
            return hashView || this.state.currentView || 'dashboard';
        }

        return this.state.currentView || hashView || 'dashboard';
    },

    shouldLoadListData(view) {
        return view === 'list';
    },

    async fetchData(options = {}) {
        const targetView = this.getDataTargetView(options.viewHint);
        const shouldLoadListData = options.includeListData ?? this.shouldLoadListData(targetView);

        console.log(`[App] [fetchData] Starting... targetView=${targetView}, includeListData=${shouldLoadListData}`);
        console.log("[App] Fetching data...");
        try {
            console.log("[App] [fetchData] 1. Fetching Stats Summary..."); this.state.allDefectsSummary = await StorageService.defects.getSummaryForStats() || []; console.log("[App] [fetchData] 2. Stats Summary Loaded.");

            if (shouldLoadListData) {
                const result = await StorageService.defects.getList(this.state.listConfig.page, this.state.listConfig.pageSize, {
                    ...this.state.listConfig.search,
                    enabledTestTypes: this.getEnabledTestTypes()
                });
                this.state.defects = result.data;
                this.state.totalDefectCount = result.totalCount;
            }

            this.state.users = await StorageService.users.getList() || [];

            this.getFilteredDefects(); // Updates stats

            if (!this.state.initialRouteHandled) {
                const hash = window.location.hash.substring(1) || 'dashboard';
                this.navigate(hash);
                this.state.initialRouteHandled = true;
                return;
            }

            console.log("[App] [fetchData] 5. Rendering Screen..."); this.render();
        } catch (err) {
            console.error("[App] FetchData failed:", err);
        }
    },

    bindEvents() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1) || 'dashboard';
            if (this.state.currentView !== hash) {
                this.navigate(hash);
            }
        });

        window.addEventListener('message', (event) => {
            if (!BridgeService.isDataMessage(event)) return;

            this.state.pendingDefectData = BridgeService.getDataMessagePayload(event);
            this.state.pendingDefectSource = 'postMessage';
            console.log("[App] Received defect data via postMessage. Screenshot status:", !!this.state.pendingDefectData?.screenshot);
            this.handleIncomingDefectData();
        });

        document.addEventListener('click', (event) => {
            const navItem = event.target.closest('.nav-item');
            if (!navItem) return;

            const view = navItem.dataset.view;
            if (!view) return;

            event.preventDefault();
            this.navigate(view);
        });
    },


    getFilteredDefects() {
        const d = (this.state.allDefectsSummary || []).filter(d => this.isTestTypeEnabled(d.test_type));

        this.state.stats = {
            total: d.length,
            inProgress: d.filter(x => x.status === 'In Progress').length,
            notCompleted: d.filter(x => DEFECT_NOT_COMPLETED_STATUSES.includes(x.status)).length,
            resolved: d.filter(x => DEFECT_COMPLETED_STATUSES.includes(x.status)).length,
            critical: d.filter(x => x.severity === 'Critical').length
        };
    },

    navigate(view) {
        if (!view) view = 'dashboard';
        const previousView = this.state.currentView;

        // Authentication Guard
        const isAuthView = ['login', 'signup', 'password-reset'].includes(view);

        if (!isAuthView && !this.requireLogin(view)) {
            return;
        }

        if (view === 'register') {
            // 외부 연동(Test Bench)인 경우 데이터를 유지하고, 일반 메뉴 클릭 시에만 초기화
            if (!this.state.isStandalone) {
                BridgeService.clearPendingDefect();
            } else {
                this.state.currentView = 'register';
                this.render();
            }
            this.showRegisterModal();
            return;
        }

        const operatorViews = ['assignee-status'];
        if (operatorViews.includes(view) && !['조치자', '관리자'].includes(this.state.currentRole)) {
            alert('조치자 또는 관리자 권한이 필요한 메뉴입니다.');
            this.navigate('dashboard');
            return;
        }

        // Admin view check
        const adminViews = ['users', 'settings'];
        if (adminViews.includes(view) && this.state.currentRole !== '관리자') {
            alert('관리자 권한이 필요한 메뉴입니다.');
            this.navigate('dashboard');
            return;
        }

        this.state.currentView = view;
        window.location.hash = view;

        if (this.state.isLoggedIn) {
            document.body.classList.add('logged-in');
        } else {
            document.body.classList.remove('logged-in');
        }

        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) navItem.classList.add('active');
        console.log("[App] [fetchData] 5. Rendering Screen..."); this.render();

        if (view === 'list' && previousView !== 'list' && this.state.initialRouteHandled) {
            this.fetchData({ viewHint: 'list' });
        }

        if (view === 'assignee-status' && previousView !== 'assignee-status' && !this.state.defectActionRecheckLoading) {
            this.loadDefectActionRecheckItems({ silent: true });
        }
    },

    renderStandaloneShell(container) {
        return AuthModule.renderStandaloneShell(container);
    },

    render() {
        const root = document.getElementById('app');
        root.innerHTML = '';

        // Sidebar Visibility Check
        this.updateSidebar();

        switch (this.state.currentView) {
            case 'dashboard': this.renderDashboard(root); break;
            case 'list': this.renderList(root); break;
            case 'assignee-status': this.renderAssigneeStatusScreen(root); break;
            case 'users': this.renderUsers(root); break;
            case 'settings': this.renderSettings(root); break;
            case 'extension-guide': this.renderExtensionGuide(root); break;
            case 'user-manual': this.renderUserManual(root); break;
            case 'register':
                if (this.state.isStandalone) {
                    this.renderStandaloneShell(root);
                }
                break;
            case 'login': this.renderLogin(root); break;
            case 'signup': this.renderSignup(root); break;
            case 'password-reset': this.renderPasswordReset(root); break;
        }
    },

    updateSidebar() {
        const loggedIn = this.state.isLoggedIn;
        const user = this.state.currentUser;

        // Operator Menus
        const operatorMenu = document.getElementById('operatorMenus');
        if (operatorMenu) {
            operatorMenu.style.display = (loggedIn && user && ['조치자', '관리자'].includes(user.role)) ? 'block' : 'none';
        }

        // Admin Menus
        const adminMenu = document.getElementById('adminOnlyMenus');
        if (adminMenu) {
            adminMenu.style.display = (loggedIn && user && user.role === '관리자') ? 'block' : 'none';
        }

        // Login/User Section
        const userSection = document.getElementById('userSection');
        const loginPrompt = document.getElementById('loginPrompt');

        if (loggedIn && user) {
            if (userSection) userSection.style.display = 'block';
            if (loginPrompt) loginPrompt.style.display = 'none';

            document.getElementById('userName').textContent = user.name;
            document.getElementById('userRole').textContent = user.role;
            document.getElementById('userAvatar').textContent = user.name.substring(0, 1);
        } else {
            if (userSection) userSection.style.display = 'none';
            if (loginPrompt) loginPrompt.style.display = 'block';
        }

        // Hide Sidebar entirely on Login/Signup/Reset pages or Standalone mode
        const nav = document.querySelector('nav');
        const isAuthPage = ['login', 'signup', 'password-reset'].includes(this.state.currentView);
        const shouldHideNav = isAuthPage || this.state.isStandalone;

        if (nav) nav.style.display = shouldHideNav ? 'none' : 'flex';
        document.getElementById('app').style.marginLeft = shouldHideNav ? '0' : '260px';
    },

    renderLogin(container) {
        return AuthModule.renderLogin(this, container);
    },

    renderSignup(container) {
        return AuthModule.renderSignup(this, container);
    },

    renderPasswordReset(container) {
        return AuthModule.renderPasswordReset(this, container);
    },

    renderExtensionGuide(container, options = {}) {
        return AuthModule.renderExtensionGuide(this, container, options);
    },

    async loadUserManual() {
        if (this.state.userManualLoading || this.state.userManualContent) {
            return;
        }

        this.state.userManualLoading = true;
        this.state.userManualError = '';

        try {
            const response = await fetch('./docs/user_manual.md', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`사용자메뉴얼을 불러오지 못했습니다. (${response.status})`);
            }
            this.state.userManualContent = await response.text();
        } catch (error) {
            console.error('[App] Failed to load user manual:', error);
            this.state.userManualError = error?.message || '사용자메뉴얼을 불러오지 못했습니다.';
        } finally {
            this.state.userManualLoading = false;
            if (this.state.currentView === 'user-manual') {
                this.render();
            }
        }
    },

    renderManualMarkdown(markdown = '') {
        const inline = (text = '') => this.sanitize(text)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        let listType = '';
        const html = [];
        const closeList = () => {
            if (listType) {
                html.push(`</${listType}>`);
                listType = '';
            }
        };

        String(markdown || '').split(/\r?\n/).forEach((rawLine) => {
            const line = rawLine.trim();

            if (!line) {
                closeList();
                return;
            }

            if (line === '---') {
                closeList();
                html.push('<hr>');
                return;
            }

            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                closeList();
                html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
                return;
            }

            const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (image) {
                closeList();
                const rawSrc = image[2].trim();
                const src = rawSrc.startsWith('images/') ? `./docs/${rawSrc}` : rawSrc;
                html.push(`
                    <figure class="manual-image">
                        <img src="${this.sanitize(src)}" alt="${this.sanitize(image[1])}">
                        ${image[1] ? `<figcaption>${this.sanitize(image[1])}</figcaption>` : ''}
                    </figure>
                `);
                return;
            }

            const ordered = line.match(/^\d+\.\s+(.+)$/);
            if (ordered) {
                if (listType !== 'ol') {
                    closeList();
                    listType = 'ol';
                    html.push('<ol>');
                }
                html.push(`<li>${inline(ordered[1])}</li>`);
                return;
            }

            const unordered = line.match(/^\*\s+(.+)$/);
            if (unordered) {
                if (listType !== 'ul') {
                    closeList();
                    listType = 'ul';
                    html.push('<ul>');
                }
                html.push(`<li>${inline(unordered[1])}</li>`);
                return;
            }

            closeList();
            html.push(`<p>${inline(line)}</p>`);
        });

        closeList();
        return html.join('');
    },

    renderUserManual(container) {
        if (!this.state.userManualContent && !this.state.userManualLoading && !this.state.userManualError) {
            this.loadUserManual();
        }

        const body = this.state.userManualLoading
            ? '<div class="loader">사용자메뉴얼을 불러오는 중...</div>'
            : this.state.userManualError
                ? `<div class="manual-card"><p style="color: var(--error);">${this.sanitize(this.state.userManualError)}</p></div>`
                : `<div class="manual-card"><div class="manual-content">${this.renderManualMarkdown(this.state.userManualContent)}</div></div>`;

        container.innerHTML = `
            <div class="manual-view animate-in">
                <header>
                    <div>
                        <h1>사용자메뉴얼</h1>
                        <p class="subtitle">DefectFlow 주요 사용 절차와 권한별 작업 기준입니다.</p>
                    </div>
                </header>
                ${body}
            </div>
        `;
    },

    handleLogout() {
        if (confirm('로그아웃 하시겠습니까?')) {
            this.clearAuthenticatedUser();
            // Clear hash and reload for a completely clean state
            window.location.hash = 'login';
            window.location.reload();
        }
    },

    renderUsers(container) {
        return AdminModule.renderUsers(this, container);
    },

    renderUserForm(id = null) {
        return AdminModule.renderUserForm(this, id);
    },

    async handleUserSubmit(id, formData) {
        const payload = Object.fromEntries(formData.entries());
        payload.status = payload.status || '사용';
        if (await StorageService.users.save(payload, id)) {
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            this.fetchData();
            this.closeModal();
        }
    },

    renderSettings(container) {
        return AdminModule.renderSettings(this, container);
    },

    renderAssigneeStatusScreen(container) {
        return AssigneeStatusModule.render(this, container);
    },

    renderAssigneeStatusPanel() {
        return AssigneeStatusModule.renderPanel(this);
    },

    viewAssigneeDefects(assigneeName) {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: assigneeName,
            assigneeUnassigned: false,
            identificationUnassigned: false,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewAssigneeDefectsByStatus(assigneeName, status) {
        this.state.listConfig.search = {
            severity: '',
            status: status,
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: assigneeName,
            assigneeUnassigned: false,
            identificationUnassigned: false,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewUnassignedDefects(status = '') {
        this.state.listConfig.search = {
            severity: '',
            status: status,
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: '',
            assigneeUnassigned: true,
            identificationUnassigned: false,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewSeverityDefects(severity, status = '') {
        this.state.listConfig.search = {
            severity: severity || '',
            status: status || '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: '',
            assigneeUnassigned: false,
            identificationUnassigned: false,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewIdentificationDefects(identification) {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: '',
            assigneeUnassigned: false,
            identificationUnassigned: false,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: identification || '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewIdentificationUnassignedDefects() {
        this.state.listConfig.search = {
            severity: '',
            status: '',
            title: '',
            stepsToRepro: '',
            creator: '',
            assignee: '',
            assigneeUnassigned: false,
            identificationUnassigned: true,
            testType: '',
            dateStart: '',
            dateEnd: '',
            identification: '',
            screenPath: ''
        };
        this.state.listConfig.page = 1;
        this.navigate('list');
    },

    viewNotCompletedDefects() {
        this.state.listConfig.search = createDefaultListSearch({
            statusPreset: LIST_STATUS_PRESET_NOT_COMPLETED
        });
        this.state.listConfig.page = 1;

        if (this.state.currentView === 'list') {
            this.fetchData({ viewHint: 'list' });
            return;
        }

        this.navigate('list');
    },

    viewDefectInList(defectId) {
        this.state.listConfig.search = createDefaultListSearch({
            defectId: String(defectId || '')
        });
        this.state.listConfig.page = 1;

        if (this.state.currentView === 'list') {
            this.fetchData({ viewHint: 'list' });
            return;
        }

        this.navigate('list');
    },

    renderCommonCodeForm(groupCode = '', codeValue = '') {
        return AdminModule.renderCommonCodeForm(this, groupCode, codeValue);
    },

    async deleteCommonCode(groupCode, codeValue) {
        if (!confirm(`[${groupCode}] ${codeValue} 코드를 삭제하시겠습니까?`)) return;

        if (await StorageService.commonCodes.remove(groupCode, codeValue)) {
            this.state.commonCodes = await StorageService.commonCodes.fetch();
            this.render();
            alert('공통코드가 삭제되었습니다.');
        } else {
            alert('공통코드 삭제에 실패했습니다.');
        }
    },

    async updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };

        // 1. Sync to LocalStorage (Immediate UI feedback fallback)
        localStorage.setItem('app_settings', JSON.stringify(this.state.settings));

        // 2. Sync to Global DB (Supabase)
        try {
            const success = await StorageService.settings.save(this.state.settings);
            if (!success) {
                console.warn("[App] Could not save settings to DB. Persistent only in local browser session.");
            }
        } catch (err) {
            console.error("[App] Error saving settings to Supabase:", err);
        }

        // Refresh calculations and UI
        await this.fetchData();
        alert('설정이 전역적으로 저장되었습니다.');
    },

    async deleteUser(id) {
        if (!confirm('해당 담당자를 삭제하시겠습니까?')) return;
        if (await StorageService.users.remove(id)) {
            this.fetchData();
        }
    },

    /**
     * Helper: Format UTC/ISO date string to Korean Standard Time (KST) display
     */
    /**
     * Helper: Format UTC/ISO date string to Korean Standard Time (KST) display
     */
    formatDateKST(isoString, includeTime = true) {
        return AppUtils.formatDateKST(isoString, includeTime);
    },

    /**
     * Helper: Get YYYY-MM-DD string in Korean Standard Time (KST)
     */
    getKSTDateString(isoString) {
        return AppUtils.getKSTDateString(isoString);
    },

    renderDashboard(container) {
        return DashboardModule.render(this, container);
    },

    renderList(container) {
        return ListModule.render(this, container);
    },

    // 조회 버튼 클릭 또는 텍스트 입력 Enter 시 실행
    handleSearch() {
        const defectId = document.getElementById('searchDefectId').value.trim();
        if (defectId && !/^\d+$/.test(defectId)) {
            alert('결함 ID는 숫자만 입력해주세요.');
            return;
        }

        const selectedIdentification = document.getElementById('searchIdentification').value;
        const selectedStatus = document.getElementById('searchStatus').value;
        this.state.listConfig.search = createDefaultListSearch({
            defectId,
            severity: document.getElementById('searchSeverity').value,
            status: selectedStatus === LIST_STATUS_PRESET_NOT_COMPLETED ? '' : selectedStatus,
            statusPreset: selectedStatus === LIST_STATUS_PRESET_NOT_COMPLETED ? LIST_STATUS_PRESET_NOT_COMPLETED : '',
            identification: selectedIdentification === '__UNASSIGNED__' ? '' : selectedIdentification,
            identificationUnassigned: selectedIdentification === '__UNASSIGNED__',
            screenPath: document.getElementById('searchScreenPath').value,
            title: document.getElementById('searchTitle').value,
            stepsToRepro: document.getElementById('searchStepsToRepro').value,
            creator: document.getElementById('searchCreator').value,
            assignee: document.getElementById('searchAssignee').value,
            testType: document.getElementById('searchTestType').value,
            dateStart: document.getElementById('searchDateStart').value,
            dateEnd: document.getElementById('searchDateEnd').value
        });
        this.state.listConfig.page = 1;
        this.fetchData();
    },

    resetFilters() {
        this.state.listConfig.search = createDefaultListSearch();
        this.state.listConfig.page = 1;
        this.fetchData(); // 초기화 후 즉시 전체 재조회
    },

    handlePageSizeChange() {
        this.state.listConfig.pageSize = parseInt(document.getElementById('pageSizeSelect').value);
        this.state.listConfig.page = 1;
        this.fetchData(); // Trigger server-side fetch
    },

    changePage(p) {
        this.state.listConfig.page = p;
        this.fetchData(); // Trigger server-side fetch
    },

    changeUserPage(p) {
        const config = this.state.userListConfig || { pageSize: 15 };
        const totalPages = Math.max(1, Math.ceil((this.state.users || []).length / config.pageSize));
        this.state.userListConfig.page = Math.min(Math.max(1, p), totalPages);
        this.render();
    },

    async downloadExcel() {
        // 로딩 표시
        const btn = document.querySelector('button[onclick="App.downloadExcel()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 다운로드 중...'; }

        try {
            // 현재 검색 필터를 적용해 전체 항목 조회 (페이징 없음, 이미지 컬럼 제외)
            const filters = {
                ...(this.state.listConfig.search || {}),
                enabledTestTypes: this.getEnabledTestTypes()
            };
            const allDefects = await StorageService.defects.getAllForExport(filters);

            if (allDefects.length === 0) {
                alert('다운로드할 데이터가 없습니다.');
                return;
            }

            const headers = [
                'ID', '구분', '제목', '결함식별', '심각도', '우선순위', '상태',
                '메뉴명', '화면명', '재현단계', '환경정보', '등록자', '담당자',
                '등록일', '수정일', '조치내용', '조치예정일', '조치시작일', '조치종료일'
            ];
            const csvRows = [headers.join(',')];

            allDefects.forEach(d => {
                const row = [
                    d.defect_id,
                    d.test_type || '단위테스트',
                    `"${(d.title || '').replace(/"/g, '""')}"`,
                    d.defect_identification || '-',
                    d.severity,
                    d.priority,
                    d.status,
                    `"${(d.menu_name || '').replace(/"/g, '""')}"`,
                    `"${(d.screen_name || '').replace(/"/g, '""')}"`,
                    `"${(d.steps_to_repro || '').replace(/"/g, '""')}"`,
                    `"${(d.env_info || '').replace(/"/g, '""')}"`,
                    d.creator,
                    d.assignee || '',
                    this.formatDateKST(d.created_at),
                    d.updated_at ? this.formatDateKST(d.updated_at) : '',
                    `"${(d.action_comment || '').replace(/"/g, '""')}"`,
                    d.action_due_date ? this.formatDateKST(d.action_due_date, false) : '',
                    d.action_start ? this.formatDateKST(d.action_start, false) : '',
                    d.action_end ? this.formatDateKST(d.action_end, false) : ''
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = "\ufeff" + csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const kstDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\./, '');
            link.setAttribute('href', url);
            link.setAttribute('download', `defects_export_${kstDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('[App] Excel export failed:', err);
            alert('엑셀 다운로드 중 오류가 발생했습니다.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-excel"></i> 엑셀 다운로드'; }
        }
    },

    truncate(str, len) {
        return AppUtils.truncate(str, len);
    },

    buildPaginationRange(currentPage, totalPages, groupSize = 10) {
        return AppUtils.buildPaginationRange(currentPage, totalPages, groupSize);
    },

    renderForm(container, id = null, itemOverride = null) {
        return FormModule.renderForm(this, container, id, itemOverride);
    },

    renderMobileQuickForm(container, itemOverride = null) {
        return FormModule.renderMobileQuickForm(this, container, itemOverride);
    },

    renderActionForm(container, id, itemOverride = null) {
        return FormModule.renderActionForm(this, container, id, itemOverride);
    },

    async handleFormSubmit(id) {
        if (!this.state.isLoggedIn) {
            alert('로그인이 필요합니다.');
            this.requireLogin('register');
            return;
        }

        const form = document.getElementById('defectForm');
        const submitButton = form.querySelector('button[type="submit"]');
        let payload = this.buildDefectPayload(form, id);

        // Security: String validation
        if (!payload.title || payload.title.length < 5) {
            alert('제목을 5자 이상 입력해주세요.');
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = id ? '저장 중...' : '등록 중...';
        }

        try {
            payload = await this.prepareDefectPayloadForSubmit(payload);
        } catch (error) {
            console.error('[App] Failed to prepare defect payload before submit:', error);
        }

        const saveResult = await StorageService.defects.save(payload, id);
        if (saveResult.ok) {
            BridgeService.clearPendingDefect();
            this.state.pendingDefectData = null;
            this.state.pendingDefectSource = '';
            alert(id ? '수정되었습니다.' : '등록되었습니다.');
            if (this.state.isStandalone) {
                this.closeModal();
                return;
            }
            // 2. Load Common Codes (Added for Phase 3-1)
            try {
                console.log("[App] 3. Fetching Common Codes..."); this.state.commonCodes = await StorageService.commonCodes.fetch(); console.log("[App] 4. Common Codes Loaded:", this.state.commonCodes.length);
                console.log("[App] Common codes loaded:", this.state.commonCodes.length);
            } catch (err) {
                console.error("[App] Failed to load common codes:", err);
                this.state.commonCodes = [];
            }

            console.log("[App] 5. Starting FetchData..."); await this.fetchData(); console.log("[App] 6. Init Finished.");
            this.closeModal();
            if (!id) this.navigate('list');
            return;
        }

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = id ? '수정 완료' : '결함 등록';
        }

        await this.handleDefectSaveFailure({
            operation: id ? 'update' : 'create',
            defectId: id,
            payload,
            saveResult,
            userMessage: id ? '수정에 실패했습니다.' : '등록에 실패했습니다.'
        });
    },

    showRegisterModal() {
        if (!this.requireLogin('register')) {
            return;
        }

        this.state.currentModal = 'register';
        const modalBody = document.getElementById('modalBody');
        if (this.state.isMobileQuickMode) {
            this.renderMobileQuickForm(modalBody);
        } else {
            this.renderForm(modalBody, null);
        }
        this.openModal();
    },

    async editDefect(id) {
        this.state.currentModal = 'edit';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        try {
            this.state.selectedDefect = await StorageService.defects.getById(id);
        } catch (err) {
            console.error("[App] Failed to load defect detail for edit:", err);
            this.state.selectedDefect = this.getSelectedDefect(id);
        }
        this.renderForm(modalBody, id, this.state.selectedDefect);
        this.openModal();
    },

    async actionDefect(id) {
        this.state.currentModal = 'action';
        this.state.editingId = id;
        const modalBody = document.getElementById('modalBody');
        try {
            this.state.selectedDefect = await StorageService.defects.getById(id);
        } catch (err) {
            console.error("[App] Failed to load defect detail for action:", err);
            this.state.selectedDefect = this.getSelectedDefect(id);
        }
        this.renderActionForm(modalBody, id, this.state.selectedDefect);
        this.openModal();
    },

    openModal() {
        document.getElementById('modalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        if (this.state.isStandalone) {
            const closeTargets = BridgeService.notifyClose(window);
            if (closeTargets.hasParentFrame) {
                return;
            }
            window.close();
            return;
        }
        this.resetModalState();
    },

    toggleMaximize() {
        const content = document.getElementById('modalContent');
        const btn = document.getElementById('maximizeBtn');
        const isMaximized = content.classList.toggle('maximize');

        if (isMaximized) {
            btn.className = 'fas fa-compress-alt modal-control-btn';
            btn.title = '창 모드로 보기';
        } else {
            btn.className = 'fas fa-expand-alt modal-control-btn';
            btn.title = '전체 화면';
        }
    },

    viewExternal(url) {
        if (!url) return;
        const width = 1200;
        const height = 900;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const viewer = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
        if (!viewer) {
            alert('팝업 차단을 해제해주세요.');
            return;
        }

        const isImage = url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);

        viewer.document.write(`
            <html>
            <head>
                <title>DefectFlow - Image Viewer</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
                    .header { background: #1e293b; padding: 0.75rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10; }
                    .btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
                    .btn-close { background: #ef4444; }
                    .content { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; background: #000; padding: 20px; }
                    iframe { width: 100%; height: 100%; border: none; background: white; }
                    img { max-width: 95%; max-height: 95%; object-fit: contain; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border-radius: 0.5rem; cursor: zoom-in; transition: all 0.2s; }
                    img.enlarged { max-width: none; max-height: none; cursor: zoom-out; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-image" style="color:#3b82f6"></i>
                        <span style="font-weight:700">${isImage ? '관련 이미지 확대 보기' : '관련 페이지 보기'}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn" onclick="window.print()"><i class="fas fa-print"></i> 인쇄</button>
                        <button class="btn btn-close" onclick="window.close()"><i class="fas fa-times"></i> 닫기</button>
                    </div>
                </div>
                <div class="content">
                    ${isImage
                ? `<img src="${url}" onclick="this.classList.toggle('enlarged')">`
                : `<iframe src="${url}"></iframe>`}
                </div>
            </body>
            </html>
        `);
        viewer.document.close();
    },

    async copyText(text, successMessage = '복사되었습니다.') {
        const value = String(text || '');
        if (!value) {
            alert('복사할 내용이 없습니다.');
            return false;
        }

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                textarea.style.pointerEvents = 'none';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            alert(successMessage);
            return true;
        } catch (error) {
            console.error('[App] Failed to copy text:', error);
            alert('복사에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            return false;
        }
    },

    async copyDefectManagementId(defectId) {
        const normalizedId = String(defectId || '').replace(/^#/, '').trim();
        if (!normalizedId) {
            alert('복사할 결함관리번호가 없습니다.');
            return false;
        }

        return this.copyText(normalizedId, `결함관리번호 #${normalizedId}를 복사했습니다.`);
    },

    async copyScreenUrl() {
        const screenUrlInput = document.querySelector('input[name="screen_url"]');
        const screenUrl = this.normalizeScreenUrl(screenUrlInput?.value || '');
        return this.copyText(screenUrl, 'Screen URL을 복사했습니다.');
    },

    isImageSource(url) {
        return ImageService.isImageSource(url);
    },

    readFileAsDataUrl(file) {
        return ImageService.readFileAsDataUrl(file);
    },

    normalizeScreenUrl(rawUrl) {
        return AppUtils.normalizeScreenUrl(rawUrl);
    },

    loadImageElement(src) {
        return ImageService.loadImageElement(src);
    },

    async prepareUploadedImage(file) {
        return ImageService.prepareUploadedImage(file);
    },

    async optimizeImageDataUrl(rawDataUrl, options = {}) {
        return ImageService.optimizeImageDataUrl(rawDataUrl, options);
    },

    async prepareDefectPayloadForSubmit(payload) {
        if (!payload) {
            return payload;
        }

        const normalizedScreenUrl = this.normalizeScreenUrl(payload.screen_url);
        const screenUrlInput = document.querySelector('input[name="screen_url"]');
        const normalizedPayload = normalizedScreenUrl !== payload.screen_url
            ? { ...payload, screen_url: normalizedScreenUrl }
            : payload;

        if (screenUrlInput && normalizedScreenUrl !== screenUrlInput.value) {
            screenUrlInput.value = normalizedScreenUrl;
        }

        if (!normalizedPayload.screenshot || !String(normalizedPayload.screenshot).startsWith('data:image')) {
            return normalizedPayload;
        }

        const optimizedScreenshot = await this.optimizeImageDataUrl(normalizedPayload.screenshot, { maxLength: 1_500_000 });
        if (!optimizedScreenshot || optimizedScreenshot === normalizedPayload.screenshot) {
            return normalizedPayload;
        }

        const screenshotInput = document.querySelector('input[name="screenshot"]');
        this.state.transientScreenshotData = optimizedScreenshot;
        if (screenshotInput) {
            screenshotInput.value = '';
        }
        this.updateImagePreview(optimizedScreenshot);

        return {
            ...normalizedPayload,
            screenshot: optimizedScreenshot
        };
    },

    updateImagePreview(source) {
        const wrapper = document.getElementById('imagePreviewWrapper');
        const previewArea = document.getElementById('imagePreviewArea');

        if (!wrapper || !previewArea) {
            return;
        }

        if (!source) {
            wrapper.style.display = 'none';
            previewArea.innerHTML = '';
            return;
        }

        wrapper.style.display = '';
        previewArea.innerHTML = '';

        if (this.isImageSource(source)) {
            const image = document.createElement('img');
            image.src = source;
            image.style.maxWidth = '100%';
            image.style.maxHeight = '100%';
            image.style.objectFit = 'contain';
            previewArea.appendChild(image);
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.src = source;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = '#fff';
        previewArea.appendChild(iframe);
    },

    async handleImageUpload(input) {
        const file = input?.files?.[0];
        if (!file) return;

        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const screenshotInput = document.querySelector('input[name="screenshot"]');

        if (!screenshotInput) {
            alert('이미지 입력 필드를 찾지 못했습니다.');
            input.value = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드할 수 있습니다.');
            input.value = '';
            if (fileNameDisplay) {
                fileNameDisplay.textContent = '선택된 파일 없음';
            }
            return;
        }

        try {
            if (fileNameDisplay) {
                fileNameDisplay.textContent = `${file.name} 처리 중...`;
            }

            const preparedDataUrl = await this.prepareUploadedImage(file);
            this.state.transientScreenshotData = preparedDataUrl.startsWith('data:image') ? preparedDataUrl : '';
            screenshotInput.value = this.state.transientScreenshotData ? '' : preparedDataUrl;
            this.updateImagePreview(preparedDataUrl);

            if (fileNameDisplay) {
                const sizeKb = Math.round(file.size / 1024);
                fileNameDisplay.textContent = `${file.name} (${sizeKb} KB)`;
            }
        } catch (err) {
            console.error('[App] Image upload handling failed:', err);
            alert('이미지 처리 중 오류가 발생했습니다.');

            if (fileNameDisplay) {
                fileNameDisplay.textContent = '선택된 파일 없음';
            }
        } finally {
            input.value = '';
        }
    },

    async deleteDefect(id) {
        if (this.state.currentRole !== '관리자') {
            alert('삭제 권한이 없습니다. 관리자에게 문의하세요.');
            return;
        }
        if (!confirm('정말 삭제하시겠습니까? 데이터는 목록에서 보이지 않게 처리됩니다.')) return;
        if (await StorageService.defects.remove(id)) {
            alert('삭제 처리되었습니다.');
            this.fetchData();
        }
    },

    /**
     * SECURITY: Input Sanitization (XSS Prevention)
     */
    saveImage(dataUrl, filename) {
        ImageService.saveImage(dataUrl, filename);
    },

    buildDefectPayload(form, id = null) {
        const formData = new FormData(form);
        const currentUserName = this.state.currentUser?.name || null;
        const existing = id ? this.getSelectedDefect(id) || {} : {};
        const fallbackScreenPath = this.buildScreenPath(existing.menu_name || '', existing.screen_name || '');

        const value = (key, fallback = '') => {
            const raw = formData.get(key);
            if (raw === null || raw === undefined) return fallback;
            return typeof raw === 'string' ? raw.trim() : raw;
        };

        const parsedScreenPath = this.parseScreenPath(value('screen_path', fallbackScreenPath));
        const menuName = value('menu_name', parsedScreenPath.menuName || existing.menu_name || '');
        const screenName = value('screen_name', parsedScreenPath.screenName || existing.screen_name || '');
        const transientScreenshot = this.state.transientScreenshotData || '';
        const creatorValue = id
            ? value('creator', existing.creator || currentUserName || '')
            : (currentUserName || value('creator', existing.creator || ''));

        return {
            test_type: value('test_type', existing.test_type || '단위테스트'),
            title: value('title', existing.title || ''),
            severity: value('severity', existing.severity || 'Minor'),
            priority: value('priority', existing.priority || 'Medium'),
            steps_to_repro: value('steps_to_repro', existing.steps_to_repro || ''),
            creator: creatorValue,
            assignee: value('assignee', existing.assignee || ''),
            menu_name: menuName,
            screen_name: screenName,
            screen_url: this.normalizeScreenUrl(value('screen_url', existing.screen_url || '')),
            screenshot: transientScreenshot || value('screenshot', existing.screenshot || ''),
            status: value('status', existing.status || 'Open'),
            defect_identification: value('defect_identification', existing.defect_identification || ''),
            action_comment: value('action_comment', existing.action_comment || ''),
            action_due_date: value('action_due_date', existing.action_due_date || '') || null,
            action_start: value('action_start', existing.action_start || '') || null,
            action_end: value('action_end', existing.action_end || '') || null,
            env_info: value('env_info', existing.env_info || ''),
            updated_by: currentUserName
        };
    },

    calculateStats() {
        this.getFilteredDefects();
    },

    getSelectedDefect(id) {
        return (this.state.defects || []).find(d => String(d.defect_id) === String(id))
            || (this.state.allDefectsSummary || []).find(d => String(d.defect_id) === String(id))
            || null;
    },

    getEffectiveRole() {
        return this.state.currentRole || this.state.currentUser?.role || '테스터';
    },

    canEditAssignee() {
        const role = this.getEffectiveRole();
        return role === '관리자' || role === '조치자';
    },

    sanitize(str) {
        return AppUtils.sanitize(str);
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());

