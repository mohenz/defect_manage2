(function attachDefectFlowBridgeService(global) {
    const PENDING_DEFECT_KEY = 'pending_defect';
    const EVENT_TYPES = {
        READY: 'DEFECTFLOW_READY',
        DATA: 'DEFECTFLOW_DATA',
        CLOSE: 'DEFECTFLOW_CLOSE'
    };

    const bridgeService = {
        PENDING_DEFECT_KEY,
        EVENT_TYPES,

        getCenteredPopupFeatures(width, height, extraFeatures = [], currentWindow = global) {
            const screenLeft = typeof currentWindow.screenLeft === 'number' ? currentWindow.screenLeft : (currentWindow.screenX || 0);
            const screenTop = typeof currentWindow.screenTop === 'number' ? currentWindow.screenTop : (currentWindow.screenY || 0);
            const viewportWidth = currentWindow.outerWidth || document.documentElement.clientWidth || currentWindow.screen?.width || width;
            const viewportHeight = currentWindow.outerHeight || document.documentElement.clientHeight || currentWindow.screen?.height || height;
            const left = Math.max(0, Math.round(screenLeft + ((viewportWidth - width) / 2)));
            const top = Math.max(0, Math.round(screenTop + ((viewportHeight - height) / 2)));

            return [
                'popup=yes',
                `width=${width}`,
                `height=${height}`,
                `left=${left}`,
                `top=${top}`,
                'resizable=yes',
                'scrollbars=yes',
                ...extraFeatures
            ].join(',');
        },

        getMobileQuickPopupSize(currentWindow = global) {
            const availableWidth = currentWindow.screen?.availWidth || currentWindow.innerWidth || 540;
            const availableHeight = currentWindow.screen?.availHeight || currentWindow.innerHeight || 900;

            return {
                width: availableWidth >= 620 ? 540 : Math.max(360, availableWidth - 32),
                height: availableHeight >= 980 ? 920 : Math.max(640, availableHeight - 48)
            };
        },

        buildPendingDefectSeed(source = {}, dependencies = {}) {
            const buildScreenPath = dependencies.buildScreenPath || (() => '');
            const parseScreenPath = dependencies.parseScreenPath || (() => ({ menuName: '', screenName: '' }));
            const normalizeScreenUrl = dependencies.normalizeScreenUrl || ((value) => String(value || ''));
            const currentHref = dependencies.currentHref || global.location?.href || '';
            const parsedScreenPath = parseScreenPath(source.screen_path || buildScreenPath(source.menu_name, source.screen_name));

            return {
                title: source.title || '',
                menu_name: source.menu_name || parsedScreenPath.menuName || '',
                screen_name: source.screen_name || parsedScreenPath.screenName || '',
                screen_url: normalizeScreenUrl(source.screen_url || currentHref),
                screenshot: '',
                env_info: source.env_info || '',
                test_type: source.test_type || '',
                steps_to_repro: source.steps_to_repro || '',
                creator: source.creator || '',
                severity: source.severity || 'Minor',
                priority: source.priority || 'Medium',
                status: source.status || 'Open',
                defect_identification: source.defect_identification || '',
                assignee: source.assignee || ''
            };
        },

        savePendingDefect(seed, storage = global.localStorage) {
            storage.setItem(PENDING_DEFECT_KEY, JSON.stringify(seed));
            return seed;
        },

        readPendingDefect(storage = global.localStorage) {
            const raw = storage.getItem(PENDING_DEFECT_KEY);
            if (!raw) {
                return { data: null, source: '' };
            }

            try {
                return {
                    data: JSON.parse(raw),
                    source: 'localStorage'
                };
            } catch (error) {
                console.error('[DefectFlowBridgeService] Failed to parse pending_defect:', error);
                storage.removeItem(PENDING_DEFECT_KEY);
                return { data: null, source: '' };
            }
        },

        resolvePendingDefectData(options = {}) {
            if (options.messageData) {
                return {
                    data: options.messageData,
                    source: 'postMessage'
                };
            }

            return bridgeService.readPendingDefect(options.storage || global.localStorage);
        },

        clearPendingDefect(storage = global.localStorage) {
            storage.removeItem(PENDING_DEFECT_KEY);
        },

        notifyReady(currentWindow = global) {
            if (currentWindow.opener) {
                currentWindow.opener.postMessage({ type: EVENT_TYPES.READY }, '*');
            }

            if (currentWindow.parent && currentWindow.parent !== currentWindow) {
                currentWindow.parent.postMessage({ type: EVENT_TYPES.READY }, '*');
            }
        },

        notifyClose(currentWindow = global) {
            const hasOpener = !!currentWindow.opener;
            const hasParentFrame = !!currentWindow.parent && currentWindow.parent !== currentWindow;

            if (hasOpener) {
                currentWindow.opener.postMessage({ type: EVENT_TYPES.CLOSE }, '*');
            }

            if (hasParentFrame) {
                currentWindow.parent.postMessage({ type: EVENT_TYPES.CLOSE }, '*');
            }

            return {
                hasOpener,
                hasParentFrame
            };
        },

        isDataMessage(event) {
            return event?.data?.type === EVENT_TYPES.DATA;
        },

        getDataMessagePayload(event) {
            return bridgeService.isDataMessage(event) ? (event.data.data || null) : null;
        }
    };

    global.DefectFlowBridgeService = bridgeService;
})(window);
