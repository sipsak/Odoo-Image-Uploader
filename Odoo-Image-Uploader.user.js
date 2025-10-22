// ==UserScript==
// @name            Odoo Image Uploader
// @name:tr         Odoo Görsel Yükleme
// @namespace       https://github.com/sipsak
// @version         1.2
// @description     Gives Odoo the ability to upload images from the clipboard by pasting and drag-and-drop
// @description:tr  Odoo'ya görselleri panodan yapıştırarak ve sürükle-bırak yöntemi ile yükleme özellikleri kazandırır
// @author          Burak Şipşak
// @match           https://portal.bskhvac.com.tr/*
// @match           https://*.odoo.com/*
// @grant           GM_xmlhttpRequest
// @connect         *
// @icon            data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNDQuNTIxIDUuNWE0LjQ3NyA0LjQ3NyAwIDAgMSAwIDYuMzMybC0zNC4xOSAzNC4xOUg0VjM5LjY5TDM4LjE5IDUuNWE0LjQ3NyA0LjQ3NyAwIDAgMSA2LjMzMSAwWiIgZmlsbD0iIzJFQkNGQSIvPjxwYXRoIGQ9Ik0xMC45IDE1LjEyMiA0Ljg5OCA5LjEyYTkuMDA0IDkuMDA0IDAgMCAwIDEwLjQ4IDEyLjU2OGwyMy4wMDEgMjNhNC40NzcgNC40NzcgMCAwIDAgNi4zMzEtNi4zM2wtMjMtMjMuMDAxQTkuMDA0IDkuMDA0IDAgMCAwIDkuMTQxIDQuODc3bDYuMDAyIDYuMDAyLTQuMjQzIDQuMjQzWiIgZmlsbD0iIzk4NTE4NCIvPjxwYXRoIGQ9Ik0yNS4wMjMgMTguNjcgMTguNjkgMjVsNi4zMzIgNi4zMzFMMzEuMzUyIDI1bC02LjMzLTYuMzMxWiIgZmlsbD0iIzE0NDQ5NiIvPjwvc3ZnPgo=
// @updateURL       https://raw.githubusercontent.com/sipsak/Odoo-Image-Uploader/main/Odoo-Image-Uploader.user.js
// @downloadURL     https://raw.githubusercontent.com/sipsak/Odoo-Image-Uploader/main/Odoo-Image-Uploader.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Stil tanımlamalarını ekleyen fonksiyon
    const styles = `
        .o_field_image.drag-over,
        .oe_avatar.drag-over {
            outline: 2px dashed #3498db;
            background: rgba(52, 152, 219, 0.1);
        }
        .odoo-upload-message {
            color: green;
            padding: 5px;
            margin-top: 5px;
            border-radius: 3px;
            position: absolute;
            z-index: 9999;
        }
        .odoo-upload-error {
            color: red;
        }
        .img.img-fluid[name="image_1920"] {
            width: 135px !important;
            height: 135px !important;
            object-fit: contain;
        }
    `;
    function addStyles(css) {
        const styleElement = document.createElement('style');
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }
    addStyles(styles);

    function showMessage(parent, message, isError = false) {
        parent.querySelectorAll('.odoo-upload-message').forEach(msg => msg.remove());
        const msgElement = document.createElement('div');
        msgElement.className = 'odoo-upload-message' + (isError ? ' odoo-upload-error' : '');
        msgElement.textContent = message;
        parent.appendChild(msgElement);
        setTimeout(() => msgElement.remove(), 3000);
    }

    // Drag ve drop event handler'ları
    function dragHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.toggle('drag-over', e.type === 'dragover');
    }
    function dropHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        const fileInput = this.querySelector('input[type="file"]');
        handleDroppedItem(e, fileInput, this);
    }

    // Sadece salt okunur olmayan görsel elementlerine müdahale ediyoruz
    function enhanceImageUploaders() {
        const imageContainers = document.querySelectorAll('.o_field_image, .oe_avatar');
        imageContainers.forEach(container => {
            // Eğer container salt okunumuyorsa ("o_readonly_modifier" içermiyorsa) ek işlemleri yap
            if (container.classList.contains('o_readonly_modifier')) return;

            // Önce eski event listener'ları temizle
            container.removeEventListener('dragover', dragHandler);
            container.removeEventListener('dragleave', dragHandler);
            container.removeEventListener('drop', dropHandler);
            // Yeni event listener ekle
            container.addEventListener('dragover', dragHandler);
            container.addEventListener('dragleave', dragHandler);
            container.addEventListener('drop', dropHandler);

            // Panodan yapıştır butonunun eklenmesi
            if (!container.querySelector('.paste-image-button')) {
                const buttonContainer = container.querySelector('.position-absolute.d-flex');
                if (buttonContainer) {
                    const pasteButton = document.createElement('button');
                    pasteButton.className = 'paste-image-button btn btn-light border-0 rounded-circle m-1 p-1';
                    pasteButton.innerHTML = '<i class="fa fa-clipboard fa-fw"></i>';
                    pasteButton.setAttribute('data-tooltip', 'Panodan görsel yapıştır');
                    pasteButton.setAttribute('aria-label', 'Paste');
                    pasteButton.title = 'Panodan görsel yapıştır';
                    pasteButton.addEventListener('click', function () {
                        const fileInput = container.querySelector('input[type="file"]');
                        if (!navigator.clipboard || !navigator.clipboard.read) {
                            showMessage(container, 'Tarayıcı yapıştırmayı desteklemiyor!', true);
                            return;
                        }
                        navigator.clipboard.read().then(items => {
                            let foundImage = false;
                            for (const item of items) {
                                for (const type of item.types) {
                                    if (type.startsWith('image/')) {
                                        foundImage = true;
                                        item.getType(type)
                                            .then(blob => uploadImageToOdoo(blob, fileInput, container))
                                            .catch(err => {
                                                showMessage(container, 'Görsel işlenirken hata: ' + err, true);
                                                console.error('Görsel işleme hatası:', err);
                                            });
                                        break;
                                    }
                                }
                                if (foundImage) break;
                            }
                            if (!foundImage)
                                showMessage(container, 'Panoda geçerli bir görsel yok!', true);
                        }).catch(err => {
                            showMessage(container, 'Panoya erişilemedi: ' + err, true);
                            console.error('Pano erişim hatası:', err);
                        });
                    });
                    // Butonu container içerisindeki uygun pozisyona ekle
                    buttonContainer.insertBefore(pasteButton, buttonContainer.children[1]);
                }
            }
        });
    }

    function handleDroppedItem(e, fileInput, messageContainer) {
        if (!fileInput) {
            console.error('Dosya input bulunamadı.');
            return;
        }
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
            const file = dt.files[0];
            if (file.type.startsWith('image/')) uploadImageToOdoo(file, fileInput, messageContainer);
            else showMessage(messageContainer, 'Lütfen sadece görsel dosyaları sürükleyin!', true);
            return;
        }
        const htmlData = dt.getData('text/html');
        if (htmlData) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlData;
            const img = tempDiv.querySelector('img');
            if (img && img.src) {
                fetchAndUploadImage(img.src, fileInput, messageContainer);
                return;
            }
        }
        const textData = dt.getData('text/plain');
        if (textData) {
            if (textData.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)/i))
                fetchAndUploadImage(textData, fileInput, messageContainer);
            else
                showMessage(messageContainer, 'Geçerli bir görsel URL\'si değil!', true);
        }
    }

    function fetchAndUploadImage(url, fileInput, messageContainer) {
        showMessage(messageContainer, 'Görsel indiriliyor...', false);
        const processBlob = blob => {
            if (!blob.type.startsWith('image/')) {
                showMessage(messageContainer, 'Geçersiz görsel dosyası!', true);
                return;
            }
            uploadImageToOdoo(blob, fileInput, messageContainer);
        };
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        const arrayBufferView = new Uint8Array(response.response);
                        let mimeType = 'image/jpeg';
                        if (url.endsWith('.png')) mimeType = 'image/png';
                        else if (url.endsWith('.gif')) mimeType = 'image/gif';
                        else if (url.endsWith('.webp')) mimeType = 'image/webp';
                        else if (url.endsWith('.svg')) mimeType = 'image/svg+xml';
                        const blob = new Blob([arrayBufferView], { type: mimeType });
                        processBlob(blob);
                    } else {
                        showMessage(messageContainer, `Görsel indirilemedi: HTTP ${response.status}`, true);
                    }
                },
                onerror: function(error) {
                    showMessage(messageContainer, 'Görsel indirilemedi: Bağlantı hatası', true);
                    console.error('Görsel indirme hatası:', error);
                }
            });
        } else {
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP hata! Durum: ${response.status}`);
                    return response.blob();
                })
                .then(processBlob)
                .catch(error => {
                    showMessage(messageContainer, `Görsel indirilemedi: ${error.message}`, true);
                    console.error('Görsel indirme hatası:', error);
                });
        }
    }

    function uploadImageToOdoo(blob, fileInput, messageContainer) {
        if (!blob.type.startsWith('image/')) {
            showMessage(messageContainer, 'Geçersiz görsel dosyası tipi: ' + blob.type, true);
            return;
        }
        console.log("Yükleniyor: ", blob.type, blob.size);
        const extension = blob.type.split('/')[1] || 'jpg';
        const fileName = `image.${extension}`;
        const file = new File([blob], fileName, { type: blob.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        showMessage(messageContainer, 'Yüklendi!', false);
    }

    function cleanupOldEnhancers() {
        document.querySelectorAll('.o_field_image, .oe_avatar')
            .forEach(container => {
                container.removeEventListener('dragover', dragHandler);
                container.removeEventListener('dragleave', dragHandler);
                container.removeEventListener('drop', dropHandler);
            });
    }

    function listenToNavigationButtons() {
        document.body.addEventListener('click', e => {
            const selectors = [
                '.o_pager_next',
                '.o_pager_previous',
                '.o_form_button_next',
                '.o_form_button_previous',
                '.o_pager_value',
                '.o_pager',
                '.oe_button_box .oe_stat_button'
            ];
            if (selectors.some(selector => e.target.matches(selector) || e.target.closest(selector))) {
                cleanupOldEnhancers();
                setTimeout(enhanceImageUploaders, 300);
            }
        }, true);
    }

    function main() {
        setTimeout(enhanceImageUploaders, 1000);
        listenToNavigationButtons();

        let throttleTimer;
        const observer = new MutationObserver(mutations => {
            const shouldEnhance = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.matches('.o_field_image, .oe_avatar') || node.querySelector('.o_field_image, .oe_avatar'))
                )
            );
            if (shouldEnhance) {
                clearTimeout(throttleTimer);
                throttleTimer = setTimeout(() => {
                    cleanupOldEnhancers();
                    enhanceImageUploaders();
                }, 300);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('hashchange', () => {
            cleanupOldEnhancers();
            setTimeout(enhanceImageUploaders, 300);
        });
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', main);
    else
        main();
})();
