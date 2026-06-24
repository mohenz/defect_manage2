(function attachDefectFlowImageService(global) {
    const imageService = {
        isImageSource(url) {
            return !!url && (String(url).startsWith('data:image') || String(url).match(/\.(jpeg|jpg|gif|png|webp|svg)/i));
        },

        readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('파일을 읽는 중 오류가 발생했습니다.'));
                reader.readAsDataURL(file);
            });
        },

        loadImageElement(src) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
                image.src = src;
            });
        },

        async prepareUploadedImage(file) {
            const rawDataUrl = await imageService.readFileAsDataUrl(file);

            if (!file.type.startsWith('image/')) {
                throw new Error('이미지 파일만 업로드할 수 있습니다.');
            }

            return imageService.optimizeImageDataUrl(rawDataUrl, { sourceSize: file.size });
        },

        async optimizeImageDataUrl(rawDataUrl, options = {}) {
            if (!rawDataUrl || !String(rawDataUrl).startsWith('data:image')) {
                return rawDataUrl || '';
            }

            const image = await imageService.loadImageElement(rawDataUrl);
            const maxDimension = options.maxDimension || 2400;
            const maxLength = options.maxLength || 1_500_000;
            const needsResize = Math.max(image.width, image.height) > maxDimension;
            const needsCompression = Number(options.sourceSize || 0) > 2 * 1024 * 1024 || rawDataUrl.length > maxLength;

            if (!needsResize && !needsCompression) {
                return rawDataUrl;
            }

            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * scale));
            const height = Math.max(1, Math.round(image.height * scale));
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                return rawDataUrl;
            }

            const candidates = [
                { mime: 'image/webp', quality: 0.92 },
                { mime: 'image/jpeg', quality: 0.92 },
                { mime: 'image/jpeg', quality: 0.86 }
            ];
            let bestDataUrl = rawDataUrl;
            let workingCanvas = canvas;

            const drawToCanvas = (targetCanvas, source, nextWidth, nextHeight) => {
                const targetContext = targetCanvas.getContext('2d');
                if (!targetContext) {
                    return false;
                }

                targetCanvas.width = nextWidth;
                targetCanvas.height = nextHeight;
                targetContext.fillStyle = '#ffffff';
                targetContext.fillRect(0, 0, nextWidth, nextHeight);
                targetContext.drawImage(source, 0, 0, nextWidth, nextHeight);
                return true;
            };

            if (!drawToCanvas(workingCanvas, image, width, height)) {
                return rawDataUrl;
            }

            for (let attempt = 0; attempt < 4; attempt += 1) {
                for (const candidate of candidates) {
                    const dataUrl = workingCanvas.toDataURL(candidate.mime, candidate.quality);
                    if (!dataUrl || dataUrl === 'data:,') {
                        continue;
                    }

                    if (dataUrl.length < bestDataUrl.length) {
                        bestDataUrl = dataUrl;
                    }

                    if (dataUrl.length <= maxLength) {
                        return dataUrl;
                    }
                }

                const nextWidth = Math.max(320, Math.round(workingCanvas.width * 0.82));
                const nextHeight = Math.max(240, Math.round(workingCanvas.height * 0.82));
                if (nextWidth === workingCanvas.width && nextHeight === workingCanvas.height) {
                    break;
                }

                const nextCanvas = document.createElement('canvas');
                if (!drawToCanvas(nextCanvas, workingCanvas, nextWidth, nextHeight)) {
                    break;
                }
                workingCanvas = nextCanvas;
            }

            return bestDataUrl;
        },

        saveImage(dataUrl, filename) {
            if (!dataUrl || !dataUrl.startsWith('data:')) return;

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename || `defect_screenshot_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    global.DefectFlowImageService = imageService;
})(window);
