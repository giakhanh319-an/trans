// app.js

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const btnSettings = document.getElementById('btnSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    const inputApiKey = document.getElementById('apiKey');
    const btnSaveKey = document.getElementById('btnSaveKey');
    const sourceText = document.getElementById('sourceText');
    const targetText = document.getElementById('targetText');
    const btnTranslate = document.getElementById('btnTranslate');
    const btnClear = document.getElementById('btnClear');
    const btnUpload = document.getElementById('btnUpload');
    const fileInput = document.getElementById('fileInput');
    const btnDownload = document.getElementById('btnDownload');
    const btnCopy = document.getElementById('btnCopy');
    const inputContext = document.getElementById('context');
    const inputTargetLang = document.getElementById('targetLang');
    const targetLangLabel = document.getElementById('targetLangLabel');
    const radioModes = document.getElementsByName('translationMode');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const modeIndicator = document.getElementById('modeIndicator');
    const toast = document.getElementById('toast');

    // Constants
    const API_KEY_STORAGE = 'protrans_gemini_api_key';

    // Load initial settings
    const savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
        inputApiKey.value = savedKey;
    } else {
        // Show settings if no key
        settingsPanel.classList.remove('hidden');
    }

    // Event Listeners
    btnSettings.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    btnSaveKey.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        if (key) {
            localStorage.setItem(API_KEY_STORAGE, key);
            showToast('Đã lưu API Key!', 'success');
            setTimeout(() => settingsPanel.classList.add('hidden'), 1000);
        } else {
            showToast('API Key không được để trống.', 'error');
        }
    });

    btnClear.addEventListener('click', () => {
        sourceText.value = '';
        targetText.innerHTML = '';
        sourceText.focus();
    });

    btnCopy.addEventListener('click', () => {
        const textToCopy = targetText.innerText;
        if (!textToCopy) return;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Đã sao chép vào bộ nhớ tạm!');
        }).catch(() => {
            showToast('Lỗi khi sao chép.', 'error');
        });
    });

    // File Upload Handler
    btnUpload.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            sourceText.value = event.target.result;
            showToast('Đã tải tài liệu lên thành công!');
        };
        reader.onerror = () => {
            showToast('Lỗi đọc tài liệu.', 'error');
        };
        reader.readAsText(file);
        
        // Reset
        fileInput.value = '';
    });

    // File Download Handler
    btnDownload.addEventListener('click', () => {
        const textToSave = targetText.innerText;
        if (!textToSave) {
            showToast('Không có kết quả để tải xuống.', 'error');
            return;
        }

        const blob = new Blob([textToSave], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Ban-Dich-ProTrans.txt`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
        
        showToast('Đã tải tài liệu kết quả!');
    });

    // Update indicator when mode changes
    radioModes.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if(e.target.value === 'monolingual') {
                modeIndicator.innerText = '(Đơn ngữ)';
            } else {
                modeIndicator.innerText = '(Song ngữ)';
            }
        });
    });

    inputTargetLang.addEventListener('change', (e) => {
        targetLangLabel.innerText = e.target.value;
    });

    // Main Translation Logic
    btnTranslate.addEventListener('click', async () => {
        const text = sourceText.value.trim();
        const apiKey = localStorage.getItem(API_KEY_STORAGE);
        const context = inputContext.value.trim() || "Chung";
        const targetLanguage = inputTargetLang.value;
        
        // Get selected mode
        let selectedMode = 'monolingual';
        for(const radio of radioModes) {
            if(radio.checked) {
                selectedMode = radio.value;
                break;
            }
        }

        if (!apiKey) {
            showToast('Vui lòng nhập và lưu API Key trước.', 'error');
            settingsPanel.classList.remove('hidden');
            inputApiKey.focus();
            return;
        }

        if (!text) {
            showToast('Vui lòng nhập văn bản cần dịch.', 'error');
            sourceText.focus();
            return;
        }

        loadingOverlay.classList.add('active');
        btnTranslate.disabled = true;
        
        try {
            const result = await translateText(text, context, selectedMode, apiKey, targetLanguage);
            renderOutput(result, selectedMode);
        } catch (error) {
            showToast('Lỗi dịch thuật: ' + error.message, 'error');
            targetText.innerHTML = `<div style="color: var(--danger); padding: 1rem;">Lỗi kết nối hoặc API Key không hợp lệ. Vui lòng kiểm tra lại. Chi tiết: ${error.message}</div>`;
        } finally {
            loadingOverlay.classList.remove('active');
            btnTranslate.disabled = false;
        }
    });

    async function translateText(text, context, mode, apiKey, targetLanguage) {
        // API Endpoint for Gemini 1.5 Flash (fast and high quality)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        let systemInstruction = `Bạn là một chuyên gia dịch thuật cao cấp từ Tiếng Việt sang ${targetLanguage}. 
Nhiệm vụ của bạn là dịch chính xác theo ngữ cảnh/chuyên ngành: [${context}]. 
Hãy sử dụng đúng từ vựng chuyên ngành, ngữ khí tự nhiên và chuẩn xác về mặt kỹ thuật/chữ nghĩa.`;

        let prompt = "";
        let isJson = false;

        if (mode === 'monolingual') {
            prompt = `Dịch văn bản sau sang ${targetLanguage} dựa trên chuyên ngành [${context}]. Chỉ trả về duy nhất văn bản ${targetLanguage} được dịch, không thêm bất kỳ bình luận nào khác.\n\nVăn bản gốc:\n${text}`;
        } else {
            isJson = true;
            prompt = `Dịch văn bản sau sang ${targetLanguage} dựa trên chuyên ngành [${context}].
Phân tích văn bản gốc thành các đoạn văn.
Bạn PHẢI trả về ĐÚNG định dạng JSON là một mảng các object. Mỗi object có 2 trường: "source" (đoạn tiếng Việt gốc) và "target" (đoạn ${targetLanguage} đã dịch).
Ví dụ:
[
  { "source": "Đoạn 1 tiếng việt", "target": "Đoạn 1 đã dịch" },
  { "source": "Đoạn 2 tiếng việt", "target": "Đoạn 2 đã dịch" }
]

Văn bản gốc cần dịch:\n${text}`;
        }

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: 0.2, // Low temp for accurate translation
            }
        };

        if (isJson) {
            payload.generationConfig.responseMimeType = "application/json";
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.json();
            throw new Error(errBody.error?.message || "HTTP Error");
        }

        const data = await response.json();
        const candidateRaw = data.candidates[0]?.content?.parts[0]?.text || "";
        
        if (mode === 'monolingual') {
            return {
                mode: 'monolingual',
                text: candidateRaw.trim()
            };
        } else {
            return {
                mode: 'bilingual',
                data: JSON.parse(candidateRaw)
            };
        }
    }

    function renderOutput(result, mode) {
        targetText.innerHTML = ''; // clear 

        if (mode === 'monolingual') {
            // Simply place text (handling newlines)
            const p = document.createElement('div');
            // encode html entities to prevent XSS, but preserve newlines
            p.innerHTML = escapeHtml(result.text).replace(/\n/g, '<br>');
            targetText.appendChild(p);
        } else {
            // Render Bilingual pairs
            result.data.forEach(item => {
                const wrapper = document.createElement('div');
                wrapper.className = 'bilingual-pair';
                
                const viDiv = document.createElement('div');
                viDiv.className = 'bilingual-vi';
                viDiv.innerHTML = escapeHtml(item.source).replace(/\n/g, '<br>');

                const zhDiv = document.createElement('div');
                zhDiv.className = 'bilingual-zh';
                zhDiv.innerHTML = escapeHtml(item.target).replace(/\n/g, '<br>');

                wrapper.appendChild(viDiv);
                wrapper.appendChild(zhDiv);
                targetText.appendChild(wrapper);
            });
        }
    }

    // Utilities
    function showToast(message, type = 'success') {
        toast.innerText = message;
        if (type === 'error') {
            toast.style.background = 'var(--danger)';
        } else {
            toast.style.background = 'var(--success)';
        }
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
