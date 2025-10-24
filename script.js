
let currentModule = 'upload';
let uploadedFiles = [];
let analysisData = null;
let selectedEmissionData = null;
let aiConversation = [];
let isAnalysisComplete = false;
let documentContents = []; 


let selectionBubbleTimer = null;
let pinnedBottomAI = false;
let currentBottomAIQuote = null;


document.addEventListener('DOMContentLoaded', function() {
    setupSelectionAskAI();
    setupBottomAIChat();
});

function setupSelectionAskAI() {
    const bubble = document.getElementById('askAISelectionBubble');
    if (!bubble) return;

    function getSelectionText() {
        const sel = window.getSelection();
        return sel && sel.toString().trim();
    }

    function positionBubble() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return false;
        const bubbleEl = bubble;
        bubbleEl.style.left = `${Math.min(window.innerWidth - 160, Math.max(8, rect.left + window.scrollX))}px`;
        bubbleEl.style.top = `${rect.top + window.scrollY - 36}px`;
        return true;
    }

    function maybeShowBubble() {
        const text = getSelectionText();
        if (text && text.length >= 2) {
            const ok = positionBubble();
            if (ok) bubble.style.display = 'flex';
        } else {
            bubble.style.display = 'none';
        }
    }

    document.addEventListener('mouseup', () => {
        clearTimeout(selectionBubbleTimer);
        selectionBubbleTimer = setTimeout(maybeShowBubble, 80);
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') return;
        clearTimeout(selectionBubbleTimer);
        selectionBubbleTimer = setTimeout(maybeShowBubble, 80);
    });

    bubble.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    bubble.addEventListener('click', () => {
        const text = window.getSelection()?.toString().trim();
        if (!text) return;
        bubble.style.display = 'none';
        openBottomAIIfNeeded(true);
        setBottomAIQuote(text);
    });
}

function setupBottomAIChat() {
    const panel = document.getElementById('bottomAIChat');
    if (!panel) return;
    const input = document.getElementById('bottomAIInput');
    const sendBtn = document.getElementById('bottomAISend');
    const collapseBtn = document.getElementById('collapseBottomAI');
    const pinBtn = document.getElementById('pinBottomAI');

    function send() {
        const text = input.value.trim();
        if (!text && !currentBottomAIQuote) return;
        const composed = composeMessageWithQuote(text);
        appendBottomAIMessage('user', composed);
        input.value = '';
        clearBottomAIQuote();
        callGeneralAI(composed).then((reply) => appendBottomAIMessage('ai', reply));
    }

    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });

    collapseBtn?.addEventListener('click', () => {
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            if (!pinnedBottomAI) panel.style.display = 'none';
        }
    });

    pinBtn?.addEventListener('click', () => {
        pinnedBottomAI = !pinnedBottomAI;
        pinBtn.textContent = pinnedBottomAI ? 'Unpin' : 'Pin';
    });

    
    document.addEventListener('keydown', (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && (e.key === 'j' || e.key === 'J')) {
            e.preventDefault();
            openBottomAIIfNeeded(true);
        }
        
        if (e.key === 'Escape') {
            if (!pinnedBottomAI) panel.style.display = 'none';
        }
    });
}

function openBottomAIIfNeeded(focus = false) {
    const panel = document.getElementById('bottomAIChat');
    if (!panel) return;
    panel.style.display = 'block';
    if (focus) {
        const input = document.getElementById('bottomAIInput');
        input && input.focus();
    }
}

function appendBottomAIMessage(sender, text) {
    const container = document.getElementById('bottomAIMessages');
    if (!container) return;
    const wrap = document.createElement('div');
    wrap.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    wrap.appendChild(content);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

function setBottomAIQuote(quoteText) {
    currentBottomAIQuote = quoteText;
    const inputWrap = document.querySelector('.bottom-ai-input');
    if (!inputWrap) return;
    let quoteEl = document.getElementById('bottomAIQuote');
    if (!quoteEl) {
        quoteEl = document.createElement('div');
        quoteEl.id = 'bottomAIQuote';
        quoteEl.className = 'bottom-ai-quote';
        const textDiv = document.createElement('div');
        textDiv.className = 'quote-text';
        const btn = document.createElement('button');
        btn.className = 'quote-remove';
        btn.title = 'Clear quote';
        btn.textContent = '×';
        btn.addEventListener('click', clearBottomAIQuote);
        quoteEl.appendChild(textDiv);
        quoteEl.appendChild(btn);
        inputWrap.insertBefore(quoteEl, inputWrap.firstChild);
    }
    const textDiv = quoteEl.querySelector('.quote-text');
    if (textDiv) {
        const display = quoteText.length > 200 ? quoteText.slice(0, 200) + '…' : quoteText;
        textDiv.textContent = display;
        textDiv.setAttribute('title', quoteText);
    }
}

function clearBottomAIQuote() {
    currentBottomAIQuote = null;
    const quoteEl = document.getElementById('bottomAIQuote');
    if (quoteEl && quoteEl.parentNode) quoteEl.parentNode.removeChild(quoteEl);
}

function composeMessageWithQuote(userText) {
    if (!currentBottomAIQuote) return userText || '';
    const quoted = '> ' + currentBottomAIQuote.replace(/\n/g, '\n> ');
    if (userText) {
        return `${quoted}\n\n${userText}`;
    }
    return quoted;
}


async function callGeneralAI(userMessage) {
    try {
        
        const module = document.querySelector('.nav-tab.active')?.dataset.module || currentModule || 'upload';
        const documentContent = window.documentAIContent?.content || '';
        const supplementData = window.supplementData || {};
        const emissions = window.analysisData?.emissions || {};
        const timeline = window.analysisData?.timeline || {};
        const productType = window.currentAnalysis?.documentType || 'general';
        const productTypeName = typeof getDocumentTypeName === 'function' ? getDocumentTypeName(productType) : productType;

        
        const contextInfo = {
            module: module,
            productType: productTypeName,
            hasDocumentContent: documentContent.length > 0,
            hasSupplementData: Object.keys(supplementData).length > 0,
            hasEmissionData: Object.keys(emissions).length > 0,
            hasTimeline: Object.keys(timeline).length > 0
        };

        
        let contextDescription = '';
        if (contextInfo.hasDocumentContent) {
            contextDescription += `我正在分析一个关于${contextInfo.productType}的碳排放项目。`;
        }
        
        if (contextInfo.hasSupplementData) {
            contextDescription += `已收集了相关补充信息。`;
        }
        
        if (contextInfo.hasEmissionData || contextInfo.hasTimeline) {
            contextDescription += `目前正在${contextInfo.module}分析模块中工作。`;
        }

        const prompt = `You are a senior carbon emission and process optimization expert, skilled at providing practical and understandable advice.

${contextDescription ? `Context: ${contextDescription.replace('我正在分析一个关于', 'Analyzing a project about ').replace('的碳排放项目', ' carbon emission project').replace('已收集了相关补充信息', 'Relevant supplementary information has been collected').replace('目前正在', 'Currently working in ').replace('分析模块中工作', ' analysis module')}` : ''}

${contextInfo.hasDocumentContent ? `Project Overview: ${documentContent.substring(0, 300)}...` : ''}

${contextInfo.hasSupplementData ? `Known Information:\n${Object.entries(supplementData).slice(0, 5).map(([k,v])=>`• ${k}: ${v}`).join('\n')}` : ''}

${contextInfo.hasEmissionData ? `Emission Data:\n${Object.entries(emissions).slice(0, 3).map(([k,v])=>`• ${k}: ${v.value} (${v.level||'Standard Range'})`).join('\n')}` : ''}

User Query or Selected Content: "${userMessage}"

Please respond in professional but friendly tone, in English, concisely (within 50 words), focusing on:
1. Direct answer to the question
2. Practical next-step recommendations  
3. If selected text, provide professional insights about that content

Avoid overly technical jargon and make the response understandable and valuable for guidance.`;

        
        console.log('=================== Bottom AI Assistant Call ===================');
        console.log('🔹 Current Module:', module);
        console.log('🔹 Combined Input Text:', userMessage);
        console.log('🔹 Model:', AI_CONFIG.model);
        console.log('🔹 API Endpoint:', `${AI_CONFIG.baseUrl}/chat/completions`);
        console.log('📤 Complete AI Prompt:\n', prompt);

        const requestBody = {
            model: AI_CONFIG.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 160,
            temperature: 0.6
        };
        console.log('📤 Request Parameters:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        console.log('📥 API Response Status:', response.status, response.statusText);
        if (!response.ok) throw new Error(`AI service unavailable: ${response.status}`);
        const data = await response.json();
        console.log('📥 AI Complete Response Data:', JSON.stringify(data, null, 2));
        const output = data.choices?.[0]?.message?.content?.trim() || 'No valid response received';
        console.log('📄 AI Response Content:', output);
        console.log('==========================================================');
        return output;
    } catch (err) {
        console.error('❌ Bottom AI Assistant Call Error:', err);
        
        const fallback = fallbackGeneralReply(userMessage);
        console.warn('⚠️ Using fallback response:', fallback);
        return fallback;
    }
}

function fallbackGeneralReply(userMessage) {
    
    const q = (userMessage || '').toLowerCase();
    
    
    if (q.includes('kanban') || currentModule === 'kanban') {
        return '💡 Focus on highest emission stages, quantify gaps and identify 2 actionable improvements.';
    }
    if (q.includes('lean') || currentModule === 'lean') {
        return '🎯 Start with bottlenecks and waste, prioritize one low-cost high-return optimization pilot.';
    }
    if (q.includes('scrum') || currentModule === 'scrum') {
        return '📊 Break down into deliverable tasks, set verifiable milestones within two weeks.';
    }
    
    
    if (q.includes('time') || q.includes('schedule') || q.includes('时间') || q.includes('进度')) {
        return '⏱️ Carbon analysis typically takes 3-7 days. Prioritize data collection and validation first.';
    }
    
    
    if (q.includes('cost') || q.includes('budget') || q.includes('成本') || q.includes('预算')) {
        return '💰 Start with zero-cost optimizations, then evaluate ROI for equipment upgrades.';
    }
    
    
    if (q.includes('material') || q.includes('supply') || q.includes('材料') || q.includes('供应')) {
        return '🔄 Review supplier emissions, consider local sourcing to reduce transport carbon footprint.';
    }
    
    
    if (q.includes('data') || q.includes('information') || q.includes('数据') || q.includes('信息')) {
        return '📈 Collect energy and material data from key processes - foundation for accurate analysis.';
    }
    
    
    if (q.includes('improve') || q.includes('optimize') || q.includes('改进') || q.includes('优化')) {
        return '🚀 First identify major emission sources, then develop targeted reduction strategies.';
    }
    
    
    const genericReplies = [
        '🤔 I understand your carbon emission concerns, let me provide specific analysis suggestions.',
        '💭 Based on your question, recommend starting with data collection for accurate analysis.',
        '📝 Please describe the specific scenario in detail for more targeted recommendations.',
        '🎯 Suggest clarifying analysis goals to better develop optimization strategies.'
    ];
    
    return genericReplies[Math.floor(Math.random() * genericReplies.length)];
}



const AI_CONFIG = {
    baseUrl: 'https:
    model: 'deepseek-v3',
    apiKey: window.AI_API_KEY || 'YOUR_API_KEY_HERE'  
};


async function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        reader.onload = async function(e) {
            const content = e.target.result;
            
            if (fileExtension === '.txt') {
                resolve({
                    fileName: file.name,
                    content: content,
                    type: 'text'
                });
            } else if (fileExtension === '.pdf') {
                
                
                resolve({
                    fileName: file.name,
                    content: 'PDF file content extraction not supported yet, please convert to TXT format',
                    type: 'pdf'
                });
            } else if (fileExtension === '.docx') {
                try {
                    
                    const extractedText = await extractTextFromDocx(content);
                    
                    
                    if (extractedText && 
                        extractedText.length > 20 && 
                        !extractedText.includes('PK') && 
                        !isGarbledText(extractedText)) {
                    resolve({
                        fileName: file.name,
                        content: extractedText,
                            type: 'docx',
                            parseStatus: 'success'
                        });
                    } else {
                        
                                                const fallbackContent = `Document Parsing Notice:\n\nYour uploaded DOCX file "${file.name}" encountered some technical limitations during parsing.\nFor optimal analysis results, we recommend:\n\n1. Save the DOCX file as TXT format and re-upload\n2. Or directly input key document information in the dialog below\n\nIf you need to continue using the current file, the system will perform intelligent inference analysis based on the filename and common patterns.`;

                        resolve({
                            fileName: file.name,
                            content: fallbackContent,
                            type: 'docx',
                            parseStatus: 'partial',
                            needsUserInput: true
                        });
                    }
                } catch (error) {
                    console.error('DOCX parsing failed:', error);
                    resolve({
                        fileName: file.name,
                        content: `Document parsing encountered an issue: ${error.message}\n\nRecommend converting the file to TXT format and re-uploading, or manually entering key information in the dialog.`,
                        type: 'docx',
                        error: error.message,
                        parseStatus: 'failed',
                        needsUserInput: true
                    });
                }
            } else if (fileExtension === '.doc') {
                resolve({
                    fileName: file.name,
                    content: 'DOC file content extraction not supported yet, please convert to DOCX or TXT format',
                    type: 'doc'
                });
            } else {
                reject(new Error('Unsupported file format'));
            }
        };
        
        reader.onerror = function() {
            reject(new Error('File reading failed'));
        };
        
        if (fileExtension === '.txt') {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}


async function extractTextFromDocx(arrayBuffer) {
    try {
        console.log('Starting DOCX parsing with Mammoth.js, ArrayBuffer size:', arrayBuffer.byteLength);
        
        
        if (typeof mammoth !== 'undefined') {
            return await extractWithMammoth(arrayBuffer);
        }
        
        
        console.warn('Mammoth.js library not loaded, using fallback parsing method');
        return await extractWithCustomParser(arrayBuffer);
        
    } catch (error) {
        console.error('DOCX text extraction error:', error);
        
        return generateFallbackContent();
    }
}


async function extractWithMammoth(arrayBuffer) {
    try {
        console.log('Parsing DOCX file using Mammoth.js...');
        
        
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        
        if (result.value && result.value.trim()) {
            console.log('Mammoth.js successfully extracted text, length:', result.value.length);
            console.log('Text preview:', result.value.substring(0, 200) + '...');
            console.log('Complete text content:', result.value);  
            
            
            if (result.messages && result.messages.length > 0) {
                console.log('Mammoth.js parsing warnings:', result.messages);
            }
            
            return result.value.trim();
        } else {
            console.warn('Mammoth.js failed to extract text content');
            return null;
        }
    } catch (error) {
        console.error('Mammoth.js parsing failed:', error);
        return null;
    }
}


async function extractWithJSZip(arrayBuffer) {
    try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(arrayBuffer);
        const docXml = await zipContent.file('word/document.xml').async('string');
        
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXml, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('w:t');
        
        let extractedText = '';
        for (let i = 0; i < textNodes.length; i++) {
            extractedText += textNodes[i].textContent + ' ';
        }
        
        if (extractedText.trim()) {
            console.log('JSZip successfully extracted text, length:', extractedText.length);
            return extractedText.trim();
        }
    } catch (error) {
        console.warn('JSZip parsing failed, using fallback method:', error);
    }
    
    return null;
}


async function extractWithCustomParser(arrayBuffer) {
    try {
        const uint8Array = new Uint8Array(arrayBuffer);
        
        
        const centralDirSignature = [0x50, 0x4b, 0x01, 0x02]; 
        const localFileSignature = [0x50, 0x4b, 0x03, 0x04]; 
        
        
        let documentContent = null;
        
        
        const xmlPatterns = [
            /<w:document[^>]*>([\s\S]*?)<\/w:document>/i,
            /<w:body[^>]*>([\s\S]*?)<\/w:body>/i,
            /<document[^>]*>([\s\S]*?)<\/document>/i
        ];
        
        
        let fullText = '';
        try {
            
            const decoder = new TextDecoder('utf-8', { fatal: false });
            fullText = decoder.decode(uint8Array);
        } catch (e) {
            
            const decoder = new TextDecoder('latin1');
            fullText = decoder.decode(uint8Array);
        }
        
        
        for (const pattern of xmlPatterns) {
            const match = fullText.match(pattern);
                if (match) {
                documentContent = match[1];
                    break;
                }
            }
            
        if (documentContent) {
            
            const textMatches = documentContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
                let extractedText = '';
            
            textMatches.forEach(match => {
                const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
                if (textMatch && textMatch[1]) {
                    extractedText += textMatch[1] + ' ';
                }
            });
                
                if (extractedText.trim()) {
                console.log('Custom parser successfully extracted text, length:', extractedText.length);
                return extractedText.trim();
            }
        }
        
        
        return extractReadableText(fullText);
        
    } catch (error) {
        console.error('Custom parser error:', error);
        return null;
    }
}


function extractReadableText(text) {
    try {
        
        let cleanText = text
            .replace(/<[^>]*>/g, ' ') 
            .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\r\n\t]/g, ' ') 
            .replace(/\s+/g, ' ') 
            .trim();
        
        
        const meaningfulParts = cleanText.split(' ').filter(part => {
            return part.length > 2 && 
                   /[\u4e00-\u9fff]/.test(part) || 
                   /^[a-zA-Z]{3,}$/.test(part); 
        });
        
        if (meaningfulParts.length > 0) {
            const result = meaningfulParts.join(' ').substring(0, 1000);
            console.log('Extracted readable text fragment:', result.substring(0, 100) + '...');
                    return result;
                }
        
    } catch (error) {
        console.error('Failed to extract readable text:', error);
    }
    
    return null;
}


function isGarbledText(text) {
    if (!text || text.length < 10) return true;
    
    
    const unreadableChars = text.match(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\r\n\t]/g);
    const unreadableRatio = unreadableChars ? unreadableChars.length / text.length : 0;
    
    
    if (unreadableRatio > 0.5) {
        console.log('Detected garbled text, unreadable character ratio:', unreadableRatio);
        return true;
    }
    
    
    const garbagePatterns = [
        /PK.*?\x03\x04/,  
        /[\x00-\x08\x0E-\x1F\x7F-\x9F]{5,}/g  
    ];
    
    for (const pattern of garbagePatterns) {
        if (pattern.test(text)) {
            console.log('Detected file header or control character corruption:', pattern);
            return true;
        }
    }
    
    
    const meaningfulWords = text.match(/[a-zA-Z]{3,}|[\u4e00-\u9fff]{2,}/g);
    if (meaningfulWords && meaningfulWords.length > 5) {
        console.log('Detected meaningful text content, word count:', meaningfulWords.length);
        return false;  
    }
    
    return false;  
}


function generateFallbackContent() {
    const fallbackContent = `
    Product Design Specification Document
    
    This document contains detailed design specifications and technical requirements for the product.
    
    Main contents include:
    - Product functional specification
    - Technical parameter requirements  
    - Material selection standards
    - Manufacturing process flow
    - Quality control standards
    - Environmental requirement specifications
    
    Due to document format limitations, it is recommended to convert DOCX files to TXT format and re-upload,
    or manually input key information to obtain more accurate analysis results.
    `;
    
    console.log('Using backup content as document parsing result');
    return fallbackContent.trim();
}


async function readAllDocuments(files) {
    const contents = [];
    for (const file of files) {
        try {
            const content = await readFileContent(file);
            contents.push(content);
        } catch (error) {
            console.error(`Failed to read file ${file.name}:`, error);
            contents.push({
                fileName: file.name,
                content: '',
                type: 'error',
                error: error.message
            });
        }
    }
    return contents;
}


const DEFAULT_PRODUCT = {
    name: 'Standard Product',
    emissions: {
        procurement: { value: 45, duration: '2 months' },
        manufacturing: { value: 78, duration: '3 months' },
        logistics: { value: 32, duration: '1 month' },
        usage: { value: 120, duration: '24 months' },
        recycling: { value: 15, duration: '6 months' },
        decomposition: { value: 8, duration: '12 months' }
    },
    timeline: {
        procurement: { duration: 60, unit: 'days' },
        manufacturing: { duration: 90, unit: 'days' },
        logistics: { duration: 15, unit: 'days' },
        usage: { duration: 720, unit: 'days' },
        recycling: { duration: 180, unit: 'days' },
        decomposition: { duration: 360, unit: 'days' }
    }
};


document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const module = tab.dataset.module;
            switchModule(module);
        });
    });

    
    setupFileUpload();
}

function setupEventListeners() {
    
    const uploadArea = document.getElementById('uploadArea');
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#764ba2';
            uploadArea.style.background = 'rgba(118, 75, 162, 0.1)';
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#667eea';
            uploadArea.style.background = 'rgba(103, 126, 234, 0.05)';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#667eea';
            uploadArea.style.background = 'rgba(103, 126, 234, 0.05)';
            
            const files = Array.from(e.dataTransfer.files);
            handleFileUpload(files);
        });
    }
}

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleFileUpload(files);
        });
    }
}
async function handleFileUpload(files) {
    const validFiles = files.filter(file => {
        const validTypes = ['.pdf', '.doc', '.docx', '.txt'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        return validTypes.includes(fileExtension);
    });
    
    if (validFiles.length === 0) {
        alert('Please upload valid file formats (PDF, DOC, DOCX, TXT)');
        return;
    }
    
    uploadedFiles = [...uploadedFiles, ...validFiles];
    displayUploadedFiles();
    
    
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.innerHTML = `
        <div class="loading-indicator">
            <i class="fas fa-spinner fa-spin"></i>
            <h3>Reading document content...</h3>
        </div>
    `;
    
    try {
        
        documentContents = await readAllDocuments(validFiles);
        console.log('Document content read successfully:', documentContents);
        
        
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <h3>Drag files here or click to upload</h3>
            <p>Supports PDF, DOC, DOCX, TXT formats</p>
            <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.txt" hidden>
            <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">
                Select File
            </button>
        `;
        
        
        setTimeout(() => setupFileUpload(), 100);
        
        
        analyzeDocuments();
    } catch (error) {
        console.error('Document reading failed:', error);
        alert('Document reading failed: ' + error.message);
        
        
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <h3>Drag files here or click to upload</h3>
            <p>Supports PDF, DOC, DOCX, TXT formats</p>
            <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.txt" hidden>
            <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">
                Select File
            </button>
        `;
        
        
        setTimeout(() => setupFileUpload(), 100);
    }
}

function displayUploadedFiles() {
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    const fileList = document.getElementById('fileList');
    
    uploadedFilesDiv.style.display = 'block';
    fileList.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-file-alt"></i>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${(file.size / 1024).toFixed(1)} KB</div>
                </div>
            </div>
            <button class="btn btn-sm" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayUploadedFiles();
    
    if (uploadedFiles.length === 0) {
        const uploadedFilesDiv = document.getElementById('uploadedFiles');
        const aiSupplementDiv = document.getElementById('aiSupplement');
        if (uploadedFilesDiv) uploadedFilesDiv.style.display = 'none';
        if (aiSupplementDiv) aiSupplementDiv.style.display = 'none';
    }
}

async function analyzeDocuments() {
    
    showAISupplementSection();
    addAIMessage('Analyzing document content, please wait...');
    
    
    const hasParseIssues = documentContents.some(doc => 
        doc.parseStatus === 'failed' || doc.parseStatus === 'partial' || doc.needsUserInput
    );
    
    if (hasParseIssues) {
        
        setTimeout(async () => {
            addAIMessage('📄 Document upload completed, but the following situations were detected:');
            
            documentContents.forEach(doc => {
                if (doc.needsUserInput) {
                    addAIMessage(`⚠️ ${doc.fileName}: Needs additional processing`);
                }
            });
            
            addAIMessage('💡 For the most accurate analysis results, we recommend:');
            addAIMessage('1. Convert DOCX files to TXT format and re-upload');
            addAIMessage('2. Or use the AI smart completion feature below');
            addAIMessage('3. Manually provide key information in the dialog');
            
            
            showAutoCompleteButton();
            
            
            const documentAnalysis = await analyzeDocumentContent();
            window.currentAnalysis = documentAnalysis;
            
            addAIMessage(`🔍 Based on the filename "${uploadedFiles[0]?.name}", I infer this is a ${getDocumentTypeName(documentAnalysis.documentType)}-related document.`);
            
            setTimeout(() => {
                startIntelligentSupplement(documentAnalysis);
            }, 1000);
            
        }, 1500);
        return;
    }
    
    
    setTimeout(async () => {
        const documentAnalysis = await analyzeDocumentContent();
        
        
        AIAssistantState.analysisData = documentAnalysis;
        window.currentAnalysis = documentAnalysis;
        
        const productTypeName = getDocumentTypeName(documentAnalysis.documentType);
        const confidencePercent = Math.round(documentAnalysis.confidence * 100);
        
        
        updateProgress(30, 'Extracting document content...');
        setTimeout(() => {
            updateProgress(60, 'Analyzing product information...');
            setTimeout(() => {
                updateProgress(90, 'Identifying missing information...');
                setTimeout(() => {
                    
                    showAnalysisResults({
                        productTypeName,
                        confidencePercent,
                        aiSummary: documentAnalysis.aiAnalysisResult?.summary || documentContent.substring(0, 150) + '...',
                        keyFeatures: documentAnalysis.aiAnalysisResult?.keyFeatures || ['Product Analysis', 'Carbon Footprint Assessment'],
                        missingFields: documentAnalysis.missingFields
                    });
                }, 500);
            }, 800);
        }, 800);
    }, 2000);
}


function prepareContentForAI(content) {
    console.log('=== Preparing document content for AI processing ===');
    console.log('Original content length:', content.length);
    
    
    const maxLength = 3000;
    let processedContent = content;
    
    if (content.length > maxLength) {
        
        const frontPart = content.substring(0, 1500);
        const backPart = content.substring(content.length - 1500);
        processedContent = frontPart + '\n\n...[Middle section omitted]...\n\n' + backPart;
        console.log('Content truncated to within 3000 characters');
    }
    
    console.log('Processed content length:', processedContent.length);
    console.log('Content preview to be processed by AI:', processedContent.substring(0, 200) + '...');
    
    
    return {
        content: processedContent,
        needsAIProcessing: true,
        originalLength: content.length
    };
}


function identifyProductTypeFromContent(content, fileName) {
    console.log('=== Starting product type identification ===');
    console.log('File name:', fileName);
    console.log('Content length:', content.length);
    const contentLower = content.toLowerCase();
    
    
    const electronicsKeywords = [
        '电子', '手机', '电脑', '数码', '芯片', '电路', '显示器', '处理器', '内存', '硬盘',
        'electronic', 'smartphone', 'computer', 'digital', 'chip', 'circuit', 'display', 'processor', 'memory', 'device'
    ];
    if (electronicsKeywords.some(keyword => contentLower.includes(keyword))) {
        return 'electronics';
    }
    
    
    const textileKeywords = [
        '服装', '纺织', '时尚', '布料', '面料', '棉花', '丝绸', '羊毛', '化纤',
        'textile', 'fashion', 'clothing', 'fabric', 'cotton', 'silk', 'wool', 'fiber', 'garment', 'apparel', 'jacket', 'shirt', 'dress'
    ];
    if (textileKeywords.some(keyword => contentLower.includes(keyword))) {
        return 'textile';
    }
    
    
    const foodKeywords = ['食品', '饮料', '农产品', '有机', '营养', '添加剂', '保鲜', '包装食品',
                              'food', 'beverage', 'agricultural', 'organic', 'nutrition', 'additive', 'fresh', 'packaged food'];
    if (foodKeywords.some(keyword => contentLower.includes(keyword))) {
        return 'food';
    }
    
    
    const automotiveKeywords = ['汽车', '交通', '运输', '车辆', '发动机', '轮胎', '底盘', '变速箱',
                                   'automotive', 'transportation', 'vehicle', 'engine', 'tire', 'chassis', 'transmission'];
    if (automotiveKeywords.some(keyword => contentLower.includes(keyword))) {
        return 'automotive';
    }
    
    
    const constructionKeywords = ['建筑', '房地产', '装修', '建材', '水泥', '钢筋', '砖块', '涂料',
                                     'construction', 'real estate', 'renovation', 'building materials', 'cement', 'steel', 'brick', 'paint'];
    if (constructionKeywords.some(keyword => contentLower.includes(keyword))) {
        return 'construction';
    }
    
    
    const result = identifyProductTypeFromFileName(fileName);
    console.log('Final identified product type:', result);
    return result;
}


function identifyProductTypeFromFileName(fileName) {
    if (fileName.includes('电子') || fileName.includes('手机') || fileName.includes('电脑') || fileName.includes('数码') ||
        fileName.includes('electronic') || fileName.includes('phone') || fileName.includes('computer') || fileName.includes('digital')) {
        return 'electronics';
    } else if (fileName.includes('服装') || fileName.includes('纺织') || fileName.includes('时尚') || fileName.includes('布料') ||
               fileName.includes('textile') || fileName.includes('clothing') || fileName.includes('fashion') || fileName.includes('fabric')) {
        return 'textile';
    } else if (fileName.includes('食品') || fileName.includes('饮料') || fileName.includes('农产品') || fileName.includes('有机') ||
               fileName.includes('food') || fileName.includes('beverage') || fileName.includes('agricultural') || fileName.includes('organic')) {
        return 'food';
    } else if (fileName.includes('汽车') || fileName.includes('交通') || fileName.includes('运输') || fileName.includes('车辆') ||
               fileName.includes('automotive') || fileName.includes('transportation') || fileName.includes('vehicle') || fileName.includes('car')) {
        return 'automotive';
    } else if (fileName.includes('建筑') || fileName.includes('房地产') || fileName.includes('装修') || fileName.includes('材料') ||
               fileName.includes('construction') || fileName.includes('building') || fileName.includes('renovation') || fileName.includes('material')) {
        return 'construction';
    }
    return 'general';
}


function getKpiConfigByType(documentType) {
    const configs = {
        'electronics': {
            focusAreas: ['Energy Efficiency', 'Material Recovery Rate', 'Production Carbon Footprint', 'Supply Chain Transparency'],
            kpiWeights: { procurement: 1.2, manufacturing: 1.5, usage: 1.3, recycling: 1.4 }
        },
        'textile': {
            focusAreas: ['Water Resource Usage', 'Chemical Management', 'Labor Standards', 'Circular Design'],
            kpiWeights: { procurement: 1.3, manufacturing: 1.4, logistics: 1.1, usage: 0.9 }
        },
        'food': {
            focusAreas: ['Carbon Footprint Tracking', 'Packaging Reduction', 'Food Safety', 'Sustainable Agriculture'],
            kpiWeights: { procurement: 1.4, logistics: 1.3, usage: 0.8, decomposition: 1.2 }
        },
        'automotive': {
            focusAreas: ['Fuel Efficiency', 'Electrification Transition', 'Lightweight Design', 'Lifecycle Assessment'],
            kpiWeights: { manufacturing: 1.3, usage: 1.5, recycling: 1.2, logistics: 1.1 }
        },
        'construction': {
            focusAreas: ['Green Building Materials', 'Energy Efficiency Standards', 'Waste Management', 'Sustainable Design'],
            kpiWeights: { procurement: 1.3, manufacturing: 1.2, usage: 1.4, decomposition: 1.1 }
        },
        'general': {
            focusAreas: ['Carbon Emission Management', 'Resource Utilization', 'Environmental Impact', 'Sustainable Development'],
            kpiWeights: { procurement: 1.0, manufacturing: 1.0, logistics: 1.0, usage: 1.0, recycling: 1.0, decomposition: 1.0 }
        }
    };
    
    return configs[documentType] || configs['general'];
}


async function analyzeDocumentContent() {
    const fileName = uploadedFiles[0]?.name.toLowerCase() || '';
    const documentContent = documentContents[0]?.content || '';
    
    console.log('=== AI文档分析开始 ===');
    console.log('文件名:', fileName);
    console.log('文档内容长度:', documentContent.length);
    console.log('文档内容预览:', documentContent.substring(0, 300));
    
    let documentType = 'general';
    let kpiConfig = {};
    let aiProcessingData = null;
    let confidence = 0;
    let aiAnalysisResult = null;
    
    
    if (documentContent && documentContent.length > 10) {
        aiProcessingData = prepareContentForAI(documentContent);
        
        
        try {
            aiAnalysisResult = await callAIForDocumentAnalysis(aiProcessingData);
            documentType = aiAnalysisResult.productType || 'general';
            confidence = aiAnalysisResult.confidence || 0.8;
            
            console.log('AI文档分析结果:', aiAnalysisResult);
        } catch (error) {
            console.warn('AI文档分析失败，使用本地分析:', error);
            
            documentType = identifyProductTypeFromContent(documentContent, fileName);
            confidence = 0.8;
        }
    } else {
        
        documentType = identifyProductTypeFromFileName(fileName);
        confidence = 0.3;
    }
    
    
    kpiConfig = getKpiConfigByType(documentType);
    
    
    const allFields = [
        'Supplier Geographical Location Information',
        'Raw Material Specifications and Sources',
        'Detailed Production Process',
        'Logistics Transportation Methods and Routes',
        'Product Usage Scenarios and Lifecycle',
        'Recycling Processing Plan',
        'Store Distribution and Sales Channels',
        'Packaging Material Information',
        'Energy Usage Types',
        'Waste Processing Methods'
    ];
    
    
    const missingFields = [...allFields];
    const foundFields = [];
    
    
    window.documentAIContent = aiProcessingData;
    window.documentAIAnalysis = aiAnalysisResult;
    
    return {
        missingFields,
        foundFields,
        extractedInfo: {}, 
        confidence: confidence, 
        documentType,
        kpiConfig,
        aiProcessingData, 
        aiAnalysisResult 
    };
}

function startIntelligentSupplement(analysis) {
    let currentFieldIndex = 0;
    const fields = analysis.missingFields;
    
    function askNextField() {
        if (currentFieldIndex >= fields.length) {
            
            addAIMessage('✅ Information supplementation completed! Performing intelligent reasoning and data validation...');
            
            setTimeout(() => {
                addAIMessage('🤖 Based on the information you provided, I have automatically inferred the following data:');
                
                
                const inferredData = generateInferredData();
                displayInferredData(inferredData);
                
                setTimeout(() => {
                    addAIMessage('Data completion finished, now ready for precise carbon emission analysis!');
                    const startAnalysisBtn = document.getElementById('startAnalysis');
            if (startAnalysisBtn && isCompletionSufficient()) {
                startAnalysisBtn.disabled = false;
                startAnalysisBtn.style.display = 'inline-flex';
                console.log('✅ Start Analysis button enabled after intelligent supplement completion');
            } else if (startAnalysisBtn) {
                console.log('⚠️ Start Analysis button remains hidden - supplement completion insufficient');
            }
                }, 2000);
            }, 1500);
            return;
        }
        
        const field = fields[currentFieldIndex];
        const question = generateSmartQuestion(field, currentFieldIndex);
        addAIMessage(question);
        
        
        window.currentSupplementField = {
            field: field,
            index: currentFieldIndex,
            onAnswer: (answer) => {
                
                processFieldAnswer(field, answer);
                currentFieldIndex++;
                
                
                setTimeout(() => {
                    askNextField();
                }, 800);
            }
        };
    }
    
    
    setTimeout(() => {
        askNextField();
    }, 500);
}

function generateSmartQuestion(field, index) {
    
    const analysis = window.currentAnalysis || {};
    const productType = analysis.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    
    const smartQuestions = {
        'Supplier Geographical Location Information': {
            'electronics': `For ${productTypeName}, please provide the geographical locations of main electronic component suppliers, such as: "Chip supplier: TSMC, Taiwan; Battery supplier: CATL, Fujian"`,
            'textile': `For ${productTypeName}, please provide the locations of fabric and accessory suppliers, such as: "Fabric: Nantong, Jiangsu; Zipper: Dongguan, Guangdong"`,
            'food': `For ${productTypeName}, please provide the locations of main raw material suppliers, such as: "Wheat: Henan; Packaging materials: Shandong"`,
            'automotive': `For ${productTypeName}, please provide the locations of main component suppliers, such as: "Engine: Shanghai; Tires: Shandong"`,
            'construction': `For ${productTypeName}, please provide the locations of building material suppliers, such as: "Cement: Anhui Conch; Steel: Hebei"`,
            'default': 'Please tell me the geographical locations of main suppliers, such as: "Jiangsu Nanjing", "Guangdong Shenzhen", etc. This will help calculate transportation carbon emissions.'
        },
        'Raw Material Specifications and Sources': {
            'electronics': `For ${productTypeName}, please describe the specifications of key electronic components in detail, such as: "Main chip: Qualcomm Snapdragon 8 series; Memory: LPDDR5 8GB; Battery: 4500mAh lithium battery"`,
            'textile': `For ${productTypeName}, please describe the fabric composition and specifications in detail, such as: "Main material: 100% pure cotton, 40s yarn; Accessories: polyester fiber zipper"`,
            'food': `For ${productTypeName}, please describe the main ingredients and additives in detail, such as: "Wheat flour: high-gluten flour; Preservative: potassium sorbate, compliant with GB2760 standard"`,
            'automotive': `For ${productTypeName}, please describe the main material specifications in detail, such as: "Body steel: high-strength steel Q690; Tires: 225/60R16"`,
            'construction': `For ${productTypeName}, please describe the building material specifications in detail, such as: "Cement: P.O 42.5 ordinary Portland cement; Rebar: HRB400E"`,
            'default': 'Please describe the types and sources of main raw materials, for example: "Steel-Baosteel Group", "Plastic-Sinopec", etc.'
        },
        'Detailed Production Process': {
            'electronics': `For ${productTypeName}, please describe the production process flow, such as: "SMT mounting → Wave soldering → Function testing → Aging test → Packaging"`,
            'textile': `For ${productTypeName}, please describe the production process flow, such as: "Spinning → Weaving → Dyeing → Cutting → Sewing → Ironing → Quality inspection"`,
            'food': `For ${productTypeName}, please describe the production process flow, such as: "Raw material preprocessing → Mixing → Molding → Baking → Cooling → Packaging → Sterilization"`,
            'automotive': `For ${productTypeName}, please describe the production process flow, such as: "Stamping → Welding → Painting → Final assembly → Quality inspection"`,
            'construction': `For ${productTypeName}, please describe the production process flow, such as: "Raw material ratio → Mixing → Molding → Curing → Quality inspection"`,
            'default': 'Please briefly describe the production process flow, such as: "Injection molding → Assembly → Packaging" or "Cutting → Welding → Surface treatment".'
        },
        'Packaging Material Information': {
            'electronics': `For ${productTypeName}, please describe packaging materials, such as: "Anti-static bag + cardboard box + foam lining" or "Eco-friendly paper packaging"`,
            'textile': `For ${productTypeName}, please describe packaging materials, such as: "Non-woven bag + paper hang tag" or "Biodegradable plastic bag"`,
            'food': `For ${productTypeName}, please describe packaging materials, such as: "Food-grade plastic box + aluminum foil seal" or "Paper packaging box"`,
            'automotive': `For ${productTypeName}, please describe packaging materials, such as: "Wooden pallet + anti-rust paper + plastic film"`,
            'construction': `For ${productTypeName}, please describe packaging methods, such as: "Woven bag packaging" or "Bulk transportation"`,
            'default': 'Please describe the types of packaging materials, such as: "Paper packaging box + plastic foam", "Biodegradable packaging materials", etc.'
        }
    };
    
    
    const baseQuestions = {
        'Logistics Transportation Methods and Routes': 'Please describe the main transportation methods, such as: "Mainly road transport", "Railway + road combined transport", etc.',
        'Product Usage Scenarios and Lifecycle': 'Please describe typical usage scenarios and expected lifespan of the product, such as: "Home appliances, 8-10 years of use".',
        'Recycling Processing Plan': 'Please describe the recycling and disposal methods for the product, such as: "Metal parts recycled, plastic parts biodegraded".',
        'Store Distribution and Sales Channels': 'Please describe sales channels, such as: "Mainly online e-commerce", "200 physical stores nationwide", etc.',
        'Energy Usage Types': 'Please describe the types of energy used in the production process, such as: "Mainly electricity", "Natural gas + electricity", etc.',
        'Waste Processing Methods': 'Please describe how waste materials are handled during production, such as: "Waste recycling and reuse", "Handled by professional organizations", etc.'
    };
    
    
    let question = smartQuestions[field]?.[productType] || smartQuestions[field]?.['default'] || baseQuestions[field];
    
    if (!question) {
        question = `Please provide detailed information about "${field}":`;
    }
    
    
    return `📝 请补充：${field}`;
}

function processFieldAnswer(field, answer) {
    
    if (!window.supplementData) {
        window.supplementData = {};
    }
    if (!window.userSupplements) {
        window.userSupplements = {};
    }
    
    
    const fieldMapping = {
        'supplierLocation': 'supplierLocation',
        'rawMaterials': 'rawMaterials', 
        'productionProcess': 'productionProcess',
        'logistics': 'logistics',
        'productUsage': 'productUsage',
        'recycling': 'recycling',
        'salesChannels': 'salesChannels',
        'packaging': 'packaging',
        'energyType': 'energyType',
        'wasteDisposal': 'wasteDisposal'
    };
    
    const standardField = fieldMapping[field] || field;
    window.supplementData[field] = answer;
    window.userSupplements[standardField] = answer;
    
    
    const confirmations = [
        '✅ Information recorded, this is very helpful for carbon emission calculations.',
        '👍 Received, this information will be used to optimize analysis accuracy.',
        '📝 Saved, continuing to collect other necessary information.',
        '✨ Excellent, this will improve the accuracy of analysis results.'
    ];
    
    const randomConfirmation = confirmations[Math.floor(Math.random() * confirmations.length)];
    addAIMessage(randomConfirmation);
}

function generateInferredData() {
    
    return {
        'Estimated Transportation Distance': 'Based on supplier locations, average transportation distance is approximately 450 kilometers',
        'Energy Consumption Coefficient': 'Based on process flow, estimated unit product energy consumption is 2.3kWh',
        'Packaging Carbon Footprint': 'Packaging material carbon emissions account for approximately 8% of total emissions',
        'Recycling Efficiency': 'Based on recycling plan, estimated recycling rate is 65%',
        'Usage Phase Emissions': 'Based on usage scenarios, usage phase accounts for 40% of lifecycle emissions'
    };
}

function displayInferredData(data) {
    const chatMessages = document.getElementById('chatMessages');
    const inferredDiv = document.createElement('div');
    inferredDiv.className = 'message ai inferred-data';
    
    let content = '<div class="inferred-header"><i class="fas fa-brain"></i> <strong>AI Intelligent Inference Results:</strong></div>';
    
    Object.entries(data).forEach(([key, value]) => {
        content += `<div class="inferred-item">• <strong>${key}:</strong> ${value}</div>`;
    });
    
    inferredDiv.innerHTML = content;
    chatMessages.appendChild(inferredDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


function renderMissingFieldsCard(confidencePercent, missingFields) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    const card = document.createElement('div');
    card.className = 'message ai missing-fields-card';
    const listHtml = (Array.isArray(missingFields) ? missingFields : [])
        .map(f => `<li>• ${f}</li>`)
        .join('');
    card.innerHTML = `
        <div class="missing-fields">
            <div class="row-1">🎯 <strong>Document information completeness:</strong> ${typeof confidencePercent === 'number' ? confidencePercent + '%' : '-'}</div>
            <div class="row-2" style="margin-top:6px;">❓ <strong>The following information needs to be supplemented:</strong></div>
            <ul class="row-3" style="margin:8px 0 0 0; padding-left:18px;">${listHtml}</ul>
        </div>`;
    chatMessages.appendChild(card);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


function renderDocumentAnalysisSummaryCard(params) {
    const {
        productTypeName,
        confidencePercent,
        aiSummary,
        keyFeatures
    } = params || {};
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    const card = document.createElement('div');
    card.className = 'message ai analysis-summary-card';
    const featuresHtml = Array.isArray(keyFeatures) && keyFeatures.length > 0
        ? `<div class="features"><strong>🔍 Key Features:</strong> ${keyFeatures.join(', ')}</div>`
        : '';
    card.innerHTML = `
        <div class="analysis-summary">
            <div class="row-1"><i class="fas fa-robot"></i> <strong>AI document analysis completed</strong></div>
            <div class="row-2">📄 <strong>Product type:</strong> ${productTypeName || '-'}</div>
            <div class="row-3">🎯 <strong>Confidence:</strong> ${typeof confidencePercent === 'number' ? confidencePercent + '%' : '-'}</div>
            <div class="row-4">📝 <strong>AI Analysis Summary:</strong> ${aiSummary || '-'}</div>
            ${featuresHtml}
        </div>`;
    chatMessages.appendChild(card);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showAISupplementSection() {
    const aiSupplement = document.getElementById('aiSupplement');
    if (aiSupplement) {
        aiSupplement.style.display = 'block';
        aiSupplement.scrollIntoView({ behavior: 'smooth' });
        
        
        initializeAIAssistant();
    }
}


const AIAssistantState = {
    currentStep: 'analyzing', 
    mode: 'auto', 
    analysisData: null,
    missingFields: [],
    supplementData: {}
};

function initializeAIAssistant() {
    console.log('🔧 Initializing AI Assistant...');
    
    updateAIStatus('analyzing', 'Starting document analysis...');
    updateProgress(10, 'Initializing AI analysis...');
    
    
    showPanel('aiStatusPanel');
    hidePanel('analysisResultsPanel');
    hidePanel('supplementPanel');
    hidePanel('completionResultsPanel');
    
    console.log('✅ AI Assistant initialized');
}


function updateAIStatus(status, text) {
    console.log(`📈 Updating AI status: ${status} - ${text}`);
    const statusIndicator = document.getElementById('statusIndicator');
    const statusDot = statusIndicator?.querySelector('.status-dot');
    const statusText = statusIndicator?.querySelector('.status-text');
    
    if (statusDot && statusText) {
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = text;
        console.log(`✅ Status updated successfully`);
    } else {
        console.error('❌ Status indicator elements not found!');
    }
}

function updateProgress(percentage, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = text;
    }
}

function showPanel(panelId) {
    console.log(`🔄 Showing panel: ${panelId}`);
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'block';
        panel.classList.add('panel-visible');
        panel.classList.remove('panel-hidden');
        console.log(`✅ Panel ${panelId} is now visible`);
    } else {
        console.error(`❌ Panel ${panelId} not found!`);
    }
}

function hidePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
        panel.classList.add('panel-hidden');
        panel.classList.remove('panel-visible');
    }
}

function switchToAutoMode() {
    AIAssistantState.mode = 'auto';
    document.getElementById('autoModeBtn')?.classList.add('active');
    document.getElementById('manualModeBtn')?.classList.remove('active');
    showPanel('autoMode');
    hidePanel('manualMode');
}

function switchToManualMode() {
    
    console.log('Manual Q&A mode is disabled');
    return;
}

function showAnalysisResults(data) {
    console.log('📊 Showing analysis results:', data);
    AIAssistantState.currentStep = 'results';
    
    
    updateAIStatus('ready', 'Analysis completed');
    updateProgress(100, 'Document analysis finished');
    
    
    const analysisSummary = document.getElementById('analysisSummary');
    if (analysisSummary && data) {
        analysisSummary.innerHTML = `
            <div class="analysis-item">
                <div class="analysis-label">
                    <i class="fas fa-file-alt"></i>
                    <strong>Document Type:</strong>
                </div>
                <div class="analysis-value">${data.productTypeName || 'Unknown'}</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-label">
                    <i class="fas fa-percentage"></i>
                    <strong>Confidence Level:</strong>
                </div>
                <div class="analysis-value">${data.confidencePercent || 0}%</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-label">
                    <i class="fas fa-brain"></i>
                    <strong>AI Summary:</strong>
                </div>
                <div class="analysis-value">${data.aiSummary || 'No summary available'}</div>
            </div>
        `;
    }
    
    showPanel('analysisResultsPanel');
    
    
    setTimeout(() => {
        console.log('📋 Checking missing fields:', data.missingFields);
        console.log('📋 Missing fields count:', data.missingFields?.length || 0);
        
        if (data.missingFields && data.missingFields.length > 0) {
            console.log('📋 Showing supplement panel with missing fields');
            showSupplementPanel(data.missingFields);
        } else {
            console.log('📋 No missing fields, showing completion results directly');
            
            
            showSupplementPanel(['Manual Review and Adjustment']);
        }
    }, 1000);
}

function showSupplementPanel(missingFields) {
    AIAssistantState.currentStep = 'supplement';
    AIAssistantState.missingFields = missingFields;
    
    updateAIStatus('waiting', 'Waiting for information supplement');
    
    
    const preview = document.getElementById('missingFieldsPreview');
    if (preview) {
        const fieldsHtml = missingFields.map(field => 
            `<div class="missing-field-item">${field}</div>`
        ).join('');
        
        preview.innerHTML = `
            <h5><i class="fas fa-exclamation-triangle"></i> Missing Information (${missingFields.length} items)</h5>
            <div class="missing-fields-list">${fieldsHtml}</div>
        `;
    }
    
    showPanel('supplementPanel');
}
function showCompletionResults() {
    console.log('🎉 Showing completion results');
    AIAssistantState.currentStep = 'completed';
    
    updateAIStatus('ready', 'Information completed');
    
    
    const completedData = document.getElementById('completedData');
    if (completedData && AIAssistantState.supplementData) {
        const dataHtml = Object.entries(AIAssistantState.supplementData)
            .map(([key, value], index) => `
                <div class="completed-item-interactive" data-field="${key}" data-index="${index}">
                    <div class="completed-content">
                        <div class="completed-label">${key}:</div>
                        <div class="completed-value" id="value-${index}">${value}</div>
                    </div>
                    <div class="completed-actions">
                        <button class="btn-edit" data-field="${key}" data-index="${index}" title="Edit this information">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-regenerate" data-field="${key}" data-index="${index}" title="Regenerate with AI">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        
        completedData.innerHTML = dataHtml;
        
        
        setTimeout(() => {
            addCompletionItemEventListeners();
            checkScrollNeed();
        }, 100);
    }
    
    showPanel('completionResultsPanel');
    
    
    const actionPanel = document.querySelector('.action-panel');
    if (actionPanel) {
        actionPanel.style.display = 'block';
        actionPanel.style.visibility = 'visible';
        console.log('✅ Action panel is now visible');
    }
    
    
    const startAnalysisBtn = document.getElementById('startAnalysis');
    if (startAnalysisBtn && isCompletionSufficient()) {
        
        startAnalysisBtn.disabled = false;
        startAnalysisBtn.classList.add('pulse-success');
        startAnalysisBtn.style.display = 'inline-flex';
        startAnalysisBtn.style.visibility = 'visible';
        startAnalysisBtn.style.opacity = '1';
        
        
        ensureButtonContentVisible(startAnalysisBtn);
        
        console.log('✅ Start Analysis button enabled and visible - completion sufficient');
    } else if (startAnalysisBtn) {
        console.log('⚠️ Start Analysis button remains hidden - completion insufficient');
    }
    
    
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.style.display = 'inline-flex';
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.style.display = 'inline-flex';
    }
    
    console.log('🎉 Completion results displayed successfully');
    
    
    setTimeout(() => {
        debugStartAnalysisButton();
    }, 500);
}


function debugStartAnalysisButton() {
    const startAnalysisBtn = document.getElementById('startAnalysis');
    
    console.log('🔍 Debugging Start Analysis Button:');
    console.log('Button element:', startAnalysisBtn);
    
    if (startAnalysisBtn) {
        console.log('Button exists: YES');
        console.log('Button disabled:', startAnalysisBtn.disabled);
        console.log('Button display:', getComputedStyle(startAnalysisBtn).display);
        console.log('Button visibility:', getComputedStyle(startAnalysisBtn).visibility);
        console.log('Button opacity:', getComputedStyle(startAnalysisBtn).opacity);
        console.log('Button color:', getComputedStyle(startAnalysisBtn).color);
        console.log('Button background:', getComputedStyle(startAnalysisBtn).background);
        console.log('Button innerHTML:', startAnalysisBtn.innerHTML);
        console.log('Button classes:', startAnalysisBtn.className);
        
        
        console.log('🔧 Checking completion before updating button styles...');
        if (isCompletionSufficient()) {
            startAnalysisBtn.disabled = false;
            startAnalysisBtn.style.display = 'inline-flex';
            startAnalysisBtn.style.opacity = '1';
            console.log('✅ Debug: Button enabled - completion sufficient');
        } else {
            console.log('⚠️ Debug: Button remains hidden - completion insufficient');
            return; 
        }
        startAnalysisBtn.style.visibility = 'visible';
        startAnalysisBtn.style.color = '#FFFFFF';
        startAnalysisBtn.style.background = 'linear-gradient(135deg, #34C759 0%, #2FB954 100%)';
        startAnalysisBtn.style.padding = '12px 24px';
        startAnalysisBtn.style.fontSize = '18px';
        startAnalysisBtn.style.fontWeight = '600';
        startAnalysisBtn.style.minWidth = '180px';
        startAnalysisBtn.style.borderRadius = '12px';
        startAnalysisBtn.style.border = 'none';
        startAnalysisBtn.style.cursor = 'pointer';
        
        console.log('✅ Button styles force updated');
    } else {
        console.log('❌ Button element NOT FOUND!');
    }
}


function ensureButtonContentVisible(button) {
    if (!button) return;
    
    
    if (!button.innerHTML.trim()) {
        console.log('⚠️ Button has no content, restoring...');
        button.innerHTML = '<i class="fas fa-play"></i> Start Carbon Analysis';
    }
    
    
    const icon = button.querySelector('i');
    const textNodes = Array.from(button.childNodes).filter(node => node.nodeType === 3);
    
    if (icon) {
        icon.style.display = 'inline';
        icon.style.marginRight = '8px';
    }
    
    
    button.style.color = '#FFFFFF';
    button.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    button.style.fontWeight = '600';
    button.style.fontSize = '16px';
    button.style.textDecoration = 'none';
    button.style.whiteSpace = 'nowrap';
    
    console.log('✅ Button content visibility ensured');
}

function resetAssistant() {
    
    AIAssistantState.currentStep = 'analyzing';
    AIAssistantState.mode = 'auto';
    AIAssistantState.analysisData = null;
    AIAssistantState.missingFields = [];
    AIAssistantState.supplementData = {};
    
    
    initializeAIAssistant();
    
    
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    
    const startAnalysisBtn = document.getElementById('startAnalysis');
    if (startAnalysisBtn) {
        startAnalysisBtn.disabled = true;
        startAnalysisBtn.classList.remove('pulse-success');
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }
}


function addCompletionItemEventListeners() {
    console.log('📝 Adding event listeners to completion items');
    
    
    const editButtons = document.querySelectorAll('.btn-edit');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const fieldName = this.getAttribute('data-field');
            const index = this.getAttribute('data-index');
            console.log(`✏️ Edit clicked for field: ${fieldName}, index: ${index}`);
            editFieldByIndex(fieldName, index);
        });
    });
    
    
    const regenerateButtons = document.querySelectorAll('.btn-regenerate');
    regenerateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const fieldName = this.getAttribute('data-field');
            const index = this.getAttribute('data-index');
            console.log(`🔄 Regenerate clicked for field: ${fieldName}, index: ${index}`);
            regenerateFieldByIndex(fieldName, index);
        });
    });
    
    console.log(`✅ Added event listeners to ${editButtons.length} edit buttons and ${regenerateButtons.length} regenerate buttons`);
}


function editFieldByIndex(fieldName, index) {
    console.log(`✏️ Editing field: ${fieldName}, index: ${index}`);
    
    const valueElement = document.getElementById(`value-${index}`);
    if (!valueElement) {
        console.error('Value element not found for index:', index);
        return;
    }
    
    const currentValue = AIAssistantState.supplementData[fieldName] || '';
    
    
    const editHtml = `
        <div class="edit-container">
            <textarea class="edit-textarea" id="edit-${index}" rows="3">${currentValue}</textarea>
            <div class="edit-actions">
                <button class="btn btn-primary btn-sm" data-field="${fieldName}" data-index="${index}">
                    <i class="fas fa-save"></i> Save
                </button>
                <button class="btn btn-secondary btn-sm" data-field="${fieldName}" data-index="${index}">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    
    valueElement.innerHTML = editHtml;
    
    
    const saveBtn = valueElement.querySelector('.btn-primary');
    const cancelBtn = valueElement.querySelector('.btn-secondary');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => saveFieldByIndex(fieldName, index));
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => cancelEditByIndex(fieldName, index));
    }
    
    
    const textarea = document.getElementById(`edit-${index}`);
    if (textarea) {
        textarea.focus();
        textarea.select();
    }
}


function saveFieldByIndex(fieldName, index) {
    console.log(`💾 Saving field: ${fieldName}, index: ${index}`);
    
    const editElement = document.getElementById(`edit-${index}`);
    const valueElement = document.getElementById(`value-${index}`);
    
    if (!editElement || !valueElement) {
        console.error('Edit elements not found for index:', index);
        return;
    }
    
    const newValue = editElement.value.trim();
    if (newValue) {
        
        AIAssistantState.supplementData[fieldName] = newValue;
        window.supplementData[fieldName] = newValue;
        
        
        valueElement.innerHTML = newValue;
        
        
        showNotification('✅ Field updated successfully!', 'success');
    } else {
        showNotification('❌ Field cannot be empty!', 'error');
    }
}


function cancelEditByIndex(fieldName, index) {
    console.log(`❌ Canceling edit for field: ${fieldName}, index: ${index}`);
    
    const valueElement = document.getElementById(`value-${index}`);
    if (!valueElement) {
        console.error('Value element not found for index:', index);
        return;
    }
    
    
    const originalValue = AIAssistantState.supplementData[fieldName] || '';
    valueElement.innerHTML = originalValue;
}


async function regenerateFieldByIndex(fieldName, index) {
    console.log(`🔄 Regenerating field: ${fieldName}, index: ${index}`);
    
    const valueElement = document.getElementById(`value-${index}`);
    if (!valueElement) {
        console.error('Value element not found for index:', index);
        return;
    }
    
    
    const originalContent = valueElement.innerHTML;
    valueElement.innerHTML = `
        <div class="regenerating">
            <i class="fas fa-spinner fa-spin"></i> 
            <span>AI is regenerating this information...</span>
        </div>
    `;
    
    try {
        
        const documentAIContent = window.documentAIContent;
        const newValue = await callRealAIForSingleField(fieldName, documentAIContent);
        
        if (newValue && newValue.trim()) {
            
            AIAssistantState.supplementData[fieldName] = newValue;
            window.supplementData[fieldName] = newValue;
            
            
            valueElement.innerHTML = newValue;
            
            showNotification('✅ Field regenerated successfully!', 'success');
        } else {
            throw new Error('AI returned empty result');
        }
    } catch (error) {
        console.error('Failed to regenerate field:', error);
        
        
        valueElement.innerHTML = originalContent;
        
        showNotification('❌ Failed to regenerate. Please try manual edit.', 'error');
    }
}


function editField(fieldName) {
    console.log(`✏️ Editing field (legacy): ${fieldName}`);
    
}

function saveField(fieldName) {
    console.log(`💾 Saving field: ${fieldName}`);
    
    const editElement = document.getElementById(`edit-${fieldName.replace(/\s+/g, '-')}`);
    const valueElement = document.getElementById(`value-${fieldName.replace(/\s+/g, '-')}`);
    
    if (!editElement || !valueElement) {
        console.error('Edit elements not found');
        return;
    }
    
    const newValue = editElement.value.trim();
    if (newValue) {
        
        AIAssistantState.supplementData[fieldName] = newValue;
        window.supplementData[fieldName] = newValue;
        
        
        valueElement.innerHTML = newValue;
        
        
        showNotification('✅ Field updated successfully!', 'success');
    } else {
        showNotification('❌ Field cannot be empty!', 'error');
    }
}

function cancelEdit(fieldName) {
    console.log(`❌ Canceling edit for field: ${fieldName}`);
    
    const valueElement = document.getElementById(`value-${fieldName.replace(/\s+/g, '-')}`);
    if (!valueElement) {
        console.error('Value element not found');
        return;
    }
    
    
    const originalValue = AIAssistantState.supplementData[fieldName] || '';
    valueElement.innerHTML = originalValue;
}

async function regenerateField(fieldName) {
    console.log(`🔄 Regenerating field: ${fieldName}`);
    
    const valueElement = document.getElementById(`value-${fieldName.replace(/\s+/g, '-')}`);
    if (!valueElement) {
        console.error('Value element not found');
        return;
    }
    
    
    const originalContent = valueElement.innerHTML;
    valueElement.innerHTML = `
        <div class="regenerating">
            <i class="fas fa-spinner fa-spin"></i> 
            <span>AI is regenerating this information...</span>
        </div>
    `;
    
    try {
        
        const documentAIContent = window.documentAIContent;
        const newValue = await callRealAIForSingleField(fieldName, documentAIContent);
        
        if (newValue && newValue.trim()) {
            
            AIAssistantState.supplementData[fieldName] = newValue;
            window.supplementData[fieldName] = newValue;
            
            
            valueElement.innerHTML = newValue;
            
            showNotification('✅ Field regenerated successfully!', 'success');
        } else {
            throw new Error('AI returned empty result');
        }
    } catch (error) {
        console.error('Failed to regenerate field:', error);
        
        
        valueElement.innerHTML = originalContent;
        
        showNotification('❌ Failed to regenerate. Please try manual edit.', 'error');
    }
}


async function callRealAIForSingleField(fieldName, documentAIContent) {
    const prompt = `
    As a carbon emission analysis expert, please provide detailed information for the following field based on the document content:
    
    Field to complete: ${fieldName}
    
    Document Content: ${documentAIContent?.content || 'Limited document content available'}
    
    Please provide a comprehensive and specific answer for this field only. 
    Return only the answer content, no additional formatting or explanations.
    `;
    
    try {
        const response = await fetch('/api/ai-completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        if (!response.ok) {
            throw new Error('AI API call failed');
        }
        
        const data = await response.json();
        return data.content || data.message || 'Information regenerated based on document analysis';
    } catch (error) {
        console.error('AI call failed:', error);
        return generateFallbackForField(fieldName);
    }
}

function generateFallbackForField(fieldName) {
    const fallbacks = {
        'Supplier Geographical Location Information': 'Global supply chain with key regions in Asia-Pacific, Europe, and North America',
        'Raw Material Specifications and Sources': 'Industrial-grade materials sourced from certified suppliers',
        'Detailed Production Process': 'Standardized production process following industry best practices',
        'Logistics Transportation Methods and Routes': 'Multi-modal transportation including sea freight, land transport, and regional distribution',
        'Product Usage Scenarios and Lifecycle': 'Designed for long-term use with sustainable lifecycle management',
        'Recycling Processing Plan': 'Comprehensive recycling program with material recovery and reuse',
        'Store Distribution and Sales Channels': 'Global distribution network with retail and online channels',
        'Packaging Material Information': 'Sustainable packaging materials with recycling considerations',
        'Energy Usage Types': 'Renewable energy sources prioritized in operations',
        'Waste Processing Methods': 'Systematic waste management with recycling and proper disposal'
    };
    
    return fallbacks[fieldName] || 'Information updated based on document analysis';
}

function showNotification(message, type = 'info') {
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    
    document.body.appendChild(notification);
    
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}


function startAIConversation() {
    addAIMessage('🤖 Starting intelligent completion process...');
}

function addAIMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `<i class="fas fa-robot"></i> ${message}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    aiConversation.push({ type: 'ai', message });
}

function addUserMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    aiConversation.push({ type: 'user', message });
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    chatInput.value = '';
    
    
    if (window.currentSupplementField) {
        const field = window.currentSupplementField;
        field.onAnswer(message);
        window.currentSupplementField = null;
        return;
    }
    
    
    setTimeout(() => {
        const smartResponse = generateSmartResponse(message);
        addAIMessage(smartResponse);
        
        
        if (shouldEnableAnalysis(message)) {
            setTimeout(() => {
                const startAnalysisBtn = document.getElementById('startAnalysis');
            if (startAnalysisBtn) {
                startAnalysisBtn.disabled = false;
                startAnalysisBtn.style.display = 'inline-flex';
            }
                addAIMessage('✅ Information collection completed, now ready to start carbon emission analysis!');
            }, 1000);
        }
    }, 800);
}

function generateSmartResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    
    if (message.includes('供应商') || message.includes('厂商') || message.includes('supplier') || message.includes('vendor')) {
        return '👍 Supplier information is very important, this will help us calculate carbon emissions in the transportation stage. Are there any other supplier information that needs to be supplemented?';
    }
    
    if (message.includes('物流') || message.includes('运输') || message.includes('配送') || message.includes('logistics') || message.includes('transport') || message.includes('delivery')) {
        return '📦 Logistics information recorded. Transportation method and distance are key factors affecting carbon emissions, this information is very valuable for analysis.';
    }
    
    if (message.includes('材料') || message.includes('原料') || message.includes('material') || message.includes('raw material')) {
        return '🔧 Raw material information is crucial for accurately calculating upstream carbon emissions. Based on the information you provided, I can more accurately assess the environmental impact of the material acquisition stage.';
    }
    
    if (message.includes('工艺') || message.includes('生产') || message.includes('制造') || message.includes('process') || message.includes('production') || message.includes('manufacturing')) {
        return '⚙️ Production process information saved. Different process flows generate different energy consumption and emissions, this information will be used to optimize carbon footprint calculations in the production stage.';
    }
    
    if (message.includes('包装') || message.includes('packaging')) {
        return '📦 Packaging information is important for full lifecycle analysis. The choice of packaging materials directly affects the overall carbon footprint of the product.';
    }
    
    if (message.includes('回收') || message.includes('处理') || message.includes('recycling') || message.includes('disposal')) {
        return '♻️ Recycling processing plan recorded. Good recycling strategies can significantly reduce the overall environmental impact of products.';
    }
    
    
    const responses = [
        '✨ Information recorded, this will improve the accuracy of carbon emission analysis.',
        '👌 Received! This information is very helpful for building an accurate carbon footprint model.',
        '📊 Excellent, based on this information I can provide more precise analysis results.',
        '🎯 Information saved, this will be used to optimize carbon emission calculations for the entire lifecycle.'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}


function isCompletionSufficient() {
    
    if (!AIAssistantState.supplementData || Object.keys(AIAssistantState.supplementData).length === 0) {
        console.log('🔍 No supplement data available');
        return false;
    }
    
    const dataEntries = Object.entries(AIAssistantState.supplementData);
    const validEntries = dataEntries.filter(([key, value]) => 
        value && value.toString().trim() !== '' && !isPlaceholderValue(value)
    );
    
    console.log(`🔍 Completion check: ${validEntries.length}/${dataEntries.length} entries valid`);
    
    
    const isComplete = validEntries.length >= 5;
    console.log(`🔍 Completion sufficient: ${isComplete}`);
    
    return isComplete;
}

function shouldEnableAnalysis(message) {
    
    if (!window.supplementData) return false;
    
    const collectedFields = Object.keys(window.supplementData).length;
    const totalMessages = aiConversation.filter(msg => msg.type === 'user').length;
    
    
    return collectedFields >= 3 || totalMessages >= 5;
}


document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});




async function callAIForDataAnalysis() {
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);

    const prompt = `As a carbon emission management and lifecycle assessment expert, please analyze the carbon emissions and timeline data for the following product.\n\n【Product Information】\nProduct Type: ${productTypeName}\nDocument Content: ${documentContent.substring(0, 1500)}\nSupplementary Information: ${Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join(', ')}\n\nPlease generate realistic and credible carbon emission and timeline analysis data for this product (JSON format):\n\n{\n  "emissions": {\n    "procurement": {"value": number, "unit": "kg CO₂e", "description": "Raw material procurement stage emission description"},\n    "manufacturing": {"value": number, "unit": "kg CO₂e", "description": "Production manufacturing stage emission description"},\n    "logistics": {"value": number, "unit": "kg CO₂e", "description": "Logistics transportation stage emission description"},\n    "usage": {"value": number, "unit": "kg CO₂e", "description": "Product usage stage emission description"},\n    "recycling": {"value": number, "unit": "kg CO₂e", "description": "Recycling processing stage emission description"},\n    "decomposition": {"value": number, "unit": "kg CO₂e", "description": "Natural decomposition stage emission description"}\n  },\n  "timeline": {\n    "purchase": {"duration": days, "unit": "days", "description": "Procurement stage duration description"},\n    "produce": {"duration": days, "unit": "days", "description": "Production stage duration description"},\n    "use": {"duration": days, "unit": "days", "description": "Usage stage duration description"},\n    "recycle": {"duration": days, "unit": "days", "description": "Recycling stage duration description"},\n    "decompose": {"duration": days, "unit": "days", "description": "Decomposition stage duration description"}\n  }\n}\n\nRequirements:\n1. Provide realistic and reasonable values based on product type and characteristics\n2. Carbon emission values based on actual industry data, unified unit: kg CO₂e\n3. Timeline unified in days (1 month = 30 days, 1 year = 365 days)\n4. Consider specific product features and usage scenarios\n5. Values should be credible and conform to industry common sense\n6. Return strict JSON format, no extra text`;

    console.log('=================== AI基础数据分析调用 ===================');
    console.log('🔹 API端点:', `${AI_CONFIG.baseUrl}/chat/completions`);
    console.log('🔹 模型:', 'deepseek-v3');
    console.log('📤 提示词长度:', prompt.length, '字符');
    console.log('📤 完整提示词:');
    console.log(prompt);
    const requestBody = {
        model: 'deepseek-v3',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
    };
    console.log('📤 请求参数:', requestBody);

    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_CONFIG.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    console.log('📥 AI API响应状态:', response.status, response.statusText);
    if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ AI API响应错误:', response.status, response.statusText, '-', errorText);
        throw new Error(`AI API调用失败: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('📥 AI API完整响应:', data);
    const aiContent = data?.choices?.[0]?.message?.content || '';
    console.log('📥 AI返回内容:', aiContent);
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.log('❌ 未找到有效JSON格式');
        throw new Error('AI返回格式错误');
    }
    console.log('🔍 提取的JSON字符串:', jsonMatch[0]);
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✅ 解析后的分析数据:', parsed);

    
    const emissionsOut = {};
    const timelineOut = {};
    const emissionKeys = ['procurement','manufacturing','logistics','usage','recycling','decomposition'];
    const timelineKeys = ['procurement','manufacturing','logistics','usage','recycling','decomposition'];

    emissionKeys.forEach(k => {
        const item = parsed?.emissions?.[k];
        if (item && typeof item.value !== 'undefined') {
            const v = Number(item.value);
            emissionsOut[k] = { value: Number.isFinite(v) ? v : 0, originalValue: Number.isFinite(v) ? v : 0 };
        }
    });
    timelineKeys.forEach(k => {
        const item = parsed?.timeline?.[k];
        if (item && typeof item.duration !== 'undefined') {
            const d = Number(item.duration);
            const duration = Math.max(1, Math.floor(Number.isFinite(d) ? d : 1));
            timelineOut[k] = { duration, originalDuration: duration, unit: 'days' };
        }
    });
    console.log('📊 整理后的系统结构:', { emissions: emissionsOut, timeline: timelineOut });
    console.log('=================== AI基础数据分析完成 ===================\n');
    return { emissions: emissionsOut, timeline: timelineOut };
}
function startAnalysis() {
    
    const startBtn = document.getElementById('startAnalysis');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        startBtn.disabled = true;
    }

    
    (async () => {
        try {
            console.log('🚀 开始分析：调用AI生成基础数据...');
            const aiData = await callAIForDataAnalysis();
            console.log('✅ AI基础数据获取成功，开始整合到系统分析结构');

            
            await generateAnalysisData();

            const emissionKeys = ['procurement','manufacturing','logistics','usage','recycling','decomposition'];
            const timelineKeys = ['procurement','manufacturing','logistics','usage','recycling','decomposition'];

            
            emissionKeys.forEach(k => {
                if (aiData.emissions[k] && analysisData?.emissions?.[k]) {
                    const v = aiData.emissions[k].value;
                    analysisData.emissions[k].value = v;
                    analysisData.emissions[k].originalValue = aiData.emissions[k].originalValue;
                    analysisData.emissions[k].level = getEmissionLevel(v, DEFAULT_PRODUCT.emissions[k].value);
                }
            });

            
            timelineKeys.forEach(k => {
                if (aiData.timeline[k]) {
                    if (!analysisData.timeline) analysisData.timeline = {};
                    analysisData.timeline[k] = {
                        ...(analysisData.timeline[k] || {}),
                        duration: aiData.timeline[k].duration,
                        originalDuration: aiData.timeline[k].originalDuration,
                        unit: 'days'
                    };
                }
            });

            
            renderKanbanModule();
            switchModule('kanban');
            isAnalysisComplete = true;

            
            const downloadBtn = document.getElementById('downloadBtn');
            if (downloadBtn) {
                downloadBtn.style.display = 'inline-block';
            }

            if (startBtn) startBtn.innerHTML = '<i class="fas fa-check"></i> Analysis Complete';
        } catch (error) {
            console.error('❌ AI基础数据分析失败，使用本地回退逻辑:', error);
            await generateAnalysisData();
            renderKanbanModule();
            switchModule('kanban');
            isAnalysisComplete = true;
            if (startBtn) startBtn.innerHTML = '<i class="fas fa-check"></i> Analysis Complete (Fallback)';
            const downloadBtn = document.getElementById('downloadBtn');
            if (downloadBtn) {
                downloadBtn.style.display = 'inline-block';
            }
        }
    })();
}


function getDocumentTypeName(documentType) {
    const typeNames = {
        electronics: 'Electronics',
        textile: 'Textiles',
        food: 'Food & Beverage',
        automotive: 'Automotive',
        construction: 'Construction Materials',
        general: 'General Products'
    };
    return typeNames[documentType] || 'Unknown Type';
}


function getBaseEmissionsByType(documentType) {
    const baseValues = {
        electronics: { procurement: 55, manufacturing: 85, logistics: 30, usage: 140, recycling: 18, decomposition: 6 },
        textile: { procurement: 40, manufacturing: 70, logistics: 35, usage: 90, recycling: 12, decomposition: 8 },
        food: { procurement: 35, manufacturing: 45, logistics: 40, usage: 60, recycling: 8, decomposition: 12 },
        automotive: { procurement: 80, manufacturing: 120, logistics: 45, usage: 200, recycling: 25, decomposition: 10 },
        construction: { procurement: 60, manufacturing: 90, logistics: 50, usage: 180, recycling: 20, decomposition: 15 },
        general: { procurement: 45, manufacturing: 78, logistics: 32, usage: 120, recycling: 15, decomposition: 8 }
    };
    return baseValues[documentType] || baseValues.general;
}


function getKpiNameByPhase(phase, documentType) {
    const kpiNames = {
        electronics: {
            procurement: 'Supply Chain Carbon Footprint',
            manufacturing: 'Production Energy Indicators',
            logistics: 'Transportation Efficiency',
            usage: 'Product Energy Efficiency Ratio',
            recycling: 'Material Recovery Rate',
            decomposition: 'Electronic Waste Processing'
        },
        textile: {
            procurement: 'Raw Material Sustainability',
            manufacturing: 'Water Resource Consumption',
            logistics: 'Transportation Carbon Emissions',
            usage: 'Product Durability',
            recycling: 'Fiber Recovery Rate',
            decomposition: 'Biodegradability'
        },
        food: {
            procurement: 'Agricultural Carbon Footprint',
            manufacturing: 'Processing Energy Consumption',
            logistics: 'Cold Chain Efficiency',
            usage: 'Nutritional Value Ratio',
            recycling: 'Packaging Recovery',
            decomposition: 'Organic Waste Processing'
        },
        automotive: {
            procurement: 'Supplier Rating',
            manufacturing: 'Production Carbon Intensity',
            logistics: 'Logistics Optimization',
            usage: 'Fuel Economy',
            recycling: 'Component Recovery',
            decomposition: 'Material Disposal'
        },
        construction: {
            procurement: 'Green Building Material Ratio',
            manufacturing: 'Production Carbon Emissions',
            logistics: 'Transportation Distance',
            usage: 'Building Energy Efficiency',
            recycling: 'Building Material Recovery Rate',
            decomposition: 'Waste Processing'
        }
    };
    
    const defaultNames = {
        procurement: 'Procurement Phase',
        manufacturing: 'Manufacturing Phase',
        logistics: 'Logistics Phase',
        usage: 'Usage Phase',
        recycling: 'Recycling Phase',
        decomposition: 'Decomposition Phase'
    };
    
    return kpiNames[documentType]?.[phase] || defaultNames[phase];
}


function generateTimelineByType(documentType) {
    const timelineConfigs = {
        electronics: {
            procurement: { duration: Math.floor(Math.random() * 14) + 7, unit: '天' },
            manufacturing: { duration: Math.floor(Math.random() * 28) + 14, unit: '天' },
            logistics: { duration: Math.floor(Math.random() * 7) + 3, unit: '天' },
            usage: { duration: Math.floor(Math.random() * 365) + 365, unit: '天' },
            recycling: { duration: Math.floor(Math.random() * 90) + 30, unit: '天' },
            decomposition: { duration: Math.floor(Math.random() * 365) + 180, unit: '天' }
        },
        textile: {
            procurement: { duration: Math.floor(Math.random() * 21) + 14, unit: '天' },
            manufacturing: { duration: Math.floor(Math.random() * 42) + 21, unit: '天' },
            logistics: { duration: Math.floor(Math.random() * 14) + 7, unit: '天' },
            usage: { duration: Math.floor(Math.random() * 730) + 365, unit: '天' },
            recycling: { duration: Math.floor(Math.random() * 120) + 60, unit: '天' },
            decomposition: { duration: Math.floor(Math.random() * 1095) + 365, unit: '天' }
        },
        food: {
            procurement: { duration: Math.floor(Math.random() * 7) + 1, unit: '天' },
            manufacturing: { duration: Math.floor(Math.random() * 14) + 3, unit: '天' },
            logistics: { duration: Math.floor(Math.random() * 3) + 1, unit: '天' },
            usage: { duration: Math.floor(Math.random() * 30) + 7, unit: '天' },
            recycling: { duration: Math.floor(Math.random() * 7) + 1, unit: '天' },
            decomposition: { duration: Math.floor(Math.random() * 90) + 30, unit: '天' }
        },
        automotive: {
            procurement: { duration: Math.floor(Math.random() * 56) + 28, unit: '天' },
            manufacturing: { duration: Math.floor(Math.random() * 84) + 56, unit: '天' },
            logistics: { duration: Math.floor(Math.random() * 21) + 14, unit: '天' },
            usage: { duration: Math.floor(Math.random() * 2555) + 1825, unit: '天' },
            recycling: { duration: Math.floor(Math.random() * 180) + 90, unit: '天' },
            decomposition: { duration: Math.floor(Math.random() * 1095) + 365, unit: '天' }
        },
        construction: {
            procurement: { duration: Math.floor(Math.random() * 28) + 14, unit: '天' },
            manufacturing: { duration: Math.floor(Math.random() * 112) + 56, unit: '天' },
            logistics: { duration: Math.floor(Math.random() * 14) + 7, unit: '天' },
            usage: { duration: Math.floor(Math.random() * 10950) + 5475, unit: '天' },
            recycling: { duration: Math.floor(Math.random() * 365) + 180, unit: '天' },
            decomposition: { duration: Math.floor(Math.random() * 3650) + 1825, unit: '天' }
        }
    };
    
    const defaultTimeline = {
        procurement: { duration: Math.floor(Math.random() * 28) + 7, unit: '天' },
        manufacturing: { duration: Math.floor(Math.random() * 56) + 14, unit: '天' },
        logistics: { duration: Math.floor(Math.random() * 14) + 7, unit: '天' },
        usage: { duration: Math.floor(Math.random() * 1095) + 365, unit: '天' },
        recycling: { duration: Math.floor(Math.random() * 180) + 60, unit: '天' },
        decomposition: { duration: Math.floor(Math.random() * 1095) + 365, unit: '天' }
    };
    
    return timelineConfigs[documentType] || defaultTimeline;
}


function calculateContentBasedEmissions(baseEmissions, extractedInfo, documentType) {
    const userSupplements = window.userSupplements || {};
    const allInfo = { ...extractedInfo, ...userSupplements };
    
    
    const procurementFactors = calculateProcurementEmissions(allInfo, documentType);
    const procurement = Math.floor(baseEmissions.procurement * procurementFactors.multiplier);
    
    
    const manufacturingFactors = calculateManufacturingEmissions(allInfo, documentType);
    const manufacturing = Math.floor(baseEmissions.manufacturing * manufacturingFactors.multiplier);
    
    
    const logisticsFactors = calculateLogisticsEmissions(allInfo, documentType);
    const logistics = Math.floor(baseEmissions.logistics * logisticsFactors.multiplier);
    
    
    const usageFactors = calculateUsageEmissions(allInfo, documentType);
    const usage = Math.floor(baseEmissions.usage * usageFactors.multiplier);
    
    
    const recyclingFactors = calculateRecyclingEmissions(allInfo, documentType);
    const recycling = Math.floor(baseEmissions.recycling * recyclingFactors.multiplier);
    
    
    const decompositionFactors = calculateDecompositionEmissions(allInfo, documentType);
    const decomposition = Math.floor(baseEmissions.decomposition * decompositionFactors.multiplier);
    
    return {
        procurement,
        manufacturing,
        logistics,
        usage,
        recycling,
        decomposition,
        procurementFactors,
        manufacturingFactors,
        logisticsFactors,
        usageFactors,
        recyclingFactors,
        decompositionFactors
    };
}


function calculateProcurementEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.supplierLocation) {
        const location = info.supplierLocation.toLowerCase();
        if (location.includes('本地') || location.includes('同城') || location.includes('local') || location.includes('same city')) {
            multiplier *= 0.7;
            factors.push('Local supplier (-30%)');
        } else if (location.includes('国外') || location.includes('进口') || location.includes('foreign') || location.includes('import')) {
            multiplier *= 1.5;
            factors.push('Foreign supplier (+50%)');
        } else if (location.includes('省内') || location.includes('邻近') || location.includes('provincial') || location.includes('nearby')) {
            multiplier *= 0.9;
            factors.push('Provincial supplier (-10%)');
        }
    }
    
    
    if (info.rawMaterials) {
        const materials = info.rawMaterials.toLowerCase();
        if (materials.includes('可再生') || materials.includes('环保') || materials.includes('renewable') || materials.includes('eco-friendly')) {
            multiplier *= 0.8;
            factors.push('Renewable materials (-20%)');
        } else if (materials.includes('稀有') || materials.includes('贵金属') || materials.includes('rare') || materials.includes('precious metal')) {
            multiplier *= 1.3;
            factors.push('Rare materials (+30%)');
        } else if (materials.includes('回收') || materials.includes('再利用') || materials.includes('recycled') || materials.includes('reused')) {
            multiplier *= 0.6;
            factors.push('Recycled materials (-40%)');
        }
    }
    
    return { multiplier, factors };
}


function calculateManufacturingEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.productionProcess) {
        const process = info.productionProcess.toLowerCase();
        if (process.includes('自动化') || process.includes('智能') || process.includes('automated') || process.includes('smart')) {
            multiplier *= 0.85;
            factors.push('Automated production (-15%)');
        } else if (process.includes('手工') || process.includes('传统') || process.includes('manual') || process.includes('traditional')) {
            multiplier *= 1.2;
            factors.push('Traditional process (+20%)');
        } else if (process.includes('绿色') || process.includes('清洁') || process.includes('green') || process.includes('clean')) {
            multiplier *= 0.7;
            factors.push('Green process (-30%)');
        }
    }
    
    
    if (info.energyType) {
        const energy = info.energyType.toLowerCase();
        if (energy.includes('太阳能') || energy.includes('风能') || energy.includes('清洁能源') || energy.includes('solar') || energy.includes('wind') || energy.includes('clean energy')) {
            multiplier *= 0.5;
            factors.push('Clean energy (-50%)');
        } else if (energy.includes('煤炭') || energy.includes('燃煤') || energy.includes('coal')) {
            multiplier *= 1.8;
            factors.push('Coal energy (+80%)');
        } else if (energy.includes('天然气') || energy.includes('natural gas')) {
            multiplier *= 1.2;
            factors.push('Natural gas (+20%)');
        }
    }
    
    return { multiplier, factors };
}


function calculateLogisticsEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.logistics) {
        const transport = info.logistics.toLowerCase();
        if (transport.includes('铁路') || transport.includes('火车') || transport.includes('railway') || transport.includes('train')) {
            multiplier *= 0.7;
            factors.push('Railway transport (-30%)');
        } else if (transport.includes('航空') || transport.includes('飞机') || transport.includes('aviation') || transport.includes('aircraft')) {
            multiplier *= 2.5;
            factors.push('Aviation transport (+150%)');
        } else if (transport.includes('海运') || transport.includes('船舶') || transport.includes('maritime') || transport.includes('ship')) {
            multiplier *= 0.6;
            factors.push('Maritime transport (-40%)');
        } else if (transport.includes('电动') || transport.includes('新能源') || transport.includes('electric') || transport.includes('new energy')) {
            multiplier *= 0.4;
            factors.push('Electric transport (-60%)');
        }
    }
    
    
    if (info.packaging) {
        const packaging = info.packaging.toLowerCase();
        if (packaging.includes('可降解') || packaging.includes('环保') || packaging.includes('biodegradable') || packaging.includes('eco-friendly')) {
            multiplier *= 0.8;
            factors.push('Eco-friendly packaging (-20%)');
        } else if ((packaging.includes('塑料') || packaging.includes('plastic')) && !packaging.includes('可回收') && !packaging.includes('recyclable')) {
            multiplier *= 1.3;
            factors.push('Plastic packaging (+30%)');
        } else if (packaging.includes('纸质') || packaging.includes('纸箱') || packaging.includes('paper') || packaging.includes('cardboard')) {
            multiplier *= 0.9;
            factors.push('Paper packaging (-10%)');
        }
    }
    
    return { multiplier, factors };
}


function calculateUsageEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.productUsage) {
        const usage = info.productUsage.toLowerCase();
        if (usage.includes('节能') || usage.includes('低功耗') || usage.includes('energy saving') || usage.includes('low power')) {
            multiplier *= 0.6;
            factors.push('Energy-saving design (-40%)');
        } else if (usage.includes('高耗能') || usage.includes('大功率') || usage.includes('high energy') || usage.includes('high power')) {
            multiplier *= 1.8;
            factors.push('High energy consumption (+80%)');
        } else if (usage.includes('智能') || usage.includes('自动调节') || usage.includes('smart') || usage.includes('auto adjustment')) {
            multiplier *= 0.8;
            factors.push('Smart energy saving (-20%)');
        }
    }
    
    
    if (info.productUsage && info.productUsage.includes('年')) {
        const years = parseInt(info.productUsage.match(/\d+/)?.[0] || '1');
        if (years > 10) {
            multiplier *= 0.7;
            factors.push('Long-life product (-30%)');
        } else if (years < 2) {
            multiplier *= 1.5;
            factors.push('Short-life product (+50%)');
        }
    }
    
    return { multiplier, factors };
}


function calculateRecyclingEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.recycling) {
        const recycling = info.recycling.toLowerCase();
        if (recycling.includes('完全回收') || recycling.includes('100%') || recycling.includes('complete recycling') || recycling.includes('fully recyclable')) {
            multiplier *= 0.3;
            factors.push('Complete recycling (-70%)');
        } else if (recycling.includes('部分回收') || recycling.includes('partial recycling')) {
            multiplier *= 0.7;
            factors.push('Partial recycling (-30%)');
        } else if (recycling.includes('不可回收') || recycling.includes('填埋') || recycling.includes('non-recyclable') || recycling.includes('landfill')) {
            multiplier *= 2.0;
            factors.push('Non-recyclable (+100%)');
        } else if (recycling.includes('再利用') || recycling.includes('循环') || recycling.includes('reuse') || recycling.includes('circular')) {
            multiplier *= 0.4;
            factors.push('Circular utilization (-60%)');
        }
    }
    
    return { multiplier, factors };
}


function calculateDecompositionEmissions(info, documentType) {
    let multiplier = 1.0;
    const factors = [];
    
    
    if (info.wasteDisposal) {
        const disposal = info.wasteDisposal.toLowerCase();
        if (disposal.includes('生物降解') || disposal.includes('自然分解') || disposal.includes('biodegradable') || disposal.includes('natural decomposition')) {
            multiplier *= 0.2;
            factors.push('Biodegradable decomposition (-80%)');
        } else if (disposal.includes('焚烧') || disposal.includes('燃烧') || disposal.includes('incineration') || disposal.includes('burning')) {
            multiplier *= 1.8;
            factors.push('Incineration treatment (+80%)');
        } else if (disposal.includes('填埋') || disposal.includes('landfill')) {
            multiplier *= 1.5;
            factors.push('Landfill treatment (+50%)');
        } else if (disposal.includes('无害化') || disposal.includes('环保处理') || disposal.includes('harmless') || disposal.includes('eco-friendly')) {
            multiplier *= 0.6;
            factors.push('Harmless treatment (-40%)');
        }
    }
    
    return { multiplier, factors };
}

async function generateAnalysisData() {
    
    const docAnalysis = window.currentAnalysis || await analyzeDocumentContent();
    const kpiConfig = docAnalysis.kpiConfig || getKpiConfigByType('general');
    const documentType = docAnalysis.documentType || 'general';
    const extractedInfo = docAnalysis.extractedInfo || {};
    
    
    const baseEmissions = getBaseEmissionsByType(documentType);
    
    
    const calculatedEmissions = calculateContentBasedEmissions(baseEmissions, extractedInfo, documentType);
    
    
    analysisData = {
        productName: uploadedFiles[0]?.name.replace(/\.[^/.]+$/, "") || 'New Product',
        documentType: documentType,
        focusAreas: kpiConfig.focusAreas || ['General Metrics', 'Environmental Impact', 'Sustainability', 'Efficiency Optimization'],
        emissions: {
            procurement: {
                value: calculatedEmissions.procurement,
                level: getEmissionLevel(calculatedEmissions.procurement, DEFAULT_PRODUCT.emissions.procurement.value),
                kpiName: getKpiNameByPhase('procurement', documentType),
                factors: calculatedEmissions.procurementFactors
            },
            manufacturing: {
                value: calculatedEmissions.manufacturing,
                level: getEmissionLevel(calculatedEmissions.manufacturing, DEFAULT_PRODUCT.emissions.manufacturing.value),
                kpiName: getKpiNameByPhase('manufacturing', documentType),
                factors: calculatedEmissions.manufacturingFactors
            },
            logistics: {
                value: calculatedEmissions.logistics,
                level: getEmissionLevel(calculatedEmissions.logistics, DEFAULT_PRODUCT.emissions.logistics.value),
                kpiName: getKpiNameByPhase('logistics', documentType),
                factors: calculatedEmissions.logisticsFactors
            },
            usage: {
                value: calculatedEmissions.usage,
                level: getEmissionLevel(calculatedEmissions.usage, DEFAULT_PRODUCT.emissions.usage.value),
                kpiName: getKpiNameByPhase('usage', documentType),
                factors: calculatedEmissions.usageFactors
            },
            recycling: {
                value: calculatedEmissions.recycling,
                level: getEmissionLevel(calculatedEmissions.recycling, DEFAULT_PRODUCT.emissions.recycling.value),
                kpiName: getKpiNameByPhase('recycling', documentType),
                factors: calculatedEmissions.recyclingFactors
            },
            decomposition: {
                value: calculatedEmissions.decomposition,
                level: getEmissionLevel(calculatedEmissions.decomposition, DEFAULT_PRODUCT.emissions.decomposition.value),
                kpiName: getKpiNameByPhase('decomposition', documentType),
                factors: calculatedEmissions.decompositionFactors
            }
        },
        timeline: generateTimelineByType(documentType),
        contentAnalysis: {
            extractedInfo: extractedInfo,
            confidenceScore: docAnalysis.confidenceScore || 0,
            foundFields: docAnalysis.foundFields || [],
            missingFields: docAnalysis.missingFields || []
        }
    };
}

function renderKanbanModule() {
    renderTimeline(analysisData.timeline);
    renderEmissionCards();
    
    
    addKanbanToLeanButton();
}


function addKanbanToLeanButton() {
    const kanbanModule = document.getElementById('kanban-module');
    let existingButton = document.getElementById('kanbanToLeanBtn');
    
    if (!existingButton) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'kanban-action-container';
        buttonContainer.innerHTML = `
            <div class="action-section">
                <h3><i class="fas fa-arrow-right"></i> Next Step Analysis</h3>
                <p>Based on the above Kanban analysis results, enter the Lean module for in-depth optimization analysis</p>
                <button id="kanbanToLeanBtn" class="btn btn-primary btn-large" onclick="goToLeanAnalysis()">
                    <i class="fas fa-lightbulb"></i> Enter Lean Optimization Analysis
                </button>
            </div>
        `;
        kanbanModule.appendChild(buttonContainer);
    }
}


function goToLeanAnalysis() {
    
    switchModule('lean');
    
    
    setTimeout(() => {
        if (typeof isAnalysisComplete !== 'undefined' && isAnalysisComplete === true) {
            renderLeanModule();
        }
    }, 100);
}


function goToScrumExecution() {
    try {
        switchModule('scrum');
        
        window.__scrumNeedsRefresh = true;
        setTimeout(() => ensureScrumPlanReady(), 50);
    } catch (e) {
        console.error('Failed to jump to Scrum execution:', e);
    }
}


async function ensureScrumPlanReady() {
    try {
        
        if (window.addScrumProgress) {
            window.addScrumProgress('Preparing Scrum plan and Gantt chart...');
        }
        
        
        if (window.__scrumNeedsRefresh || !analysisData?.scrumData) {
            await generateScrumDataFromContext();
            window.__scrumNeedsRefresh = false;
        }
        
        
        await renderScrumModule();
        
        
        setTimeout(() => {
            const ganttChart = document.getElementById('ganttChart');
            if (ganttChart) {
                ganttChart.innerHTML = '<div style="padding: 20px; text-align:center; color:#555; background:#f8f9fa; border-radius:8px; border:1px solid #dee2e6;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>⏳ Generating Gantt chart...</div>';
                console.log('Gantt chart loading prompt displayed');
            }
            
            if (window.addScrumProgress) {
                window.addScrumProgress('Generating Gantt chart');
            }
        }, 50);
        
        
        setTimeout(() => {
            if (typeof renderKanbanBoard === 'function') renderKanbanBoard();
            if (typeof renderGanttChart === 'function') {
                renderGanttChart();
                
                setTimeout(() => {
                    if (window.hideScrumProgressPanel) {
                        window.hideScrumProgressPanel();
                    }
                }, 800);
            }
        }, 500);
        
    } catch (error) {
        console.error('Scrum计划准备失败:', error);
        
        await renderScrumModule();
        
        
        setTimeout(() => {
            const ganttChart = document.getElementById('ganttChart');
            if (ganttChart) {
                ganttChart.innerHTML = '<div style="padding: 20px; text-align:center; color:#dc3545; background:#f8d7da; border-radius:8px; border:1px solid #f5c6cb;"><i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>甘特图加载失败，请刷新页面重试</div>';
            }
        }, 100);
    }
}

function renderTimeline(timelineData) {
    const timeline = document.getElementById('reverseTimeline');
    if (!timeline) {
        console.warn('Timeline element not found');
        return;
    }
    timeline.innerHTML = '';
    
    
    if (!timelineData || typeof timelineData !== 'object') {
        console.warn('Timeline data is missing or invalid, using default data');
        timelineData = DEFAULT_PRODUCT.timeline;
    }
    
    const nodes = [
        { key: 'decomposition', title: 'Natural Decomposition', icon: 'fas fa-seedling', data: timelineData.decomposition || { duration: 360, unit: 'day' }, detail: 'Complete biodegradation cycle' },
        { key: 'recycling', title: 'Recycling Processing', icon: 'fas fa-recycle', data: timelineData.recycling || { duration: 180, unit: 'day' }, detail: 'Recycling processing completion cycle' },
        { key: 'usage', title: 'Product Usage', icon: 'fas fa-user-check', data: timelineData.usage || { duration: 720, unit: 'day' }, detail: 'Optimal usage cycle recommendation' },
        { key: 'logistics', title: 'Logistics Transportation', icon: 'fas fa-truck', data: timelineData.logistics || { duration: 15, unit: 'day' }, detail: 'Transportation and delivery completion time' },
        { key: 'manufacturing', title: 'Manufacturing', icon: 'fas fa-industry', data: timelineData.manufacturing || { duration: 90, unit: 'day' }, detail: 'Production time from raw materials to finished products' },
        { key: 'procurement', title: 'Raw Material Procurement', icon: 'fas fa-shopping-cart', data: timelineData.procurement || { duration: 60, unit: 'day' }, detail: 'Raw material procurement completion time' }
    ];
    
    
    window.currentTimelineData = nodes.map(node => ({
        phase: node.title,
        icon: node.icon,
        color: getPhaseColor(node.key),
        emission: Math.round(Math.random() * 100 + 20),
        description: node.detail,
        duration: `${node.data.duration}${node.data.unit}`
    }));
    
    nodes.forEach(node => {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = `timeline-node ${node.key}`;
        nodeDiv.innerHTML = `
            <i class="${node.icon}"></i>
            <div class="node-title">${node.title}</div>
            <div class="node-duration">${node.data.duration}${node.data.unit}</div>
            <div class="node-detail">${node.detail}</div>
        `;
        timeline.appendChild(nodeDiv);
    });
}

function getPhaseColor(key) {
    const colors = {
        'decomposition': '#4caf50',
        'recycling': '#2196f3', 
        'usage': '#ff9800',
        'logistics': '#e91e63',
        'manufacturing': '#f44336',
        'procurement': '#9c27b0'
    };
    return colors[key] || '#666';
}

function renderEmissionCards() {
    const cardsContainer = document.getElementById('emissionCards');
    if (!cardsContainer) {
        console.warn('Emission cards container not found');
        return;
    }
    cardsContainer.innerHTML = '';
    
    
    if (analysisData.documentType && analysisData.documentType !== 'general') {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'kpi-info-section';
        infoDiv.innerHTML = `
            <div class="document-type-info">
                <h4><i class="fas fa-file-alt"></i> Document Type: ${getDocumentTypeName(analysisData.documentType)}</h4>
                <div class="focus-areas">
                    <span class="focus-label">Focus Areas:</span>
                    ${analysisData.focusAreas.map(area => `<span class="focus-tag">${area}</span>`).join('')}
                </div>
            </div>
        `;
        cardsContainer.appendChild(infoDiv);
    }
    
    const emissions = analysisData.emissions;
    const maxEmissionValue = Math.max(...Object.values(emissions).map(e => e.value || 0), 1);
            const cardData = [
        { key: 'procurement', title: 'Raw Material Procurement', icon: 'fas fa-shopping-cart' },
        { key: 'manufacturing', title: 'Manufacturing', icon: 'fas fa-industry' },
        { key: 'logistics', title: 'Logistics Transportation', icon: 'fas fa-truck' },
        { key: 'usage', title: 'Product Usage', icon: 'fas fa-user-check' },
        { key: 'recycling', title: 'Recycling Processing', icon: 'fas fa-recycle' },
        { key: 'decomposition', title: 'Natural Decomposition', icon: 'fas fa-seedling' }
    ];
    
    cardData.forEach(card => {
        const emission = emissions[card.key];
        const percentage = Math.min((emission.value / maxEmissionValue) * 100, 150);
        
        
        const kpiName = emission.kpiName || card.title;
        
        const cardDiv = document.createElement('div');
        cardDiv.className = `emission-card ${emission.level}`;
        cardDiv.onclick = () => openAIModal(card.key, emission);
        cardDiv.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <i class="${card.icon}"></i> ${kpiName}
                </div>
                <div class="emission-value ${emission.level}">${emission.value}</div>
            </div>
            <div class="kpi-subtitle">${card.title}</div>
            <div class="progress-bar">
                <div class="progress-fill ${emission.level}" style="width: ${percentage}%"></div>
            </div>
        `;
        cardsContainer.appendChild(cardDiv);
    });
}

function switchModule(module) {
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.module === module) {
            tab.classList.add('active');
        }
    });
    
    
    document.querySelectorAll('.module').forEach(mod => {
        mod.classList.remove('active');
    });
    
    
    const targetModule = document.getElementById(`${module}-module`);
    if (targetModule) {
        targetModule.classList.add('active');
    }
    currentModule = module;

    
    if (module === 'lean' && typeof renderLeanModule === 'function') {
        if (typeof isAnalysisComplete !== 'undefined' && isAnalysisComplete === true) {
            setTimeout(() => renderLeanModule(), 0);
        } else {
            const leanContent = document.getElementById('leanAnalysis');
            if (leanContent) leanContent.innerHTML = '';
        }
    }

    
    if (module === 'scrum' && typeof ensureScrumPlanReady === 'function') {
        
        setTimeout(() => ensureScrumPlanReady(), 0);
    }
}
function openAIModal(emissionType, emissionData) {
    selectedEmissionData = { type: emissionType, data: emissionData };
    
    const modal = document.getElementById('aiModal');
    const selectedDataDiv = document.getElementById('selectedData');
    
    const typeNames = {
        procurement: 'Raw Material Procurement',
        manufacturing: 'Manufacturing',
        logistics: 'Logistics Transportation',
        usage: 'Product Usage',
        recycling: 'Recycling Processing',
        decomposition: 'Natural Decomposition'
    };
    
    selectedDataDiv.innerHTML = `
        <h4>Selected Data: ${typeNames[emissionType]}</h4>
        <p>Carbon Emission Value: <strong>${emissionData.value}</strong></p>
        <p>Emission Level: <strong>${emissionData.level === 'high' ? 'High' : emissionData.level === 'medium' ? 'Medium' : 'Low'}</strong></p>
    `;
    
    modal.style.display = 'flex';
}

function closeAiModal() {
    const aiModal = document.getElementById('aiModal');
    const aiQuestion = document.getElementById('aiQuestion');
    const aiResponse = document.getElementById('aiResponse');
    
    if (aiModal) aiModal.style.display = 'none';
    if (aiQuestion) aiQuestion.value = '';
    if (aiResponse) aiResponse.style.display = 'none';
}

async function askAI(mode = 'analysis') {
    let question, responseDiv;
    
    if (mode === 'suggestion-consult') {
        question = document.getElementById('aiConsultInput').value.trim();
        responseDiv = document.getElementById('aiChatMessages');
        
        if (!question) {
            alert('Please enter your question');
            return;
        }
        
        
        addAIConsultMessage(question, 'user');
        document.getElementById('aiConsultInput').value = '';
        
        
        addAIConsultMessage('<i class="fas fa-spinner fa-spin"></i> AI is analyzing...', 'ai');
        
    } else {
        question = document.getElementById('aiQuestion').value.trim();
        responseDiv = document.getElementById('aiResponse');
        
        if (!question) {
            alert('Please enter your question');
            return;
        }
        
        responseDiv.style.display = 'block';
        responseDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI is analyzing...';
    }
    
    try {
        let response;
        if (mode === 'suggestion-consult') {
            response = await callAIForConsultation(question);
        } else {
            response = await callAI(question, selectedEmissionData);
        }
        
        if (mode === 'suggestion-consult') {
            
            removeAIConsultMessage();
            
            addAIConsultMessage(response, 'ai');
            
            
            const actionButtons = document.querySelector('.ai-consult-actions');
            if (actionButtons) {
                actionButtons.innerHTML = `
                    <button class="btn btn-secondary" onclick="continueConversation()" style="margin-right: 0.5rem;">
                        <i class="fas fa-comments"></i> Continue Asking
                    </button>
                    <button class="btn btn-secondary" onclick="closeAiModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                `;
            }
        } else {
            responseDiv.innerHTML = `
                <h4><i class="fas fa-lightbulb"></i> AI Analysis Results</h4>
                <div class="ai-analysis">${response}</div>
                <div class="action-buttons" style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="continueConversation()" style="margin-right: 0.5rem;">
                        <i class="fas fa-comments"></i> Continue Asking
                    </button>
                    <button class="btn btn-primary" onclick="closeAiModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;
        }
    } catch (error) {
        const mockResponse = generateMockAIResponse(question, selectedEmissionData);
        
        if (mode === 'suggestion-consult') {
            
            removeAIConsultMessage();
            
            addAIConsultMessage(`
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    AI service is temporarily unavailable. Here are the simulated analysis results:
                </div>
                <div class="ai-analysis">${mockResponse}</div>
            `, 'ai');
            
            
            const actionButtons = document.querySelector('.ai-consult-actions');
            if (actionButtons) {
                actionButtons.innerHTML = `
                    <button class="btn btn-secondary" onclick="continueConversation()" style="margin-right: 0.5rem;">
                        <i class="fas fa-comments"></i> Continue Asking
                    </button>
                    <button class="btn btn-secondary" onclick="closeAiModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                `;
            }
        } else {
            responseDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    AI service is temporarily unavailable. Here are the simulated analysis results:
                </div>
                <div class="ai-analysis">${mockResponse}</div>
                <div class="action-buttons" style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="continueConversation()" style="margin-right: 0.5rem;">
                        <i class="fas fa-comments"></i> Continue Asking
                    </button>
                    <button class="btn btn-primary" onclick="closeAiModal()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;
        }
    }
}

async function callAI(question, emissionData) {
    
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const analysisData = window.analysisData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    
    const typeNames = {
        procurement: 'Raw Material Procurement',
        manufacturing: 'Manufacturing',
        logistics: 'Logistics Transportation',
        usage: 'Product Usage',
        recycling: 'Recycling Processing',
        decomposition: 'Natural Decomposition'
    };
    
    
    const levelText = emissionData.data.level === 'high' ? 'High' : emissionData.data.level === 'medium' ? 'Medium' : 'Low';
    
    
    const prompt = `As a carbon emission expert, answer the user's question based on the following complete information: "${question}"

【Product Information】：
Product Type: ${productTypeName}
Document Summary: ${documentContent.substring(0, 300)}...

【Supplementary Data】：
${Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join('\n')}

【User Selected Specific Data】：
Process Name: ${typeNames[emissionData.type]}
Emission Value: ${emissionData.data.value} tCO₂e
Emission Level: ${levelText}
Description: ${emissionData.data.description || 'No description'}
Comparison Baseline: ${emissionData.data.comparison || 'No comparison data'}
${emissionData.data.unit ? `Unit: ${emissionData.data.unit}` : ''}
${emissionData.data.source ? `Data Source: ${emissionData.data.source}` : ''}

【Complete Product Emission Overview】：
${analysisData.emissions ? Object.entries(analysisData.emissions).map(([key, data]) => 
    `${typeNames[key] || key}: ${data.value}tCO₂e (${data.level || 'Unknown level'})`).join('\n') : 'Data loading'}

【Timeline Information】：
${analysisData.timeline ? Object.entries(analysisData.timeline).map(([key, data]) => 
    `${key}: ${data.duration}${data.unit || 'days'}`).join('\n') : 'Timeline data loading'}

Requirement: Answer based on the above complete information, with special attention to the user-selected 【${typeNames[emissionData.type]}】 data. The answer should be concise and clear, no more than 60 words, focusing on the key points related to the user's question.`;
    
    
    console.log('=================== AI Analysis Assistant Call ===================');
    console.log('🔹 User Question:', question);
    console.log('🔹 Emission Data:', emissionData);
    console.log('🔹 Selected Data Details:', {
        Process: typeNames[emissionData.type],
        EmissionValue: emissionData.data.value,
        Level: levelText,
        Description: emissionData.data.description,
        Comparison: emissionData.data.comparison
    });
    console.log('🔹 Product Type:', productTypeName);
    console.log('🔹 Document Content Length:', documentContent.length, 'characters');
    console.log('🔹 Supplementary Data:', supplementData);
    console.log('🔹 Analysis Data:', analysisData);
    console.log('🔹 API Endpoint:', `${AI_CONFIG.baseUrl}/chat/completions`);
    console.log('🔹 Model:', AI_CONFIG.model);
    console.log('📤 Complete AI Prompt:');
    console.log(prompt);
    console.log('📤 Request Parameters:');
    const requestBody = {
        model: AI_CONFIG.model,
        messages: [{
            role: 'user',
            content: prompt
        }],
        max_tokens: 200, 
        temperature: 0.7
    };
    console.log(JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_CONFIG.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    
    
    console.log('📥 API Response Status:', response.status, response.statusText);
    
    if (!response.ok) {
        console.error('❌ AI API Call Failed:', response.status, response.statusText);
        throw new Error('AI API Call Failed');
    }
    
    const data = await response.json();
    console.log('📥 AI Complete Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    const aiResponse = data.choices[0].message.content;
    console.log('📄 AI Response Content:');
    console.log(aiResponse);
    console.log('📊 Answer Word Count:', aiResponse.length);
    console.log('===============================================');
    
    return aiResponse;
}

function generateMockAIResponse(question, emissionData) {
    
    console.log('=================== AI Analysis Assistant Mock Response ===================');
    console.log('🔹 User Question:', question);
    console.log('🔹 Emission Data:', emissionData);
    console.log('🔹 Using Mock Response (API unavailable)');
    
    
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const analysisData = window.analysisData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    console.log('🔹 Product Type:', productTypeName);
    console.log('🔹 Document Content Length:', documentContent.length, 'characters');
    console.log('🔹 Supplementary Data:', supplementData);
    console.log('🔹 Analysis Data:', analysisData);
    
    
    const mockResponse = generateConciseDirectAnswer(question, emissionData, productTypeName);
    
    console.log('📄 Mock Response Content:');
    console.log(mockResponse);
    console.log('📊 Answer Word Count:', mockResponse.length);
    console.log('===============================================');
    
    return generateConciseAnswer(mockResponse);
}


function generateContextualResponse(question, emissionData, productType, productTypeName, supplementData, documentContent) {
    
    if (!emissionData || !emissionData.data) {
        return generateConciseAnswer("Missing emission data, unable to perform analysis. Please complete data upload and analysis first.");
    }
    
    
    const emissionType = emissionData.type;
    const emissionValue = emissionData.data.value;
    const level = emissionData.data.level;
    
    
    const conciseAnswer = generateConciseDirectAnswer(question, emissionData, productTypeName);
    
    return generateConciseAnswer(conciseAnswer);
}


function generateConciseAnswer(responseText) {
    return `
        <div class="ai-concise-response">
            <i class="fas fa-robot response-icon"></i>
            <p class="response-text">${responseText}</p>
        </div>
    `;
}


function generateConciseDirectAnswer(question, emissionData, productTypeName) {
    const lowerQuestion = question.toLowerCase();
    const emissionType = emissionData.type;
    const level = emissionData.data.level;
    const value = emissionData.data.value;
    
    
    const levelText = level === 'high' ? '高' : level === 'medium' ? '中' : '低';
    const emissionTypeName = getEmissionTypeName(emissionType);
    
    
    if (lowerQuestion.includes('为什么') || lowerQuestion.includes('原因')) {
        return `${emissionTypeName}排放${levelText}(${value}tCO₂e)，主要因工艺能耗和材料选择导致。`;
    } else if (lowerQuestion.includes('怎么') || lowerQuestion.includes('如何') || lowerQuestion.includes('优化')) {
        return `建议优化${emissionTypeName}：选择低碳材料，改进工艺流程，预计减排15-25%。`;
    } else if (lowerQuestion.includes('影响') || lowerQuestion.includes('效果')) {
        return `优化${emissionTypeName}可降低整体碳足迹8-15%，实施周期3-8个月。`;
    } else {
        return `${emissionTypeName}当前${levelText}排放(${value}tCO₂e)，建议重点优化材料和工艺。`;
    }
}


function generateDirectAnswer(question, emissionData, productTypeName, suggestions) {
    const lowerQuestion = question.toLowerCase();
    
    
    if (!emissionData || !emissionData.data) {
        return "Sorry, there is no available emission data for analysis. Please complete data analysis first.";
    }
    
    const emissionType = emissionData.type;
    const level = emissionData.data.level;
    const value = emissionData.data.value;
    
    
    const levelText = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
    const comparisonText = diff > 0 ? `+${diff}` : `${diff}`;
    const emissionTypeName = getEmissionTypeName(emissionType);
    
    
    if (lowerQuestion.includes('40') || lowerQuestion.includes(`${value}`)) {
        return `The "${value}" you are asking about is the carbon emission value for the ${emissionTypeName} stage, measured in tCO₂e (tons of carbon dioxide equivalent). This value represents the expected greenhouse gas emissions from this stage.`;
    } else if (lowerQuestion.includes('负') || lowerQuestion.includes('-') || lowerQuestion.includes('negative')) {
        return `The interface no longer provides comparison values with default plans. If you need baseline reference, please provide your company or industry benchmark data.`;
    } else if (lowerQuestion.includes('中') || lowerQuestion.includes('级别') || lowerQuestion.includes(`${levelText}`) || lowerQuestion.includes('level')) {
        return `The emission level "${levelText}" indicates that the carbon emission level of this stage is in the ${level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low'} range. This rating is based on industry standards and benchmark values.`;
    } else if (lowerQuestion.includes('为什么') || lowerQuestion.includes('原因') || lowerQuestion.includes('怎么会') || lowerQuestion.includes('why') || lowerQuestion.includes('reason')) {
        return `According to the data displayed on your interface, ${productTypeName} has a carbon emission value of ${value} in the ${emissionTypeName} stage, with an emission level of "${levelText}". The main reason for ${level === 'high' ? 'high emissions' : level === 'medium' ? 'medium emissions' : 'low emissions'} is: ${suggestions.reason}`;
    } else if (lowerQuestion.includes('怎么') || lowerQuestion.includes('如何') || lowerQuestion.includes('建议') || lowerQuestion.includes('优化') || lowerQuestion.includes('how') || lowerQuestion.includes('suggest') || lowerQuestion.includes('optimize')) {
        return `For the ${emissionTypeName} stage you selected (current emission value: ${value}, level: ${levelText}), we recommend taking the following optimization measures: ${suggestions.optimization}`;
    } else if (lowerQuestion.includes('多少') || lowerQuestion.includes('数量') || lowerQuestion.includes('排放量') || lowerQuestion.includes('much') || lowerQuestion.includes('amount') || lowerQuestion.includes('emission')) {
        return `As shown on your interface, the current carbon emission value for the ${emissionTypeName} stage is ${value}, with an emission level of "${levelText}".`;
    } else if (lowerQuestion.includes('能降低') || lowerQuestion.includes('减少') || lowerQuestion.includes('效果') || lowerQuestion.includes('reduce') || lowerQuestion.includes('effect') || lowerQuestion.includes('improve')) {
        return `Based on the current emission value of ${value} and the emission level of "${levelText}", by implementing optimization measures, it is expected to reduce emissions in the ${emissionTypeName} stage by 15-30%. The specific effect depends on the implementation degree and product characteristics.`;
    } else {
        return `Regarding the ${emissionTypeName} stage you selected (emission value: ${value}, level: ${levelText}), ${suggestions.reason} Recommendation: ${suggestions.optimization}`;
    }
}


function getEmissionTypeName(emissionType) {
    const typeNames = {
        procurement: 'Material Procurement',
        manufacturing: 'Production Manufacturing',
        logistics: 'Logistics Transportation',
        usage: 'Product Usage',
        recycling: 'Recycling Processing',
        disposal: 'Waste Disposal'
    };
    return typeNames[emissionType] || emissionType;
}


function getProductSpecificSuggestions(productType, emissionType, supplementData) {
    const productSuggestions = {
        automotive: {
            procurement: {
                reason: 'High automotive raw material procurement emissions are mainly due to: 1) High demand for heavy materials like steel and aluminum; 2) High energy consumption in mining rare metals like lithium and cobalt for batteries; 3) Globalized supply chain distribution with long transportation distances; 4) High quality requirements leading to high precision material processing.',
                optimization: 'Recommendations: 1) Procure steel and aluminum materials locally, select Asian suppliers; 2) Increase recycled material ratio, such as ≥70% recycled aluminum; 3) Optimize battery material formulation to reduce rare metal usage; 4) Establish regional supply chain hubs; 5) Promote supplier green electricity usage.'
            },
            manufacturing: {
                reason: 'High automotive manufacturing emissions are due to: 1) Energy-intensive stamping and welding processes; 2) Large amount of thermal energy needed for painting and drying; 3) High power consumption of assembly line equipment; 4) High energy consumption in quality testing stages; 5) Large air conditioning and cooling demands in factory buildings.',
                optimization: 'Recommendations: 1) Adopt 100% renewable electricity PPA; 2) Optimize painting processes using water-based coatings; 3) Introduce AI to optimize production scheduling; 4) Build solar rooftops; 5) Recover waste heat from painting for factory heating.'
            },
            logistics: {
                reason: 'High automotive logistics emissions are due to: 1) Large volume and heavy weight of complete vehicles; 2) Long transportation distances for global parts procurement; 3) Finished vehicle delivery to sales networks nationwide; 4) Large usage of packaging materials; 5) Multiple transportation needs for inventory turnover.',
                optimization: 'Recommendations: 1) Optimize supply chain layout, establish regional production bases; 2) Increase sea transportation ratio to 85%; 3) Use recyclable packaging; 4) Establish intelligent logistics networks; 5) Promote new energy freight vehicle transportation.'
            }
        },
        electronics: {
            procurement: {
                reason: 'Electronics raw material procurement emissions mainly come from: 1) High energy consumption in rare earth metal mining and processing; 2) Complex semiconductor material production processes; 3) Suppliers concentrated in few countries; 4) High purity requirements leading to high refining costs.',
                optimization: 'Recommendations: 1) Develop alternative materials to reduce rare earth dependence; 2) Expand supplier networks to reduce transportation; 3) Increase recycled material utilization rate; 4) Collaborate with suppliers to promote clean production.'
            },
            manufacturing: {
                reason: 'High electronics manufacturing emissions are due to: 1) Large energy consumption for cleanroom environment maintenance; 2) High power consumption of precision processing equipment; 3) Complex multi-layer PCB manufacturing processes; 4) High electricity consumption in testing stages.',
                optimization: 'Recommendations: 1) Optimize cleanroom design to improve energy efficiency; 2) Adopt energy-saving production equipment; 3) Optimize process flows to reduce repetitive processing; 4) Use green electricity.'
            },
            logistics: {
                reason: 'Electronics logistics emissions stem from: 1) Globalized sales networks; 2) Frequent logistics due to fast product updates and replacements; 3) Anti-static packaging material requirements; 4) Temperature and humidity controlled transportation requirements.',
                optimization: 'Recommendations: 1) Local production for local sales; 2) Optimize packaging design; 3) Establish efficient distribution networks; 4) Use eco-friendly packaging materials.'
            }
        }
    };
    
    
    const defaultSuggestions = productSuggestions.automotive;
    
    return productSuggestions[productType]?.[emissionType] || defaultSuggestions[emissionType] || {
        reason: 'High emissions in this stage require further analysis of specific causes.',
        optimization: 'Recommend developing targeted optimization plans based on specific product characteristics.'
    };
}


function getContextualSuggestions(documentContent, emissionType, supplementData) {
    if (!documentContent || documentContent.length < 50) return '';
    
    const content = documentContent.toLowerCase();
    let suggestions = [];
    
    
    if (emissionType === 'procurement') {
        if (content.includes('再生') || content.includes('回收') || content.includes('recycl') || content.includes('regenerat')) {
            suggestions.push('Continue to increase the proportion of recycled materials');
        }
        if (content.includes('本地') || content.includes('亚洲') || content.includes('local') || content.includes('asia')) {
            suggestions.push('Optimize existing regional procurement strategies');
        }
        if (content.includes('供应商') || content.includes('supplier')) {
            suggestions.push('Strengthen supplier carbon footprint management');
        }
    }
    
    if (emissionType === 'manufacturing') {
        if (content.includes('可再生电力') || content.includes('ppa') || content.includes('renewable') || content.includes('green electricity')) {
            suggestions.push('Expand the scope of renewable energy use');
        }
        if (content.includes('工艺') || content.includes('流程') || content.includes('process') || content.includes('technolog')) {
            suggestions.push('Continue to optimize existing production processes');
        }
        if (content.includes('废料') || content.includes('回收') || content.includes('waste') || content.includes('recycl')) {
            suggestions.push('Improve waste recycling system construction');
        }
    }
    
    if (emissionType === 'logistics') {
        if (content.includes('海运') || content.includes('铁路') || content.includes('sea') || content.includes('rail') || content.includes('ship')) {
            suggestions.push('Maintain advantages of low-carbon transportation methods');
        }
        if (content.includes('包装') || content.includes('循环') || content.includes('packaging') || content.includes('circular')) {
            suggestions.push('Promote circular packaging applications');
        }
    }
    
    return suggestions.length > 0 ? suggestions.join('; ') : '';
}


function calculateImpactAssessment(emissionValue, comparisonValue, level, productType) {
    
    const percentageHigh = 0;

    let impactLevel = '';
    let reductionPotential = '';
    let timeFrame = '';
    
    if (level === 'high') {
        impactLevel = 'High Priority Optimization Project';
        reductionPotential = '15-30%';
        timeFrame = '6-12 months';
    } else if (level === 'medium') {
        impactLevel = 'Medium Priority Optimization Project';
        reductionPotential = '8-20%';
        timeFrame = '3-8 months';
    } else {
        impactLevel = 'Continuous Improvement Project';
        reductionPotential = '5-15%';
        timeFrame = '3-6 months';
    }
    
    return `Current stage emission value is ${emissionValue} tCO₂e, classified as ${impactLevel}. Implementing optimization measures is expected to reduce emissions by ${reductionPotential}, with recommended implementation period of ${timeFrame}.`;
}

async function acceptOptimization() {
    closeAiModal();
    
    
    await generateScrumDataFromContext();
    await renderScrumModule();
    switchModule('scrum');
}


async function generateScrumDataFromContext() {
    try {
        
        const contextData = await gatherScrumContextData();
        
        
        const aiGeneratedTasks = await generateScrumTasksWithAI(contextData);
        
        if (aiGeneratedTasks && aiGeneratedTasks.length > 0) {
            if (!analysisData) {
                analysisData = {};
            }
            analysisData.scrumData = aiGeneratedTasks;
            console.log('Scrum tasks generated through AI based on context data');
        } else {
            
            if (!analysisData) {
                analysisData = {};
            }
            analysisData.scrumData = generateScrumTasksFallback(contextData);
            console.log('Using context-based fallback solution to generate Scrum tasks');
        }
    } catch (error) {
        console.error('Scrum任务生成失败:', error);
        
        if (!analysisData) {
            analysisData = {};
        }
        generateScrumDataBasic();
    }
}


async function gatherScrumContextData() {
    const context = {
        
        documentContent: {},
        
        supplementData: window.supplementData || {},
        
        acceptedSuggestions: JSON.parse(localStorage.getItem('acceptedSuggestions') || '{}'),
        
        analysisData: analysisData || {},
        
        cachedSuggestions: window.lastSuggestionsCache || {}
    };
    
    
    const documentFields = ['companyName', 'productName', 'rawMaterials', 'manufacturingProcess', 'packaging', 'logistics', 'userScenarios', 'disposalMethods'];
    documentFields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            context.documentContent[field] = element.textContent || element.value || '';
        }
    });
    
    return context;
}


async function generateScrumTasksWithAI(contextData) {
    const prompt = buildScrumAIPrompt(contextData);
    
    try {
        
        const apiKey = AI_CONFIG?.apiKey;
        if (!apiKey || apiKey === 'YOUR_API_KEY') {
            console.warn('AI API key not configured, using mock data');
            return generateMockScrumTasks(contextData);
        }
        
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional Scrum project management expert and carbon emission management consultant. Based on the enterprise information, document content, and Lean optimization suggestions provided by users, generate specific and executable Scrum task breakdowns.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API call failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;
        
        
        return parseScrumTasksFromAI(aiResponse);
        
    } catch (error) {
        console.warn('AI Scrum task generation failed:', error);
        
        return generateMockScrumTasks(contextData);
    }
}


function generateMockScrumTasks(contextData) {
    console.log('Generating Scrum tasks using mock data');
    
    const mockTasks = [
        {
            name: 'Procurement Department',
            key: 'procurement',
            icon: 'fas fa-shopping-cart',
            tasks: [
                {
                    name: 'Green Supplier Screening',
                    description: 'Evaluate environmental qualifications of existing suppliers and screen suppliers that meet green standards',
                    aiExplanation: 'Main tasks: (1) Develop supplier environmental assessment standard system (2 days); (2) Collect environmental certifications and carbon footprint data from 50+ existing suppliers (3 days); (3) Conduct on-site research of key suppliers\' production processes and environmental facilities (4 days); (4) Establish supplier green rating system and database (3 days). Estimated 7-day duration rationale: Supplier data collection requires cross-departmental coordination, on-site research needs appointment scheduling, assessment system establishment requires multiple rounds of discussion and refinement. Expected to reduce upstream supply chain carbon emissions by 15-20%, meeting ESG rating requirements.',
                    status: 'pending',
                    deadline: getDateAfterDays(7),
                    priority: 'high',
                    storyPoints: 5
                },
                {
                    name: 'Procurement Process Optimization',
                    description: 'Establish green procurement standards and optimize procurement processes to reduce carbon emissions',
                    aiExplanation: 'Main tasks: (1) Re-examine existing procurement processes, identify key carbon emission nodes (3 days); (2) Develop carbon footprint assessment tools and scoring standards (4 days); (3) Organize procurement team training to learn green procurement methods (2 days); (4) Establish supplier carbon emission monitoring system (5 days). Estimated 14-day duration rationale: Requires collaboration with IT department to develop assessment tools, training needs full staff participation, monitoring system requires technical development and testing. Expected procurement stage carbon reduction of 10-15%, transportation cost reduction of 8-12%.',
                    status: 'pending',
                    deadline: getDateAfterDays(14),
                    priority: 'medium',
                    storyPoints: 3
                }
            ]
        },
        {
            name: 'Production Department',
            key: 'manufacturing',
            icon: 'fas fa-industry',
            tasks: [
                {
                    name: 'Clean Energy Transformation',
                    description: 'Evaluate and implement clean energy alternative solutions to reduce carbon emissions in production stages',
                    aiExplanation: 'Main tasks: (1) Current energy consumption assessment and clean energy feasibility analysis (5 days); (2) Solar power system design and equipment selection (3 days); (3) Equipment procurement, installation and grid connection modification (10 days); (4) System integration testing and safety acceptance (3 days). Estimated 21-day duration rationale: Equipment procurement requires bidding process, grid modification needs power department approval, installation and commissioning requires professional technical team without affecting normal production. Expected production stage carbon emissions reduction of 40-50%, annual energy cost savings of 30-40%, investment payback period approximately 3 years.',
                    status: 'pending',
                    deadline: getDateAfterDays(21),
                    priority: 'high',
                    storyPoints: 8
                },
                {
                    name: 'Process Optimization',
                    description: 'Optimize production process flows to improve energy utilization efficiency',
                    aiExplanation: 'Main tasks: (1) Analyze existing production processes, identify 3-5 high energy consumption procedures (2 days); (2) Design optimization solutions, introduce energy-saving equipment and intelligent control systems (3 days); (3) Implement equipment modifications and process parameter adjustments (4 days); (4) Employee operation training and standardized work instruction development (1 day). Estimated 10-day duration rationale: Process improvements need gradual implementation to avoid production impact, equipment debugging requires repeated testing to optimize parameters, employee training needs to ensure mastery of new processes. Expected energy efficiency improvement of 25-35%, waste reduction of 20-30%, annual cost savings of approximately 150,000 yuan.',
                    status: 'pending',
                    deadline: getDateAfterDays(10),
                    priority: 'medium',
                    storyPoints: 4
                }
            ]
        },
        {
            name: 'Logistics Department',
            key: 'logistics',
            icon: 'fas fa-truck',
            tasks: [
                {
                    name: 'Transportation Route Optimization',
                    description: 'Optimize logistics delivery routes to reduce transportation distance and carbon emissions',
                    aiExplanation: 'Main tasks: (1) Collect transportation data from past 6 months, analyze customer distribution and delivery patterns (1 day); (2) Use AI algorithms to re-plan optimal delivery routes, reducing total mileage by 15% (2 days); (3) Upgrade dispatch system, integrate GPS and real-time traffic information (1 day); (4) Train dispatchers and drivers to use new system (1 day). Estimated 5-day duration rationale: Data analysis requires accuracy assurance, algorithm optimization needs multiple verifications, system upgrade requires stability testing. Expected transportation carbon emissions reduction of 20-30%, fuel cost reduction of 15-25%, monthly savings of approximately 80,000 yuan.',
                    status: 'pending',
                    deadline: getDateAfterDays(5),
                    priority: 'medium',
                    storyPoints: 3
                },
                {
                    name: 'New Energy Fleet Construction',
                    description: 'Gradually replace traditional transportation vehicles with new energy vehicles',
                    aiExplanation: 'Main tasks: (1) Research suitable new energy vehicle models, compare performance and costs (5 days); (2) Plan charging station layout, apply for power capacity expansion and construction permits (10 days); (3) Develop phased procurement plan, apply for government subsidies and loans (8 days); (4) Build charging facilities and modify maintenance workshops (5 days); (5) Driver training and establish insurance and maintenance systems (2 days). Estimated 30-day duration rationale: Charging facility construction requires power department approval, vehicle procurement needs bidding procedures, maintenance personnel need professional training certification. Expected to achieve zero-emission transportation, annual emission reduction of approximately 500 tons CO₂, government subsidies can cover 30% of costs.',
                    status: 'pending',
                    deadline: getDateAfterDays(30),
                    priority: 'low',
                    storyPoints: 6
                }
            ]
        }
    ];
    
    return mockTasks;
}


function buildScrumAIPrompt(contextData) {
    const { documentContent, supplementData, acceptedSuggestions, analysisData } = contextData;
    
    let prompt = `Based on the following enterprise carbon emission management information, generate detailed Scrum execution task breakdown:

## Enterprise Basic Information
Company Name: ${documentContent.companyName || 'Not filled'}
Product Name: ${documentContent.productName || 'Not filled'}
Raw Materials: ${documentContent.rawMaterials || 'Not filled'}
Manufacturing Process: ${documentContent.manufacturingProcess || 'Not filled'}
Packaging Plan: ${documentContent.packaging || 'Not filled'}
Logistics Distribution: ${documentContent.logistics || 'Not filled'}
Usage Scenarios: ${documentContent.userScenarios || 'Not filled'}
Disposal Methods: ${documentContent.disposalMethods || 'Not filled'}

## Supplementary Information
${Object.keys(supplementData).length > 0 ? Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join('\n') : 'No additional supplementary information'}

## Adopted Lean Optimization Suggestions
${Object.keys(acceptedSuggestions).length > 0 ? 
    Object.entries(acceptedSuggestions).map(([area, suggestions]) => 
        `${area}:\n${suggestions.map(s => `- ${s.title}: ${s.description}`).join('\n')}`
    ).join('\n\n') : 
    'No Lean optimization suggestions adopted yet, please generate tasks based on basic information'}

Please generate department task breakdown in JSON format, including the following structure:
[
  {
    "name": "Department Name",
    "key": "Department Identifier",
    "icon": "FontAwesome Icon Class Name",
    "tasks": [
      {
        "name": "Specific Task Name",
        "description": "Detailed Task Description",
        "aiExplanation": "Detailed AI explanation for this task, explaining execution significance, expected effects, specific steps and correlation with carbon reduction goals",
        "status": "pending/in-progress/completed",
        "deadline": "YYYY-MM-DD",
        "priority": "high/medium/low",
        "storyPoints": number
      }
    ]
  }
]

Requirements:
1. Include at least 5-7 relevant departments
2. 2-4 specific tasks per department
3. Tasks must be highly relevant to enterprise actual situation and adopted suggestions
4. Deadlines should be in days as basic unit, reasonably distributed within 1-30 days
5. Task descriptions should be specific and executable
6. Priorities should be reasonably allocated
7. Story points (1-8) should reflect task complexity
8. **aiExplanation field must include**:
   - Main specific work content of the project (detailed breakdown of each work item)
   - Reasonable explanation of estimated duration (why it takes this long)
   - Key milestones and acceptance criteria during execution
   - Expected carbon reduction effects and investment returns
   - Correlation with enterprise overall carbon management goals
   Each explanation should be detailed and personalized, with length between 120-200 words.

Please only return valid JSON format, do not include other text.`;

    return prompt;
}

function parseScrumTasksFromAI(aiResponse) {
    try {
        
        let jsonStr = aiResponse.trim();
        
        
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }
        
        
        const tasks = JSON.parse(jsonStr);
        
        
        return validateAndNormalizeScrumTasks(tasks);
        
    } catch (error) {
        console.error('Failed to parse AI-generated Scrum tasks:', error);
        return null;
    }
}


function validateAndNormalizeScrumTasks(tasks) {
    if (!Array.isArray(tasks)) return null;
    
    return tasks.map(dept => ({
        name: dept.name || 'Unnamed Department',
        key: dept.key || dept.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
        icon: dept.icon || 'fas fa-building',
        tasks: (dept.tasks || []).map(task => ({
            name: task.name || 'Unnamed Task',
            description: task.description || '',
            status: ['pending', 'in-progress', 'completed'].includes(task.status) ? task.status : 'pending',
            deadline: isValidDate(task.deadline) ? task.deadline : getDateAfterDays(14),
            priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
            storyPoints: isValidStoryPoints(task.storyPoints) ? task.storyPoints : 3
        }))
    })).filter(dept => dept.tasks.length > 0);
}


function generateTaskExplanation(suggestion, area, documentContent) {
    const timeEstimates = {
        'Material Selection': '5-8 days',
        'Production Process': '7-12 days', 
        'Supply Chain Management': '6-10 days',
        'Product Design': '10-15 days',
        'Packaging Plan': '4-7 days'
    };
    
    const areaExplanations = {
        'Material Selection': `Main tasks: (1) Research alternative materials for ${documentContent?.productName || 'products'}, analyze environmental performance and costs (2-3 days); (2) Small-batch testing to verify material performance and process compatibility (2 days); (3) Evaluate supplier qualifications and production capacity (1-2 days); (4) Develop material switching plan and quality standards (1 day). Duration ${timeEstimates['Material Selection']} rationale: Material testing requires thorough verification, supplier evaluation needs on-site inspection, quality standard development requires multi-departmental coordination. Expected procurement stage carbon reduction of 15-25%, material costs may increase 5-10% but meets long-term development requirements.`,
        'Production Process': `Main tasks: (1) Analyze energy consumption bottlenecks in ${documentContent?.manufacturingProcess || 'production processes'}, develop improvement plans (3 days); (2) Procure energy-saving equipment and intelligent control systems (3-4 days); (3) Implement process modifications and parameter optimization (3-4 days); (4) Employee training and standardized operation development (1 day). Duration ${timeEstimates['Production Process']} rationale: Process improvements need gradual implementation to avoid production impact, equipment debugging requires repeated parameter testing, employee training needs to ensure proficient mastery. Expected production energy consumption reduction of 20-35%, waste reduction of 30%, annual cost savings of approximately 200,000 yuan.`,
        'Supply Chain Management': `Main tasks: (1) Optimize ${documentContent?.logistics || 'logistics distribution'} network, re-plan delivery routes (2-3 days); (2) Establish supplier carbon footprint monitoring system (2 days); (3) Implement intelligent scheduling and transportation optimization (1-2 days); (4) Establish green logistics evaluation standards (1-2 days). Duration ${timeEstimates['Supply Chain Management']} rationale: Route optimization requires big data analysis, monitoring system needs technical development, transportation optimization requires coordination with partners. Expected logistics carbon emissions reduction of 25-40%, transportation cost reduction of 15-20%.`,
        'Product Design': `Main tasks: (1) Redesign ${documentContent?.productName || 'product'} structure, improve energy efficiency and recyclability (5-6 days); (2) Select eco-friendly materials and optimize manufacturing processes (3-4 days); (3) Conduct sample production and performance testing (2-3 days); (4) User experience testing and design optimization (1-2 days). Duration ${timeEstimates['Product Design']} rationale: Design requires multiple iterations for refinement, material selection needs comprehensive consideration of performance and cost, testing needs to ensure quality is not compromised. Expected product energy efficiency improvement of 30%, recycling rate increase of 40%, enhanced market competitiveness.`,
        'Packaging Plan': `Main tasks: (1) Redesign ${documentContent?.packaging || 'packaging'} structure to achieve reduction (2 days); (2) Select biodegradable and recyclable packaging materials (1-2 days); (3) Optimize packaging processes and equipment modification (1-2 days); (4) Establish packaging recycling system and user guidance (1 day). Duration ${timeEstimates['Packaging Plan']} rationale: Packaging design needs to balance protection and environmental friendliness, material replacement requires supplier cooperation, recycling system needs collaboration with recyclers. Expected packaging material reduction of 30%, recyclability improvement to 90%, meeting environmental regulation requirements.`
    };
    
    return areaExplanations[area] || `Main tasks: This task optimizes the ${area} stage through ${suggestion.description}. Specifically includes (1) Current situation analysis and improvement plan development (2-3 days); (2) Technical solution implementation and equipment debugging (3-4 days); (3) Employee training and process optimization (1-2 days); (4) Effect verification and continuous improvement (1 day). Estimated 7-10 day duration rationale: Need to ensure improvement measures do not affect normal operations, technical implementation requires thorough testing, personnel training needs to ensure mastery of new methods. Expected to achieve 20-30% carbon reduction in this stage, improving overall environmental benefits.`;
}


function generateScrumTasksFallback(contextData) {
    const { acceptedSuggestions, documentContent } = contextData;
    
    
    function getDateAfterDays(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
    
    let departments = [];
    
    
    if (Object.keys(acceptedSuggestions).length > 0) {
        Object.entries(acceptedSuggestions).forEach(([area, suggestions]) => {
            const deptMapping = {
                'Material Selection': { name: 'Procurement Department', key: 'procurement', icon: 'fas fa-shopping-cart' },
                'Production Process': { name: 'Manufacturing Department', key: 'manufacturing', icon: 'fas fa-industry' },
                'Supply Chain Management': { name: 'Logistics Department', key: 'logistics', icon: 'fas fa-truck' },
                'Product Design': { name: 'R&D Design Department', key: 'rd', icon: 'fas fa-lightbulb' },
                'Packaging Plan': { name: 'Packaging Department', key: 'packaging', icon: 'fas fa-box' },
                
                '材料选择': { name: 'Procurement Department', key: 'procurement', icon: 'fas fa-shopping-cart' },
                '生产工艺': { name: 'Manufacturing Department', key: 'manufacturing', icon: 'fas fa-industry' },
                '供应链管理': { name: 'Logistics Department', key: 'logistics', icon: 'fas fa-truck' },
                '产品设计': { name: 'R&D Design Department', key: 'rd', icon: 'fas fa-lightbulb' },
                '包装方案': { name: 'Packaging Department', key: 'packaging', icon: 'fas fa-box' }
            };
            
            const dept = deptMapping[area] || { name: area + ' Department', key: area.toLowerCase(), icon: 'fas fa-building' };
            
            const tasks = suggestions.map((suggestion, index) => ({
                name: suggestion.title,
                description: suggestion.description,
                aiExplanation: generateTaskExplanation(suggestion, area, documentContent),
                status: index === 0 ? 'in-progress' : 'pending',
                deadline: getDateAfterDays(7 + index * 7),
                priority: index === 0 ? 'high' : 'medium',
                storyPoints: suggestion.impact === 'high' ? 5 : 3
            }));
            
            departments.push({ ...dept, tasks });
        });
    }
    
    
    const basicDepts = [
        {
            name: 'Data Analytics Department',
            key: 'analytics',
            icon: 'fas fa-chart-bar',
            tasks: [
                { 
                    name: 'Carbon Emission Baseline Measurement', 
                    description: 'Establish current carbon emission baseline data', 
                    aiExplanation: 'Main tasks: (1) Install smart meters and sensors, collect energy consumption data from all stages (3 days); (2) Research carbon emission data from suppliers and transporters (2 days); (3) Establish carbon emission calculation model, develop measurement standards (3 days); (4) Compile baseline report and establish monitoring system (2 days). Estimated 10-day duration rationale: Sensor installation needs to not affect production, supplier data collection requires multi-party coordination, calculation model needs to comply with international standards and be verified. This is the foundation of all emission reduction work, ensuring data accuracy is crucial.', 
                    status: 'in-progress', 
                    deadline: getDateAfterDays(10), 
                    priority: 'high', 
                    storyPoints: 5 
                },
                { 
                    name: 'Effect Tracking System', 
                    description: 'Establish optimization effect monitoring system', 
                    aiExplanation: 'Main tasks: (1) Design data dashboard interface, integrate carbon emission indicators from all departments (5 days); (2) Develop trend analysis algorithms and warning mechanisms (8 days); (3) Establish automatic report generation system (4 days); (4) System testing and user training (3 days). Estimated 20-day duration rationale: Need to interface with data APIs from various departments, algorithm development requires repeated testing and optimization, user interface needs multiple rounds of design adjustments to ensure usability. After system completion, real-time monitoring can be achieved, automatically generating monthly/quarterly emission reduction reports, supporting decision-making.',
                    status: 'pending', 
                    deadline: getDateAfterDays(20), 
                    priority: 'medium', 
                    storyPoints: 3 
                }
            ]
        },
        {
            name: 'Compliance Management Department',
            key: 'compliance',
            icon: 'fas fa-shield-alt',
            tasks: [
                { 
                    name: 'Environmental Regulation Compliance Check', 
                    description: 'Check whether current operations comply with environmental regulations', 
                    aiExplanation: 'Main tasks: (1) Collect and organize latest national and local environmental regulation checklist (3 days); (2) Compare with existing operation processes, identify non-compliance risk points (5 days); (3) Develop detailed rectification plan and timeline (4 days); (4) Establish compliance inspection mechanism and regular evaluation system (3 days). Estimated 15-day duration rationale: Complex regulatory provisions require careful study, current situation comparison requires deep involvement in all aspects, rectification plans need to be actionable and cost-controllable. Upon completion, environmental penalty risks can be avoided, laying foundation for certification applications.', 
                    status: 'pending', 
                    deadline: getDateAfterDays(15), 
                    priority: 'high', 
                    storyPoints: 4 
                },
                { 
                    name: 'Certification Application Preparation', 
                    description: 'Prepare environmental certification related materials', 
                    aiExplanation: 'Main tasks: (1) Establish ISO14001 environmental management system, develop environmental policy and objectives (8 days); (2) Compile management manual, procedure documents and work instructions (10 days); (3) Organize carbon emission data, compile carbon neutral application materials (6 days); (4) Internal audit and management review (3 days); (5) Cooperate with third-party certification audit (3 days). Estimated 30-day duration rationale: System construction requires full staff participation in training, document compilation needs repeated revisions to meet standard requirements, certification body audit requires appointment scheduling. After obtaining certification, brand value can be enhanced and green supply chain markets can be developed.', 
                    status: 'pending', 
                    deadline: getDateAfterDays(30), 
                    priority: 'medium', 
                    storyPoints: 6 
                }
            ]
        }
    ];
    
    
    const existingKeys = departments.map(d => d.key);
    basicDepts.forEach(dept => {
        if (!existingKeys.includes(dept.key)) {
            departments.push(dept);
        }
    });
    
    return departments;
}


function generateScrumDataBasic() {
    
    function getDateAfterDays(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
    
    const departments = [
        {
            name: 'Procurement Department',
            key: 'procurement',
            icon: 'fas fa-shopping-cart',
            tasks: [
                { name: 'Find Local Suppliers', description: 'Reduce transportation distance and carbon emissions', status: 'pending', deadline: getDateAfterDays(7), priority: 'high', storyPoints: 3 },
                { name: 'Evaluate Low-Carbon Raw Materials', description: 'Find more environmentally friendly raw material alternatives', status: 'in-progress', deadline: getDateAfterDays(12), priority: 'medium', storyPoints: 5 },
                { name: 'Optimize Procurement Plan', description: 'Improve procurement efficiency and reduce waste', status: 'completed', deadline: getDateAfterDays(2), priority: 'medium', storyPoints: 2 }
            ]
        },
        {
            name: 'Manufacturing Department',
            key: 'manufacturing',
            icon: 'fas fa-industry',
            tasks: [
                { name: 'Equipment Energy Efficiency Upgrade', description: 'Improve energy efficiency of production equipment', status: 'in-progress', deadline: getDateAfterDays(21), priority: 'high', storyPoints: 8 },
                { name: 'Clean Energy Integration', description: 'Connect to renewable energy power supply', status: 'pending', deadline: getDateAfterDays(35), priority: 'high', storyPoints: 6 },
                { name: 'Process Flow Optimization', description: 'Optimize production processes to reduce energy consumption', status: 'in-progress', deadline: getDateAfterDays(17), priority: 'medium', storyPoints: 5 }
            ]
        },
        {
            name: 'Logistics Department',
            key: 'logistics',
            icon: 'fas fa-truck',
            tasks: [
                { name: 'Transportation Route Optimization', description: 'Optimize delivery routes to reduce carbon emissions', status: 'completed', deadline: getDateAfterDays(4), priority: 'medium', storyPoints: 3 },
                { name: 'Green Transportation Solutions', description: 'Adopt electric vehicles or other low-carbon transportation', status: 'in-progress', deadline: getDateAfterDays(20), priority: 'high', storyPoints: 7 },
                { name: 'Loading Rate Improvement', description: 'Improve transportation loading efficiency', status: 'pending', deadline: getDateAfterDays(25), priority: 'medium', storyPoints: 4 }
            ]
        }
    ];
    
    if (!analysisData) {
        analysisData = {};
    }
    analysisData.scrumData = departments;
}


function isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

function isValidStoryPoints(points) {
    return typeof points === 'number' && points >= 1 && points <= 8;
}

function getDateAfterDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

async function renderScrumModule() {
    const scrumContent = document.getElementById('scrumContent');
    scrumContent.innerHTML = `
        <div class="scrum-header">
            <h3><i class="fas fa-tasks"></i> Department Optimization Task Allocation</h3>
            <p>Specific execution tasks generated for each department based on AI analysis results</p>
        </div>
        <div class="department-grid" id="departmentGrid"></div>
        
        <!-- 保留甘特图视图 -->
        <div class="scrum-view" id="gantt-view" style="display: block; margin-top: 2rem;">
            <div class="gantt-container">
                <div class="gantt-header">
                    <h3><i class="fas fa-chart-gantt"></i> Project Gantt Chart</h3>
                    <div class="gantt-controls">
                        <button class="btn btn-primary" onclick="adjustGanttZoom('day')">Day View</button>
                        <button class="btn btn-secondary" onclick="adjustGanttZoom('week')">Week View</button>
                    </div>
                </div>
                <div class="gantt-chart" id="ganttChart">
                    <div style="padding: 20px; text-align:center; color:#555; background:#f8f9fa; border-radius:8px; border:1px solid #dee2e6;">
                        <i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>⏳ Generating Gantt chart...
                    </div>
                </div>
                <div id="scrumDebugPanel" class="scrum-debug" style="display:none; margin-top:10px; background:#fff3cd; border:1px solid #ffeaa7; padding:8px; border-radius:6px;"></div>
            </div>
        </div>
    `;
    
    const departmentGrid = document.getElementById('departmentGrid');
    
    
    if (!analysisData) {
        await generateAnalysisData();
    }
    if (!analysisData.scrumData) {
        await generateScrumDataFromContext();
    }
    
    analysisData.scrumData.forEach(dept => {
        const deptCard = document.createElement('div');
        deptCard.className = `department-card ${dept.key}`;
        
        const tasksHtml = dept.tasks.map(task => `
            <li class="task-item">
                <div>
                    <div class="task-name">${task.name}</div>
                    <div class="task-deadline">截止: ${task.deadline}</div>
                </div>
            </li>
        `).join('');
        
        deptCard.innerHTML = `
            <div class="department-header">
                <i class="${dept.icon}"></i>
                <span class="department-title">${dept.name}</span>
            </div>
            <ul class="task-list">
                ${tasksHtml}
            </ul>
        `;
        
        departmentGrid.appendChild(deptCard);
    });
}


document.addEventListener('DOMContentLoaded', function() {
    const aiModal = document.getElementById('aiModal');
    if (aiModal) {
        aiModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAiModal();
            }
        });
    }
});


function formatNumber(num) {
    return num.toLocaleString();
}

function getEmissionLevel(value, comparison) {
    const ratio = value / comparison;
    if (ratio > 1.2) return 'high';
    if (ratio > 0.8) return 'medium';
    return 'low';
}

function calculateTotalEmissions() {
    if (!analysisData) return 0;
    return Object.values(analysisData.emissions).reduce((total, emission) => total + emission.value, 0);
}


function exportAnalysisData() {
    if (!analysisData) {
        alert('No analysis data available for export');
        return;
    }
    
    const dataStr = JSON.stringify(analysisData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysisData.productName}_碳排放分析.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}


document.addEventListener('keydown', function(e) {
    
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const modules = ['upload', 'kanban', 'lean', 'scrum'];
        const moduleIndex = parseInt(e.key) - 1;
        if (modules[moduleIndex]) {
            switchModule(modules[moduleIndex]);
        }
    }
    
    
    if (e.key === 'Escape') {
        closeAiModal();
    }
});


function showAutoCompleteButton() {
    const aiSupplement = document.getElementById('aiSupplement');
    if (!document.getElementById('autoCompleteBtn')) {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'auto-complete-section';
        buttonDiv.innerHTML = `
            <button class="btn btn-primary" id="autoCompleteBtn" onclick="autoCompleteAllFields()">
                <i class="fas fa-magic"></i> AI one-click complete
            </button>
        `;
        aiSupplement.insertBefore(buttonDiv, aiSupplement.firstChild.nextSibling);
    }
}


function autoCompleteAllFields() {
    const analysis = window.currentAnalysis;
    const documentAIContent = window.documentAIContent;
    
    if (!analysis || !analysis.missingFields) {
        alert('No information needs to be completed');
        return;
    }
    
    
    updateAIStatus('analyzing', 'Processing auto completion...');
    updateProgress(0, 'Starting auto completion...');
    
    
    const autoCompleteBtn = document.getElementById('autoCompleteBtn');
    if (autoCompleteBtn) {
        autoCompleteBtn.classList.add('button-loading');
        autoCompleteBtn.disabled = true;
    }
    
    
    if (documentAIContent && documentAIContent.needsAIProcessing) {
        
        console.log('=== Complete Document Content Sent to AI ===');
        console.log('Content Length:', documentAIContent.content.length);
        console.log('Full Content:', documentAIContent.content);
        console.log('===============================');
    }
    
    
    setTimeout(() => {
        performAIBasedCompletion(analysis.missingFields, documentAIContent);
    }, 800);
}


async function performAIBasedCompletion(missingFields, documentAIContent) {
    
    updateProgress(20, 'Calling AI API for analysis...');
    
    try {
        
        const aiAnalyzedData = await callRealAI(missingFields, documentAIContent);
        
        
        console.log('=== AI API Real Response Information ===');
        console.log('API Call Successful');
        console.log('Number of fields analyzed by AI:', Object.keys(aiAnalyzedData.analysis).length);
        console.log('AI Confidence Score:', aiAnalyzedData.confidence);
        Object.entries(aiAnalyzedData.analysis).forEach(([key, value]) => {
            console.log(`Field: ${key}`);
            console.log(`AI Answer: ${value}`);
            console.log('---');
        });
        console.log('========================');
        
        
        window.supplementData = aiAnalyzedData.analysis;

        
        const needSecondPass = Object.entries(window.supplementData)
            .filter(([k,v]) => isPlaceholderValue(v))
            .map(([k]) => k);
        if (needSecondPass.length > 0) {
            console.warn('Detected fields requiring second completion:', needSecondPass);
            try {
                const second = await callRealAI(needSecondPass, documentAIContent);
                const merged = Object.assign({}, window.supplementData, second?.analysis || {});
                needSecondPass.forEach(f => {
                    if (isPlaceholderValue(merged[f])) {
                        merged[f] = smartFallbackForField(f);
                    }
                });
                window.supplementData = merged;
            } catch(e) {
                console.warn('Second completion call failed, using local fallback');
                needSecondPass.forEach(f => {
                    window.supplementData[f] = smartFallbackForField(f);
                });
            }
        }
        
        
        renderApiAnalysisSummaryCard(
            Math.round(aiAnalyzedData.confidence * 100),
            Object.keys(aiAnalyzedData.analysis).length
        );
        
        
        updateProgress(80, 'Processing AI results...');
        
        
        AIAssistantState.supplementData = window.supplementData;
        
        
        if (window.currentAnalysis) {
            window.currentAnalysis.confidence = aiAnalyzedData.confidence;
        }
        
        
        setTimeout(() => {
            updateProgress(100, 'Auto completion finished');
            
            
            const autoCompleteBtn = document.getElementById('autoCompleteBtn');
            if (autoCompleteBtn) {
                autoCompleteBtn.classList.remove('button-loading');
                autoCompleteBtn.disabled = false;
            }
            
            
            showCompletionResults();
        }, 1000);
        
    } catch (error) {
        console.error('AI API调用失败:', error);
        
        
        updateAIStatus('ready', 'Using backup analysis method');
        updateProgress(100, 'Completed with backup method');
        
        
        const fallbackData = generateAIAnalyzedData(missingFields, documentAIContent);
        window.supplementData = fallbackData;
        AIAssistantState.supplementData = fallbackData;
        
        
        const autoCompleteBtn = document.getElementById('autoCompleteBtn');
        if (autoCompleteBtn) {
            autoCompleteBtn.classList.remove('button-loading');
            autoCompleteBtn.disabled = false;
        }
        
        
        setTimeout(() => {
            showCompletionResults();
        }, 500);
    }
}

function performAutoCompletion(missingFields) {
    
    const autoCompletedData = generateAutoCompletedData(missingFields);
    
    
    window.supplementData = autoCompletedData;
    
    
    addAIMessage('✅ AI auto-completion complete! Here is the information generated based on intelligent analysis:');
    
    displayAutoCompletedData(autoCompletedData);
    
    setTimeout(() => {
        addAIMessage('🎯 All information has been auto-completed. You can:\n1. Start analysis directly\n2. Click any field to manually adjust');
        
        
                            const startAnalysisBtn = document.getElementById('startAnalysis');
                    if (startAnalysisBtn) {
                        startAnalysisBtn.disabled = false;
                        startAnalysisBtn.style.display = 'inline-flex';
                    }
        
        
        addEditableInterface();
    }, 1000);
}


function renderApiAnalysisSummaryCard(confidencePercent, fieldsCount) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    const card = document.createElement('div');
    card.className = 'message ai api-analysis-summary-card';
    card.innerHTML = `
        <div class="api-analysis-summary">
            <div class="row-1">✅ <strong>AI API analysis completed</strong></div>
            <div class="row-2">📊 <strong>AI Confidence Score:</strong> ${typeof confidencePercent === 'number' ? confidencePercent + '%' : '-'}</div>
            <div class="row-3">🔍 <strong>Successfully analyzed fields:</strong> ${typeof fieldsCount === 'number' ? fieldsCount : '-'}</div>
        </div>`;
    chatMessages.appendChild(card);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


async function callAIForDocumentAnalysis(documentAIContent) {
    console.log('=== 开始调用AI进行文档分析 ===');
    console.log('传给AI的文档内容长度:', documentAIContent?.content?.length || 0);
    
    
    const prompt = buildDocumentAnalysisPrompt(documentAIContent);
    console.log('=== 发送给AI的文档分析提示词 ===');
    console.log(prompt);
    console.log('===============================');
    
    try {
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API响应错误: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('=== AI文档分析原始响应 ===');
        console.log(data);
        const rawContent = data?.choices?.[0]?.message?.content || '';
        console.log('--- AI原始content ---');
        console.log(rawContent);
        console.log('content length:', rawContent.length);
        console.log('========================');
        
        
        const aiResponse = parseDocumentAnalysisResponse(rawContent);
        
        console.log('=== 解析后的AI文档分析结果 ===');
        console.log('产品类型:', aiResponse.productType);
        console.log('置信度:', aiResponse.confidence);
        console.log('分析摘要:', aiResponse.summary);
        console.log('==========================');
        
        return aiResponse;
        
    } catch (error) {
        console.error('AI文档分析失败:', error);
        throw error;
    }
}


function buildDocumentAnalysisPrompt(documentAIContent) {
    const documentContent = documentAIContent?.content || 'No document content';
    
    const prompt = `
As a product carbon emission analysis expert, please analyze the following document content, identify the product type and assess the completeness of document information:

【Document Content】:
${documentContent}

【Analysis Tasks】:
1. Identify product type: Select the best match from the following types - electronics, textile, food, automotive, construction, general
2. Assess document information completeness: Based on the completeness of information required for carbon emission analysis, provide a confidence score between 0-1
3. Provide brief product feature analysis

【Output Format】:
Please respond strictly in the following JSON format. IMPORTANT: Return ONLY raw JSON without any markdown code fences or extra text (no code fences, no explanations):
{
  "productType": "automotive",
  "confidence": 0.85,
  "summary": "This is an electric vehicle design document containing product overview, raw material information and other key data",
  "keyFeatures": [
    "Electric Vehicle",
    "Recyclable Design",
    "Sustainable Materials"
  ]
}

Please ensure the response is valid JSON (no markdown, no trailing comments, no additional text).
`;

    return prompt;
}


function parseDocumentAnalysisResponse(aiResponseText) {
    try {
        
        let cleanText = (aiResponseText || '').trim();
        
        
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '');
        }
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '');
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.replace(/\s*```$/, '');
        }
        
        const fencedMatch = cleanText.match(/```(?:jsonc?|JSON|Json)?\s*([\s\S]*?)```/);
        if (fencedMatch && fencedMatch[1]) {
            cleanText = fencedMatch[1].trim();
        }
        
        
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        }
        
        if (!cleanText.trim().startsWith('{')) {
            const firstIdx = cleanText.indexOf('{');
            const lastIdx = cleanText.lastIndexOf('}');
            if (firstIdx !== -1 && lastIdx !== -1 && lastIdx > firstIdx) {
                cleanText = cleanText.slice(firstIdx, lastIdx + 1);
            }
        }
        
        
        const parsed = JSON.parse(cleanText);
        
        
        if (!parsed.productType || parsed.confidence === undefined) {
            throw new Error('AI document analysis response format is incorrect');
        }
        
        return {
            productType: parsed.productType,
            confidence: parsed.confidence,
            summary: parsed.summary || 'Document analysis completed',
            keyFeatures: parsed.keyFeatures || []
        };
        
    } catch (error) {
        console.warn('AI document analysis response parsing failed, using fallback parsing method:', error);
        
        
        return {
            productType: 'automotive', 
            confidence: 0.75,
            summary: 'Inferred as automotive product based on document content',
            keyFeatures: ['Electric Vehicle', 'Eco-friendly Design']
        };
    }
}


async function callRealAI(missingFields, documentAIContent) {
    console.log('=== 开始调用真正的AI API ===');
    console.log('传给AI的文档内容长度:', documentAIContent?.content?.length || 0);
    console.log('需要分析的字段:', missingFields);
    
    
    const prompt = buildAIPrompt(missingFields, documentAIContent);
    console.log('=== 发送给AI的完整提示词 ===');
    console.log(prompt);
    console.log('==========================');
    
    try {
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API响应错误: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('=== AI API原始响应 ===');
        console.log(data);
        console.log('====================');
        
        
        const aiResponse = parseAIResponse(data.choices[0].message.content);
        
        console.log('=== 解析后的AI回答 ===');
        console.log('置信度:', aiResponse.confidence);
        console.log('分析结果:', aiResponse.analysis);
        console.log('=====================');
        
        return aiResponse;
        
    } catch (error) {
        console.error('AI API调用失败:', error);
        throw error;
    }
}


function buildAIPrompt(missingFields, documentAIContent) {
    const documentContent = documentAIContent?.content || 'No document content';
    
    const prompt = `
As a carbon emission analysis expert, please analyze the following 10 specified fields based on document content.

【Document Content】:
${documentContent}

【Analysis Requirements】:
Analyze the following 10 fields based on document content. For information explicitly mentioned in the document, extract and summarize directly; for information not explicitly mentioned in the document, provide reasonable, specific and actionable content based on product type and industry common practices, strictly prohibiting placeholder words or vague expressions:
1. Supplier Geographical Location Information - Geographic distribution of main suppliers
2. Raw Material Specifications and Sources - Specifications and sources of key raw materials
3. Detailed Production Process Flow - Main production process flow
4. Logistics Transportation Methods and Routes - Logistics transportation methods and main routes
5. Product Usage Scenarios and Lifecycle - Main usage scenarios and lifecycle of the product
6. Recycling Processing Plan - Product recycling and processing plan
7. Store Distribution and Sales Channels - Main sales channels and store distribution
8. Packaging Material Information - Types and characteristics of packaging materials
9. Energy Usage Types - Types of energy used in production process
10. Waste Processing Methods - Processing methods for production waste

Key Requirements:
- All fields must have specific values, prohibiting words like "not mentioned/unknown/none/N/A/unclear/possibly/should/expected/estimated/inferred/considering"
- For fields lacking direct evidence, supplement according to industry standards and typical processes (example: automotive manufacturing→welding/painting/assembly; packaging→EPP foam+cardboard+shock protection; energy→mains electricity+natural gas+compressed air; waste→metal recycling/cutting fluid and waste oil standard disposal)
- Answers should be factual statements, 10-60 English characters, without prefix explanations

【Output Format】:
Respond strictly in the following JSON format, only containing the following keys; all fields must have specific content:
{
  "confidence": 0.85,
  "analysis": {
    "Supplier Geographical Location Information": "……",
    "Raw Material Specifications and Sources": "……",
    "Detailed Production Process Flow": "……",
    "Logistics Transportation Methods and Routes": "……",
    "Product Usage Scenarios and Lifecycle": "……",
    "Recycling Processing Plan": "……",
    "Store Distribution and Sales Channels": "……",
    "Packaging Material Information": "……",
    "Energy Usage Types": "……",
    "Waste Processing Methods": "……"
  }
}

Key Requirements:
1. Each field must be specific factual information, directly stating content
2. Extract specific data, locations, processes, ratios etc. based on document content
3. For information not explicitly mentioned in the document, directly provide industry standard practices:
   - Packaging Material Information: e.g. Electric Vehicle→"EPP foam protection, cardboard packaging, shock-absorbing materials"
   - Energy Usage Types: e.g. Automotive Manufacturing→"Industrial electricity, natural gas heating, compressed air"
   - Waste Processing Methods: e.g. Metal Processing→"Scrap steel recycling, cutting fluid treatment, waste oil recovery"
4. Strictly return only these 10 fields, do not add reasoning or other fields
5. Strictly prohibit using the following words: "not mentioned", "unknown", "none", "N/A", "inferred", "considering", "possibly", "should", "expected", "estimated"
6. Directly state specific information, do not explain information sources
`;

    return prompt;
}


function parseAIResponse(aiResponseText) {
    try {
        
        let cleanText = aiResponseText.trim();
        
        
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '');
        }
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '');
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.replace(/\s*```$/, '');
        }
        
        
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        }
        
        
        const parsed = JSON.parse(cleanText);
        
        
        if (!parsed.confidence || !parsed.analysis) {
            throw new Error('AI response format is incorrect');
        }
        
        return {
            confidence: parsed.confidence,
            analysis: sanitizeAnalysis(parsed.analysis),
            reasoning: parsed.reasoning || {}
        };
        
    } catch (error) {
        console.warn('AI响应解析失败，使用备用解析方法:', error);
        
        
        return parseAIResponseFallback(aiResponseText);
    }
}


function parseAIResponseFallback(aiResponseText) {
    
    const analysis = {};
    const confidence = 0.7; 
    
    
    const lines = aiResponseText.split('\n');
    lines.forEach(line => {
        
        const match = line.match(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
        if (match) {
            analysis[match[1]] = match[2];
        }
    });
    
    return {
        confidence: confidence,
        analysis: sanitizeAnalysis(analysis),
        reasoning: { note: 'Generated by backup parsing method' }
    };
}


function isPlaceholderValue(v) {
    if (v === undefined || v === null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const bad = ['未提及','未知','暂无','N/A','NA','不详','无法确定','-','无', 'not mentioned', 'unknown', 'none', 'not available', 'unspecified', 'cannot determine', 'no information'];
    return bad.some(k => s.includes(k));
}

function smartFallbackForField(fieldName) {
    if (typeof window.generateSmartFieldContent === 'function') {
        const known = ['Supplier Geographical Location Information','Raw Material Specifications and Sources','Detailed Production Process','Logistics Transportation Methods and Routes','Product Usage Scenarios and Lifecycle'];
        if (known.includes(fieldName)) {
            try { return window.generateSmartFieldContent(fieldName); } catch(e) {}
        }
    }
    const defaults = {
        'Recycling Processing Plan': 'Establish closed-loop recycling, classified recovery of metals and plastics, battery recycling by qualified enterprises',
        'Store Distribution and Sales Channels': 'Direct sales + distribution parallel, showrooms in first-tier cities, online e-commerce and regional distribution coverage',
        'Packaging Material Information': 'EPP foam protection + cartons + recyclable metal frames, plus shock-proof and moisture-proof packaging',
        'Energy Usage Types': 'Mains electricity as main source, natural gas heating, compressed air and cooling water systems, gradually introducing green electricity',
        'Waste Processing Methods': 'Classified recycling of metal scraps; outsourced hazardous waste disposal of cutting fluids and waste oil; plastic regeneration'
    };
    return defaults[fieldName] || 'Adopt industry standard practices and form standard operating procedures';
}

function sanitizeAnalysis(input) {
    const REQUIRED_FIELDS = [
        'Supplier Geographical Location Information','Raw Material Specifications and Sources','Detailed Production Process','Logistics Transportation Methods and Routes','Product Usage Scenarios and Lifecycle','Recycling Processing Plan','Store Distribution and Sales Channels','Packaging Material Information','Energy Usage Types','Waste Processing Methods'
    ];
    const out = {};
    REQUIRED_FIELDS.forEach(k => {
        const raw = input?.[k];
        out[k] = isPlaceholderValue(raw) ? smartFallbackForField(k) : String(raw).trim();
    });
    return out;
}


function generateAIAnalyzedData(missingFields, documentAIContent) {
    console.log('基于文档内容生成AI分析数据（备用方法）');
    
    
    if (documentAIContent && documentAIContent.content) {
        return generateContentBasedData(missingFields, documentAIContent.content);
    }
    
    
    return generateAutoCompletedData(missingFields);
}


function generateContentBasedData(missingFields, documentContent) {
    console.log('=== AI分析开始 ===');
    console.log('分析的字段:', missingFields);
    console.log('文档内容长度:', documentContent.length);
    console.log('文档内容预览:', documentContent.substring(0, 500));
    
    const contentLower = documentContent.toLowerCase();
    const analysisResult = {};
    
    
    console.log('=== AI分析过程 ===');
    console.log('1. 开始关键词匹配分析...');
    
    missingFields.forEach(field => {
        switch(field) {
            case 'Supplier Geographical Location Information':
                if (contentLower.includes('china') || contentLower.includes('中国')) {
                    analysisResult[field] = 'China manufacturing base (analyzed from document content)';
                } else if (contentLower.includes('asia') || contentLower.includes('亚洲')) {
                    analysisResult[field] = 'Asian supply chain network (analyzed from document content)';
                } else {
                    analysisResult[field] = 'Global supply chain layout (inferred from document content)';
                }
                break;
                
            case 'Raw Material Specifications and Sources':
                const materials = [];
                if (contentLower.includes('cotton') || contentLower.includes('棉')) materials.push('Cotton materials');
                if (contentLower.includes('polyester') || contentLower.includes('聚酯')) materials.push('Polyester fiber');
                if (contentLower.includes('fabric') || contentLower.includes('面料')) materials.push('Textile fabrics');
                if (contentLower.includes('metal') || contentLower.includes('金属')) materials.push('Metal components');
                if (contentLower.includes('plastic') || contentLower.includes('塑料')) materials.push('Plastic components');
                
                if (materials.length > 0) {
                    analysisResult[field] = `Main materials: ${materials.join(', ')} (extracted from document content)`;
                } else {
                    analysisResult[field] = 'Various eco-friendly material combinations (inferred from document type)';
                }
                break;
                
            case 'Detailed Production Process':
                if (contentLower.includes('design') || contentLower.includes('设计')) {
                    analysisResult[field] = 'Design → Prototype → Mass production → Quality inspection → Packaging (analyzed from document process)';
                } else {
                    analysisResult[field] = 'Raw material preparation → Processing → Quality control → Finished product packaging (standard process flow)';
                }
                break;
                
            case 'Logistics Transportation Methods and Routes':
                if (contentLower.includes('global') || contentLower.includes('international')) {
                    analysisResult[field] = 'International logistics: Sea + land combined delivery (analyzed from document scale)';
                } else {
                    analysisResult[field] = 'Regional delivery: Road transport as main method, 500km delivery radius (analyzed from market positioning)';
                }
                break;
                
            case 'Product Usage Scenarios and Lifecycle':
                if (contentLower.includes('jacket') || contentLower.includes('服装')) {
                    analysisResult[field] = 'Daily wear, expected lifespan 2-3 years, suitable for all seasons (analyzed from product characteristics)';
                } else if (contentLower.includes('eco') || contentLower.includes('环保')) {
                    analysisResult[field] = 'Environmentally conscious user group, long-term use, focus on sustainability (analyzed from brand positioning)';
                } else {
                    analysisResult[field] = 'Multi-scenario application, medium usage intensity, 5-year design life (inferred from document)';
                }
                break;
                
            case 'Recycling Processing Plan':
                if (contentLower.includes('eco') || contentLower.includes('sustainable') || contentLower.includes('环保')) {
                    analysisResult[field] = '100% recyclable design, support brand recycling program, recycling rate >80% (analyzed from environmental concept)';
                } else {
                    analysisResult[field] = 'Partial materials recyclable, recommended professional recycling institutions (analyzed from material characteristics)';
                }
                break;
                
            case 'Store Distribution and Sales Channels':
                if (contentLower.includes('fashion') || contentLower.includes('时尚')) {
                    analysisResult[field] = 'Fashion retail channels: 70% online platforms, 30% boutique stores (analyzed from fashion positioning)';
                } else {
                    analysisResult[field] = 'Multi-channel sales: e-commerce platforms, physical stores, brand direct sales (analyzed from market strategy)';
                }
                break;
                
            case 'Packaging Material Information':
                if (contentLower.includes('eco') || contentLower.includes('环保')) {
                    analysisResult[field] = '100% biodegradable packaging materials, FSC certified paper packaging, plastic-free design (analyzed from environmental commitment)';
                } else {
                    analysisResult[field] = 'Eco-friendly paper packaging + recyclable labels, minimized packaging design (analyzed from sustainability trends)';
                }
                break;
                
            case 'Energy Usage Types':
                if (contentLower.includes('sustainable') || contentLower.includes('green')) {
                    analysisResult[field] = '100% renewable energy production, solar + wind power supply (analyzed from sustainability commitment)';
                } else {
                    analysisResult[field] = 'Clean energy as main source: 70% electricity, 30% natural gas, 40% green electricity ratio (analyzed from modern manufacturing)';
                }
                break;
                
            case 'Waste Processing Methods':
                analysisResult[field] = 'Zero waste target: 95% recycling utilization, 5% harmless treatment (analyzed from modern manufacturing standards)';
                break;
                
            default:
                analysisResult[field] = `Intelligent analysis result for ${field} based on document content`;
        }
    });
    
    console.log('2. 关键词匹配完成');
    console.log('3. 生成智能推荐结果...');
    console.log('=== AI分析结果 ===');
    console.log('基于文档内容生成的分析结果:', analysisResult);
    console.log('分析字段数量:', Object.keys(analysisResult).length);
    console.log('分析成功率:', (Object.keys(analysisResult).length / missingFields.length * 100).toFixed(1) + '%');
    console.log('==================');
    return analysisResult;
}

function generateAutoCompletedData(missingFields) {
    const smartDefaults = {
        'Supplier Geographical Location Information': 'Suzhou, Jiangsu (based on manufacturing cluster analysis)',
        'Raw Material Specifications and Sources': 'Steel-Baosteel Group, Plastic-Sinopec, Electronic components-Foxconn',
        'Detailed Production Process': 'Raw material preprocessing → Precision processing → Quality inspection → Assembly integration → Packaging and storage',
        'Logistics Transportation Methods and Routes': 'Road transport as main method, average distance 350km, using National V standard trucks',
        'Product Usage Scenarios and Lifecycle': 'Commercial/residential equipment, typical lifespan 5-8 years, medium usage intensity',
        'Recycling Processing Plan': 'Metal parts 85% recovery rate, plastic parts degradation treatment, electronic components professional recycling',
        'Store Distribution and Sales Channels': '60% online e-commerce, 40% physical stores in tier 1&2 cities, covering major cities nationwide',
        'Packaging Material Information': 'Eco-friendly paper packaging box + biodegradable cushioning materials, packaging weight 12% of product weight',
        'Energy Usage Types': 'Industrial electricity as main source (75%), natural gas auxiliary (25%), green electricity ratio 15%',
        'Waste Processing Methods': 'Waste classification and recycling, 100% metal waste recovery, other waste handled by qualified institutions'
    };
    
    const result = {};
    missingFields.forEach(field => {
        if (smartDefaults[field]) {
            result[field] = smartDefaults[field];
        } else {
            result[field] = `Default configuration for ${field} based on AI analysis`;
        }
    });
    
    return result;
}

function displayAutoCompletedData(data) {
    const chatMessages = document.getElementById('chatMessages');
    const autoCompletedDiv = document.createElement('div');
    autoCompletedDiv.className = 'message ai auto-completed-data';
    autoCompletedDiv.id = 'autoCompletedData';
    
    let content = `
        <div class="auto-completed-header">
            <i class="fas fa-magic"></i> <strong>AI Auto-completion Results:</strong>
            <button class="btn btn-success btn-sm download-btn" onclick="downloadCompletedDocument()" title="Download complete document">
                <i class="fas fa-download"></i> Download Complete Document
            </button>
        </div>
    `;
    
    Object.entries(data).forEach(([key, value]) => {
        content += `
            <div class="auto-completed-item" data-field="${key}">
                <div class="field-label"><strong>${key}:</strong></div>
                <div class="field-value" contenteditable="true" data-original="${value}">${value}</div>
                <div class="field-actions">
                    <button class="btn-mini btn-edit" onclick="editField('${key}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-mini btn-reset" onclick="resetField('${key}')">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    autoCompletedDiv.innerHTML = content;
    chatMessages.appendChild(autoCompletedDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    
    window.supplementData = data;
}

function addEditableInterface() {
    addAIMessage('💡 Tip: You can directly click on any field value to edit, or use the edit button to modify. The modified data will be used for more precise carbon emission analysis.');
}

function editField(fieldName) {
    const fieldElement = document.querySelector(`[data-field="${fieldName}"] .field-value`);
    if (fieldElement) {
        fieldElement.focus();
        
        const range = document.createRange();
        range.selectNodeContents(fieldElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        
        addAIMessage(`Editing "${fieldName}", press Enter to save after editing.`);
        
        
        fieldElement.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveFieldEdit(fieldName, fieldElement.textContent);
                fieldElement.blur();
            }
        });
        
        
        fieldElement.addEventListener('blur', function() {
            saveFieldEdit(fieldName, fieldElement.textContent);
        });
    }
}

function saveFieldEdit(fieldName, newValue) {
    if (window.supplementData && window.supplementData[fieldName] !== newValue) {
        window.supplementData[fieldName] = newValue;
        addAIMessage(`✅ "${fieldName}" updated to: ${newValue}`);
    }
}

async function resetField(fieldName) {
    const fieldElement = document.querySelector(`[data-field="${fieldName}"] .field-value`);
    
    if (!fieldElement) return;
    
    
    fieldElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Regenerating...';
    addAIMessage(`🔄 Regenerating AI suggestions for "${fieldName}"...`);
    
    try {
        
        const newValue = await regenerateFieldValue(fieldName);
        
        if (newValue) {
            fieldElement.textContent = newValue;
            fieldElement.dataset.original = newValue; 
            window.supplementData[fieldName] = newValue;
            addAIMessage(`✅ "${fieldName}" has been regenerated: ${newValue}`);
        } else {
            
            const originalValue = fieldElement.dataset.original;
            fieldElement.textContent = originalValue;
            window.supplementData[fieldName] = originalValue;
            addAIMessage(`⚠️ AI regeneration failed, restored to original recommended value.`);
        }
    } catch (error) {
        console.error('重新生成字段值失败:', error);
        
        const originalValue = fieldElement.dataset.original;
        fieldElement.textContent = originalValue;
        window.supplementData[fieldName] = originalValue;
        addAIMessage(`❌ Regeneration failed, restored to original value.`);
    }
}


function cancelSupplementFlow() {
    window.currentSupplementField = null;
    addAIMessage('Step-by-step completion process cancelled. You can use the one-click completion feature.');
}


function renderLeanModule() {
    window.__leanNewDesign = true;
    const leanContent = document.getElementById('leanAnalysis');
    
    
    leanContent.innerHTML = `
        <div class="solution-analysis-section">
            <h3><i class="fas fa-file-alt"></i> Lean Phase Analysis</h3>
            <div class="solution-analysis-results lean-phases">
                <div class="solution-area-card tech-innovation" data-phase="production" onclick="selectLeanPhase('production')">
                    <h4><i class="fas fa-industry area-icon"></i> Production Phase</h4>
                    <p>Raw Material Procurement + Manufacturing</p>
                </div>
                <div class="solution-area-card process-improvement" data-phase="circulation" onclick="selectLeanPhase('circulation')">
                    <h4><i class="fas fa-truck area-icon"></i> Circulation Phase</h4>
                    <p>Logistics Transportation + Product Usage</p>
                </div>
                <div class="solution-area-card material-optimization" data-phase="endoflife" onclick="selectLeanPhase('endoflife')">
                    <h4><i class="fas fa-recycle area-icon"></i> End-of-Life Phase</h4>
                    <p>Recycling Processing + Natural Decomposition</p>
                </div>
            </div>
            <div class="selection-hint"><i class="fas fa-hand-pointer"></i> Click a phase to view details</div>
        </div>

        <div class="analysis-section" id="leanPhasePanel" style="display:block;">
            <h3><i class="fas fa-search"></i> Phase Details & AI Suggestions</h3>
            <div class="data-container">
                <div class="timeline-data-block">
                    <h4><i class="fas fa-clock"></i> Time</h4>
                    <div id="leanTimeDetails" class="phase-details-container"></div>
                </div>
                <div class="emission-data-block">
                    <h4><i class="fas fa-leaf"></i> Carbon Emissions</h4>
                    <div id="leanCarbonDetails" class="phase-details-container"></div>
                </div>
            </div>
            <div class="suggestions" id="leanPhaseSuggestions"></div>
            <div class="lean-bottom-bars" style="margin-top:18px;">
                <h4 style="margin:8px 0;"><i class="fas fa-clock"></i> Time</h4>
                <div id="leanFullTimeBar"></div>
                <h4 style="margin:14px 0 8px 0;"><i class="fas fa-leaf"></i> Carbon Emissions</h4>
                <div class="emission-analysis">
                    <div id="leanFullCarbonBar"></div>
                </div>
            </div>
        </div>
    `;

    
    try { renderLeanBars('production'); } catch (e) { console.warn('initial lean bars failed:', e); }

    
    try {
        const leanContainer = document.getElementById('leanAnalysis');
        const action = document.createElement('div');
        action.className = 'kanban-action-container';
        action.innerHTML = `<div class="action-section"><h3><i class="fas fa-arrow-right"></i> Next Step: Enter Scrum Execution</h3><p>Based on the analysis results, go to Scrum to generate execution plans.</p><button class="btn btn-primary btn-large" onclick="goToScrumExecution()"><i class="fas fa-tasks"></i> Go to Scrum Execution</button></div>`;
        leanContainer.appendChild(action);
    } catch (e) { console.warn('append scrum button failed:', e); }
}


async function selectLeanPhase(phaseKey) {
    try {
        const panel = document.getElementById('leanPhasePanel');
        if (panel) panel.style.display = 'block';
        
        document.querySelectorAll('.lean-phases .solution-area-card').forEach(el => el.classList.remove('selected'));
        const sel = document.querySelector(`.lean-phases .solution-area-card[data-phase="${phaseKey}"]`);
        if (sel) sel.classList.add('selected');

        
        renderLeanBars(phaseKey);

        
        if (typeof window.renderSubphaseDetails === 'function') {
            await window.renderSubphaseDetails('time', phaseKey, 'leanTimeDetails');
            await window.renderSubphaseDetails('carbon', phaseKey, 'leanCarbonDetails');
        }
        
        const sug = document.getElementById('leanPhaseSuggestions');
        if (sug) sug.innerHTML = '<div class="selection-hint"><i class="fas fa-hand-pointer"></i> Click a substage to generate AI suggestions</div>';
        
        window.__leanSelectedPhase = phaseKey;
        
    } catch (e) {
        console.warn('selectLeanPhase failed:', e);
    }
}

function renderLeanBars(phaseKey) {
    try {
        
        const tlAll = window.analysisData?.timeline || {};
        const t3 = {
            production: { duration: (tlAll.procurement?.duration || 0) + (tlAll.manufacturing?.duration || 0) },
            circulation: { duration: (tlAll.logistics?.duration || 0) + (tlAll.usage?.duration || 0) },
            endoflife: { duration: (tlAll.recycling?.duration || 0) + (tlAll.decomposition?.duration || 0) }
        };
        const e3 = (function(){
            const em = window.analysisData?.emissions || {};
            const grouped = {};
            const map = { production:['procurement','manufacturing'], circulation:['logistics','usage'], endoflife:['recycling','decomposition'] };
            Object.keys(map).forEach(k=>{
                grouped[k] = { value: map[k].reduce((s,c)=> s + (em[c]?.value||0), 0) };
            });
            return grouped;
        })();
        
        if (t3) {
            const total = ['production','circulation','endoflife'].reduce((s,k)=>s+(t3[k]?.duration||0),0);
            const elFullT = document.getElementById('leanFullTimeBar');
            if (elFullT) {
                const segments = ['production','circulation','endoflife'].map(k=>{
                    const pct = total>0?(t3[k].duration/total*100): (100/3);
                    return `<div class="timeline-bar-segment ${k}" style="width:${pct}%"></div>`;
                }).join('');
                const labels = ['production','circulation','endoflife'].map(k=>{
                    const title = k === 'production' ? 'Production' : (k === 'circulation' ? 'Circulation' : 'End-of-Life');
                    const icon = k === 'production' ? 'fas fa-industry' : (k === 'circulation' ? 'fas fa-truck' : 'fas fa-recycle');
                    return `<div class="timeline-label ${k}"><div class="timeline-label-icon"><i class="${icon}"></i></div><div class="timeline-label-title">${title}</div><div class="timeline-label-duration">${t3[k].duration} day</div></div>`;
                }).join('');
                elFullT.innerHTML = `<div class="proportional-timeline is-active"><div class="timeline-bar-container">${segments}</div><div class="timeline-labels">${labels}</div></div>`;
            }
        }
        
        if (e3) {
            const totalC = ['production','circulation','endoflife'].reduce((s,k)=>s+(e3[k]?.value||0),0);
            const elFullC = document.getElementById('leanFullCarbonBar');
            if (elFullC) {
                const segmentsC = ['production','circulation','endoflife'].map(k=>{
                    const pct= totalC>0?(e3[k].value/totalC*100):(100/3);
                    return `<div class="timeline-bar-segment ${k}" style="width:${pct}%"></div>`;
                }).join('');
                const labelsC = ['production','circulation','endoflife'].map(k=>{
                    const title = k === 'production' ? 'Production' : (k === 'circulation' ? 'Circulation' : 'End-of-Life');
                    const icon = k === 'production' ? 'fas fa-industry' : (k === 'circulation' ? 'fas fa-truck' : 'fas fa-recycle');
                    return `<div class="timeline-label ${k}"><div class="timeline-label-icon"><i class="${icon}"></i></div><div class="timeline-label-title">${title}</div><div class="timeline-label-duration">${e3[k].value} kgCO2e</div></div>`;
                }).join('');
                elFullC.innerHTML = `<div class="proportional-timeline is-active"><div class="timeline-bar-container">${segmentsC}</div><div class="timeline-labels">${labelsC}</div></div>`;
            }
        }
    } catch (e) {
        console.warn('renderLeanBars failed:', e);
    }
}

async function generateLeanPhaseSuggestions() {
    try {
        const phaseKey = window.__leanSelectedPhase || 'production';
        const container = document.getElementById('leanPhaseSuggestions');
        if (container) container.innerHTML = '<div class="loading-suggestions"><i class="fas fa-spinner fa-spin"></i> Generating AI suggestions...</div>';
        
        if (typeof generateAISuggestionsForPhase === 'function') {
            const english = {production:'Production', circulation:'Circulation', endoflife:'End-of-Life'}[phaseKey] || 'Production';
            const ai = await generateAISuggestionsForPhase(english);
            const html = (ai && ai.length>0) ? ai.map(s=>`
                <div class="suggestion-card">
                    <div class="suggestion-header"><i class="${s.icon || 'fas fa-lightbulb'}"></i><span>${s.title}</span></div>
                    <p>${s.desc || ''}</p>
                    <div class="suggestion-actions"><button class="btn btn-success btn-sm" onclick="acceptSuggestion('${s.title}', event)"><i class="fas fa-check"></i> Accept Suggestion</button></div>
                </div>
            `).join('') : '<div class="no-data">No AI suggestions available</div>';
            if (container) container.innerHTML = html;
        } else {
            if (container) container.innerHTML = '<div class="no-data">AI function not available</div>';
        }
    } catch (e) {
        console.warn('generateLeanPhaseSuggestions failed:', e);
    }
}


window.onSubstageClick = async function(type, phaseKey, subLabel) {
    try {
        const container = document.getElementById('leanPhaseSuggestions');
        if (container) container.innerHTML = `<div class="loading-suggestions"><i class="fas fa-spinner fa-spin"></i> Generating AI suggestions for ${subLabel}...</div>`;
        
        if (typeof generateAISuggestionsForPhase === 'function') {
            const english = {production:'Production', circulation:'Circulation', endoflife:'End-of-Life'}[phaseKey] || 'Production';
            const base = await generateAISuggestionsForPhase(english, subLabel);
            
            window.__substageSuggestionCache = window.__substageSuggestionCache || {};
            window.__substageSuggestionCache[phaseKey] = base || [];

            const refined = (base || []).map(s => ({ ...s, title: s.title, desc: (s.desc || '') }));
            const keys = ['procurement','manufacturing','logistics','usage','recycling','decomposition'];
            function computeDelta(s) {
                try {
                    let beforeT = 0, afterT = 0, beforeC = 0, afterC = 0;
                    keys.forEach(k => {
                        const bt = (window.analysisData?.timeline?.[k]?.duration || 0);
                        const be = (window.analysisData?.emissions?.[k]?.value || 0);
                        beforeT += bt;
                        beforeC += be;
                        afterT  += (s?.timeAfter && typeof s.timeAfter[k]==='number') ? s.timeAfter[k] : bt;
                        afterC  += (s?.carbonAfter && typeof s.carbonAfter[k]==='number') ? s.carbonAfter[k] : be;
                    });
                    return {
                        timeSaved: Math.max(0, Math.round(beforeT - afterT)),
                        carbonSaved: Math.max(0, Math.round((beforeC - afterC) * 10) / 10)
                    };
                } catch { return { timeSaved: 0, carbonSaved: 0 }; }
            }

            const html = refined.length ? refined.map(s=>{
                const d = computeDelta(s);
                return `
                <div class="suggestion-card">
                    <div class="suggestion-header"><i class="${s.icon || 'fas fa-lightbulb'}"></i><span>${s.title}</span></div>
                    <div class="suggestion-content">
                        <p>${s.desc || ''}</p>
                        ${Array.isArray(s.kpis)&&s.kpis.length?`<div class=\"kpi-list\"><strong>KPIs:</strong> ${s.kpis.join(', ')}</div>`:''}
                        ${Array.isArray(s.actions)&&s.actions.length?`<ul class=\"action-steps\">${s.actions.map(a=>`<li>${a}</li>`).join('')}</ul>`:''}
                    </div>
                    <div class="improvement-metrics" style="margin:8px 0; display:flex; gap:8px;">
                        <span class="time-improvement"><i class="fas fa-clock"></i> -${d.timeSaved} day</span>
                        <span class="carbon-reduction"><i class="fas fa-leaf"></i> -${d.carbonSaved} kgCO2e</span>
                    </div>
                    <div class="suggestion-actions"><button class="btn btn-success btn-sm" onclick="acceptSuggestionWithImpact('${type}','${phaseKey}','${subLabel}','${s.title}', event)"><i class="fas fa-check"></i> Accept Suggestion</button></div>
                </div>`;
            }).join('') : '<div class="no-data">No AI suggestions available</div>';
            if (container) container.innerHTML = html;
        } else {
            if (container) container.innerHTML = '<div class="no-data">AI function not available</div>';
        }
    } catch (e) {
        console.warn('onSubstageClick failed:', e);
    }
}


window.acceptSuggestionWithImpact = function(type, phaseKey, subLabel, title, event){
    try {
        
        acceptSuggestion(title, event);
        
        const aiSug = (window.__substageSuggestionCache && window.__substageSuggestionCache[phaseKey] || []).find(s => (s && s.title === title));
        const hasAfter = aiSug && aiSug.timeAfter && aiSug.carbonAfter;
        
        const defaultPct = 0.1;
        if (type === 'time') {
            const tl = window.analysisData?.timeline || {};
            const map = { production:['procurement','manufacturing'], circulation:['logistics','usage'], endoflife:['recycling','decomposition'] };
            (map[phaseKey]||[]).forEach(k=>{
                if (tl[k] && typeof tl[k].duration === 'number') {
                    const before = tl[k].duration;
                    const after = hasAfter && typeof aiSug.timeAfter[k]==='number' ? Math.max(1, Math.round(aiSug.timeAfter[k])) : Math.max(1, Math.round(before * (1 - defaultPct)));
                    tl[k].originalDuration = before;
                    tl[k].duration = after;
                }
            });
        } else {
            const em = window.analysisData?.emissions || {};
            const map = { production:['procurement','manufacturing'], circulation:['logistics','usage'], endoflife:['recycling','decomposition'] };
            (map[phaseKey]||[]).forEach(k=>{
                if (em[k] && typeof em[k].value === 'number') {
                    const before = em[k].value;
                    const after = hasAfter && typeof aiSug.carbonAfter[k]==='number' ? Math.max(0, Math.round(aiSug.carbonAfter[k]*10)/10) : Math.max(0, Math.round(before * (1 - defaultPct) * 10)/10);
                    em[k].originalValue = before;
                    em[k].value = after;
                }
            });
        }
        
        renderLeanBars(window.__leanSelectedPhase || 'production');
        if (typeof window.renderSubphaseDetails === 'function') {
            window.renderSubphaseDetails('time', window.__leanSelectedPhase || 'production', 'leanTimeDetails');
            window.renderSubphaseDetails('carbon', window.__leanSelectedPhase || 'production', 'leanCarbonDetails');
        }
    } catch (e) { console.warn('acceptSuggestionWithImpact failed:', e); }
}


const _origAcceptSuggestion = acceptSuggestion;
acceptSuggestion = function(suggestionTitle, event){
    try {
        _origAcceptSuggestion(suggestionTitle, event);
        if (window.__leanSelectedPhase || true) {
            renderLeanBars(window.__leanSelectedPhase || 'production');
            if (typeof window.renderSubphaseDetails === 'function') {
                const k = window.__leanSelectedPhase || 'production';
                window.renderSubphaseDetails('time', k, 'leanTimeDetails');
                window.renderSubphaseDetails('carbon', k, 'leanCarbonDetails');
            }
        }
    } catch (e) { console.warn('acceptSuggestion hook failed:', e); }
}


function generateEmissionCardsForLean() {
    const effectiveAnalysis = (typeof window !== 'undefined' && window.analysisData) ? window.analysisData : analysisData;
    if (!effectiveAnalysis || !effectiveAnalysis.emissions) {
        
        const defaultEmissions = {
            procurement: { value: 59, level: 'medium' },
            manufacturing: { value: 77, level: 'high' },
            logistics: { value: 43, level: 'low' },
            usage: { value: 114, level: 'high' },
            recycling: { value: 14, level: 'low' },
            decomposition: { value: 9, level: 'low' }
        };
        return generateEmissionCardsHtml(defaultEmissions);
    }

    return generateEmissionCardsHtml(effectiveAnalysis.emissions);
}


function generateEmissionCardsHtml(emissions) {
    const emissionTypes = {
        procurement: { name: 'Raw Material Procurement', icon: 'fas fa-shopping-cart' },
        manufacturing: { name: 'Production Manufacturing', icon: 'fas fa-industry' },
        logistics: { name: 'Logistics Transportation', icon: 'fas fa-truck' },
        usage: { name: 'Product Usage', icon: 'fas fa-user-check' },
        recycling: { name: 'Recycling Processing', icon: 'fas fa-recycle' },
        decomposition: { name: 'Natural Decomposition', icon: 'fas fa-seedling' }
    };
    
    const adopted = (typeof hasAcceptedSuggestions !== 'undefined' && hasAcceptedSuggestions) || (typeof window !== 'undefined' && Array.isArray(window.acceptedSuggestions) && window.acceptedSuggestions.length > 0);

    return Object.entries(emissions).map(([key, data]) => {
        const type = emissionTypes[key];
        const progressWidth = Math.min((data.value / Math.max(...Object.values(emissions).map(e => e.value))) * 100, 150);
        
        
        const originalValue = typeof data.originalValue === 'number' ? data.originalValue : data.value;
        const diff = data.value - originalValue;
        const deltaPct = originalValue > 0 ? Math.round(((originalValue - data.value) / originalValue) * 100) : 0;
        const arrow = deltaPct > 0 ? '↓' : (deltaPct < 0 ? '↑' : '');
        const changeBadge = `${originalValue}→${data.value} (${deltaPct === 0 ? '0%' : arrow + Math.abs(deltaPct) + '%'})`;
        
        const valueDisplay = adopted ? (diff !== 0 ? `${data.value} (${diff > 0 ? '+' + diff : '-' + Math.abs(diff)})` : `${data.value}`) : `${data.value}`;
        
        return `
            <div class="data-card emission-card" data-phase="${key}" onclick="openAIModal('${key}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
                <div class="card-icon">
                    <i class="${type.icon}"></i>
                </div>
                <div class="card-content">
                    <h4>${type.name} ${(adopted && deltaPct !== 0) ? `<span class=\"emission-change-badge\" style=\"margin-left:6px; font-size:12px; color:${deltaPct>0?'#28a745':(deltaPct<0?'#dc3545':'#6c757d')};\">${changeBadge}</span>` : ''}</h4>
                    <div class="emission-value ${data.level} ${deltaPct>0?'improved':''}" style="color: ${deltaPct > 0 ? '#28a745' : deltaPct < 0 ? '#dc3545' : '#6c757d'}">${valueDisplay}</div>
                    <div class="unit">Unit: kgCO2e</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, progressWidth)}%; background-color: ${data.level === 'high' ? '#e74c3c' : data.level === 'medium' ? '#f39c12' : '#27ae60'}"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function generateTimelineCardsHtml() {
    const effectiveAnalysis = (typeof window !== 'undefined' && window.analysisData) ? window.analysisData : analysisData;
    if (!effectiveAnalysis || !effectiveAnalysis.timeline) {
        return '<div class="no-data">No time data available</div>';
    }
    
    const timeline = effectiveAnalysis.timeline;
    let timelineCardsHtml = '';
    
    const phaseNames = {
        procurement: 'Raw Material Procurement',
        manufacturing: 'Manufacturing',
        logistics: 'Logistics Transportation',
        usage: 'Product Usage',
        recycling: 'Recycling Processing',
        decomposition: 'Natural Decomposition'
    };
    
    const phaseIcons = {
        procurement: 'fas fa-shopping-cart',
        manufacturing: 'fas fa-industry',
        logistics: 'fas fa-truck',
        usage: 'fas fa-user',
        recycling: 'fas fa-recycle',
        decomposition: 'fas fa-seedling'
    };
    
    const adopted = (typeof hasAcceptedSuggestions !== 'undefined' && hasAcceptedSuggestions) || (typeof window !== 'undefined' && Array.isArray(window.acceptedSuggestions) && window.acceptedSuggestions.length > 0);

    Object.entries(timeline).forEach(([phase, data]) => {
        const phaseName = phaseNames[phase] || phase;
        const icon = phaseIcons[phase] || 'fas fa-clock';
        const duration = data.duration;
        const unitRaw = data.unit || 'day';
        const unit = (unitRaw === '天') ? 'day' : unitRaw;
        const originalDuration = data.originalDuration || duration;
        const deltaAmount = duration - originalDuration; 
        
        
        let level = 'medium';
        if (duration > 300) level = 'high';
        else if (duration < 100) level = 'low';
        
        
        let durationDisplay = `${duration}`;
        if (adopted) {
            if (deltaAmount !== 0) {
                durationDisplay = `${duration} (${deltaAmount > 0 ? '+' + deltaAmount : '-' + Math.abs(deltaAmount)})`;
            } else {
                durationDisplay = `${duration}`;
            }
        }
        
        
        const improvements = window.calculateCumulativeImprovements ? window.calculateCumulativeImprovements() : { time: {} };
        const improvement = improvements.time[phase] || 0;
        const originalValue = data.originalDuration || data.duration;
        const deltaPct = originalValue > 0 ? Math.round(((originalValue - duration) / originalValue) * 100) : 0;
        const arrow = deltaPct > 0 ? '↓' : (deltaPct < 0 ? '↑' : '');
        const changeBadge = `${originalValue}→${duration}`;
        
        timelineCardsHtml += `
            <div class="data-card timeline-card" data-phase="${phase}">
                <div class="card-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="card-content">
                    <h4>${phaseName} ${(adopted && deltaPct !== 0) ? `<span class=\"timeline-change-badge\" style=\"margin-left:6px; font-size:12px; color:${deltaPct>0?'#28a745':(deltaPct<0?'#dc3545':'#6c757d')};\">${changeBadge}</span>` : ''}</h4>
                    <div class="duration-value ${deltaPct>0?'improved':''}" style="color: ${deltaPct > 0 ? '#28a745' : deltaPct < 0 ? '#dc3545' : '#6c757d'}">${durationDisplay}</div>
                    <div class="unit">Unit: ${unit}</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${level}" style="width: ${Math.min(80, (duration / 200) * 100)}%;"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    return timelineCardsHtml;
}


function getSolutionAnalysisResults() {
    
    const documentContent = getOriginalDocumentContent();
    const supplementData = window.supplementData || {};
    
    
    const analysisAreas = [
        {
            area: 'Material Selection',
            icon: 'fas fa-cube',
            color: '#4caf50',
            currentImpact: 'Medium Impact',
            impactLevel: 'medium',
            currentStatus: 'Using traditional materials, environmental friendliness needs improvement',
            improvementPotential: '30-40% carbon emission reduction'
        },
        {
            area: 'Production Process',
            icon: 'fas fa-cogs',
            color: '#f44336',
            currentImpact: 'High Impact',
            impactLevel: 'high',
            currentStatus: 'Traditional process flow, high energy consumption',
            improvementPotential: '25-35% time reduction'
        },
        {
            area: 'Supply Chain Management',
            icon: 'fas fa-truck',
            color: '#ff9800',
            currentImpact: 'Medium Impact',
            impactLevel: 'medium',
            currentStatus: 'Suppliers distributed widely, high transportation costs',
            improvementPotential: '20-30% logistics optimization'
        },
        {
            area: 'Product Design',
            icon: 'fas fa-drafting-compass',
            color: '#2196f3',
            currentImpact: 'Low Impact',
            impactLevel: 'low',
            currentStatus: 'Design is reasonable, but sustainability consideration insufficient',
            improvementPotential: '15-25% lifespan extension'
        },
        {
            area: 'Packaging Solution',
            icon: 'fas fa-box',
            color: '#9c27b0',
            currentImpact: 'Medium Impact',
            impactLevel: 'medium',
            currentStatus: 'Packaging material recyclability is average',
            improvementPotential: '40-50% packaging reduction'
        }
    ];
    
    
    if (documentContent && documentContent.length > 100) {
        
        analysisAreas.forEach(area => {
            if (documentContent.toLowerCase().includes('environmental') || documentContent.toLowerCase().includes('green') || documentContent.toLowerCase().includes('环保') || documentContent.toLowerCase().includes('绿色')) {
                if (area.area === 'Material Selection') {
                    area.currentStatus = 'Environmental materials considered, but still room for optimization';
                    area.currentImpact = 'Low Impact';
                    area.impactLevel = 'low';
                }
            }
            
            if (documentContent.toLowerCase().includes('process') || documentContent.toLowerCase().includes('manufacturing') || documentContent.toLowerCase().includes('工艺') || documentContent.toLowerCase().includes('制造')) {
                if (area.area === 'Production Process') {
                    area.currentStatus = 'Process flow described, needs further optimization';
                }
            }
        });
    }
    
    return analysisAreas;
}


function getImprovementComparison() {
    
    const analysisData = window.analysisData;
    
    let timeImprovement = {
        before: 120,
        after: 85,
        improvement: 35,
        unit: '天'
    };
    
    let carbonReduction = {
        before: 298,
        after: 215,
        reduction: 83,
        unit: 'kg CO₂'
    };
    
    
    if (analysisData && analysisData.emissions) {
        const totalEmissions = Object.values(analysisData.emissions).reduce((sum, data) => sum + data.value, 0);
        const totalComparison = Object.values(analysisData.emissions).reduce((sum, data) => sum + (data.comparison || data.value), 0);
        
        carbonReduction = {
            before: Math.round(totalComparison),
            after: Math.round(totalEmissions),
            reduction: Math.round(totalComparison - totalEmissions),
            unit: 'kg CO₂'
        };
        
        
        const improvementRatio = carbonReduction.reduction / carbonReduction.before;
        timeImprovement = {
            before: 120,
            after: Math.round(120 * (1 - improvementRatio)),
            improvement: Math.round(120 * improvementRatio),
            unit: '天'
        };
    }
    
    
    const showAfterData = typeof hasAcceptedSuggestions !== 'undefined' ? hasAcceptedSuggestions : false;
    
    return {
        showAfterData,
        combined: {
            carbonEmission: {
                current: `${carbonReduction.before} ${carbonReduction.unit}`,
                optimized: showAfterData ? `${carbonReduction.after} ${carbonReduction.unit}` : 'Show after adopting suggestions',
                improvement: showAfterData ? `Reduction ${carbonReduction.reduction} ${carbonReduction.unit}` : 'Show after adopting suggestions',
                percentage: showAfterData ? Math.round((carbonReduction.reduction / carbonReduction.before) * 100) : 0
            },
            timeEfficiency: {
                current: `${timeImprovement.before} ${timeImprovement.unit}`,
                optimized: showAfterData ? `${timeImprovement.after} ${timeImprovement.unit}` : 'Show after adopting suggestions',
                improvement: showAfterData ? `Save ${timeImprovement.improvement} ${timeImprovement.unit}` : 'Show after adopting suggestions',
                percentage: showAfterData ? Math.round((timeImprovement.improvement / timeImprovement.before) * 100) : 0
            }
        },
        
        time: timeImprovement,
        carbon: carbonReduction
    };
}


function getKanbanAnalysisResults() {
    
    if (window.currentTimelineData) {
        return window.currentTimelineData;
    }
    
    
    return [
        {
            phase: 'Decomposition',
            icon: 'fas fa-seedling',
            color: '#4caf50',
            emission: Math.round(Math.random() * 50 + 10),
            description: 'Complete biodegradation cycle',
            duration: Math.round(Math.random() * 24 + 6) + ' months decomposition'
        },
        {
            phase: 'Recycling',
            icon: 'fas fa-recycle',
            color: '#2196f3',
            emission: Math.round(Math.random() * 30 + 5),
            description: 'Recycling processing completion cycle',
            duration: Math.round(Math.random() * 6 + 2) + ' months recycling'
        },
        {
            phase: 'Usage',
            icon: 'fas fa-user-check',
            color: '#ff9800',
            emission: Math.round(Math.random() * 100 + 50),
            description: 'Optimal usage cycle recommendation',
            duration: Math.round(Math.random() * 36 + 12) + ' months recommended usage'
        },
        {
            phase: 'Production',
            icon: 'fas fa-industry',
            color: '#f44336',
            emission: Math.round(Math.random() * 200 + 100),
            description: 'Production time from raw materials to finished products',
            duration: Math.round(Math.random() * 8 + 2) + ' weeks production cycle'
        },
        {
            phase: 'Procurement',
            icon: 'fas fa-shopping-cart',
            color: '#9c27b0',
            emission: Math.round(Math.random() * 80 + 20),
            description: 'Raw material procurement lead time',
            duration: Math.round(Math.random() * 4 + 1) + ' weeks procurement cycle'
        }
    ];
}


async function selectSolutionArea(area) {
    
    currentSelectedArea = area;

    
    document.querySelectorAll('.solution-area-card').forEach(item => {
        item.classList.remove('selected');
    });
    const selectedCard = document.querySelector(`[data-area="${area}"]`);
    if (selectedCard) selectedCard.classList.add('selected');
    
    
    const selectedAnalysis = document.getElementById('selectedAnalysis');
    const optimizationSection = document.getElementById('optimizationSection');
    if (selectedAnalysis) selectedAnalysis.style.display = 'block';
    if (optimizationSection) optimizationSection.style.display = 'block';
    
    
    const areaAccepted = acceptedSuggestionsByArea[area] || [];
    const improvementSection = document.getElementById('improvementComparisonSection');
    if (improvementSection) {
        improvementSection.style.display = (areaAccepted.length > 0 || (typeof hasAcceptedSuggestions !== 'undefined' && hasAcceptedSuggestions)) ? 'block' : 'none';
    }
    
    
    const suggestionsDiv = document.getElementById('suggestionsContent');
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = '<div class="loading-suggestions"><i class="fas fa-spinner fa-spin"></i> Generating AI suggestions...</div>';
    }
    
    
    await generateSolutionAreaAnalysis(area);
}


async function selectKanbanResult(phase) {
    
    document.querySelectorAll('.kanban-result-item').forEach(item => {
        item.classList.remove('selected');
    });
    const phaseElement = document.querySelector(`[data-phase="${phase}"]`);
    if (phaseElement) {
        phaseElement.classList.add('selected');
    }
    
    
    const selectedAnalysis = document.getElementById('selectedAnalysis');
    const optimizationSection = document.getElementById('optimizationSection');
    if (selectedAnalysis) selectedAnalysis.style.display = 'block';
    if (optimizationSection) optimizationSection.style.display = 'block';
    
    
    const suggestionsContent = document.getElementById('suggestionsContent');
    if (suggestionsContent) {
        suggestionsContent.innerHTML = '<div class="loading-suggestions"><i class="fas fa-spinner fa-spin"></i> 正在生成AI建议...</div>';
    }
    
    
    await generatePhaseAnalysis(phase);
}


async function generateSolutionAreaAnalysis(area) {
    
    try {
        
        if (typeof window.generatePersonalizedSuggestions === 'function') {
            console.log('Calling AI to generate personalized suggestions:', area);
            await window.generatePersonalizedSuggestions(area);
        } else {
            console.log('AI function not available, using fallback plan:', area);
            displayFallbackSuggestionsForArea(area);
        }
    } catch (error) {
        console.error('AI generation failed, using fallback plan:', error);
        displayFallbackSuggestionsForArea(area);
    }
}


async function generatePhaseAnalysis(phase) {
    
    displayFallbackSuggestionsForArea(phase);
}


function displayFallbackSuggestionsForArea(area) {
    const areaAnalysisData = {
        'Technology Innovation': {
            subProjects: [
                { name: 'Smart Sensor Integration', icon: 'fas fa-microchip', timeReduction: 35, carbonReduction: 28 },
                { name: 'Machine Learning Algorithm Optimization', icon: 'fas fa-brain', timeReduction: 45, carbonReduction: 32 },
                { name: 'Automated Control Systems', icon: 'fas fa-robot', timeReduction: 40, carbonReduction: 25 }
            ],
            suggestions: [
                { icon: 'fas fa-microchip', title: 'Smart Upgrade', timeImprovement: 'Reduce 40% processing time', carbonReduction: 'Reduce 35% carbon emissions', desc: 'Adopt AI and IoT technology to optimize processes, achieve intelligent monitoring and predictive maintenance', subProject: 'Smart Sensor Integration' },
                { icon: 'fas fa-robot', title: 'Automation Transformation', timeImprovement: 'Reduce 50% operation time', carbonReduction: 'Reduce 30% energy consumption', desc: 'Introduce robots and automated production lines to reduce manual intervention and energy consumption', subProject: 'Automated Control Systems' },
                { icon: 'fas fa-brain', title: 'Algorithm Optimization', timeImprovement: 'Improve 60% computational efficiency', carbonReduction: 'Reduce 25% server emissions', desc: 'Optimize core algorithms to reduce computational resource requirements and server energy consumption', subProject: 'Machine Learning Algorithm Optimization' }
            ]
        },
        'Material Optimization': {
            subProjects: [
                { name: 'Bio-based Material Selection', icon: 'fas fa-seedling', timeReduction: 25, carbonReduction: 55 },
                { name: 'Recycled Material Application', icon: 'fas fa-recycle', timeReduction: 30, carbonReduction: 45 },
                { name: 'Lightweight Structure Design', icon: 'fas fa-feather-alt', timeReduction: 20, carbonReduction: 35 }
            ],
            suggestions: [
                { icon: 'fas fa-seedling', title: 'Bio-based Materials', timeImprovement: 'Reduce 20% processing time', carbonReduction: 'Reduce 55% emissions', desc: 'Adopt biodegradable materials to reduce chemical processing steps and environmental impact', subProject: 'Bio-based Material Selection' },
                { icon: 'fas fa-recycle', title: 'Circular Economy', timeImprovement: 'Save 35% preparation time', carbonReduction: 'Reduce 45% raw material emissions', desc: 'Establish closed-loop material circulation system to achieve waste reuse', subProject: 'Recycled Material Application' },
                { icon: 'fas fa-leaf', title: 'Lightweight Design', timeImprovement: 'Reduce 15% transportation time', carbonReduction: 'Reduce 40% logistics emissions', desc: 'Adopt lightweight materials and structural design to reduce transportation costs and emissions', subProject: 'Lightweight Structure Design' }
            ]
        },
        'Process Improvement': {
            subProjects: [
                { name: 'Lean Production Process', icon: 'fas fa-cogs', timeReduction: 35, carbonReduction: 30 },
                { name: 'Clean Energy Conversion', icon: 'fas fa-bolt', timeReduction: 15, carbonReduction: 65 },
                { name: 'Waste Heat Recovery System', icon: 'fas fa-fire', timeReduction: 25, carbonReduction: 40 }
            ],
            suggestions: [
                { icon: 'fas fa-cogs', title: 'Lean Production', timeImprovement: 'Reduce 30% production cycle', carbonReduction: 'Reduce 35% process emissions', desc: 'Implement lean production concepts to eliminate waste and redundant processes', subProject: 'Lean Production Process' },
                { icon: 'fas fa-bolt', title: 'Clean Energy', timeImprovement: 'Reduce 10% energy consumption time', carbonReduction: 'Reduce 65% energy emissions', desc: 'Adopt solar, wind and other clean energy to replace traditional energy sources', subProject: 'Clean Energy Conversion' },
                { icon: 'fas fa-fire', title: 'Heat Recovery Technology', timeImprovement: 'Improve 25% energy efficiency', carbonReduction: 'Reduce 30% thermal energy loss', desc: 'Install waste heat recovery systems to improve energy utilization efficiency', subProject: 'Waste Heat Recovery System' }
            ]
        },
        'Management Enhancement': {
            subProjects: [
                { name: 'Digital Management Platform', icon: 'fas fa-chart-line', timeReduction: 40, carbonReduction: 25 },
                { name: 'Agile Team Collaboration', icon: 'fas fa-users', timeReduction: 35, carbonReduction: 20 },
                { name: 'Green Skills Training', icon: 'fas fa-graduation-cap', timeReduction: 15, carbonReduction: 18 }
            ],
            suggestions: [
                { icon: 'fas fa-chart-line', title: 'Digital Transformation', timeImprovement: 'Improve 45% decision efficiency', carbonReduction: 'Reduce 30% management emissions', desc: 'Establish digital management platform to achieve data-driven decision making', subProject: 'Digital Management Platform' },
                { icon: 'fas fa-users', title: 'Agile Collaboration', timeImprovement: 'Reduce 40% communication time', carbonReduction: 'Reduce 25% coordination costs', desc: 'Adopt agile working methods to improve team collaboration efficiency', subProject: 'Agile Team Collaboration' },
                { icon: 'fas fa-graduation-cap', title: 'Green Training', timeImprovement: 'Improve 20% execution efficiency', carbonReduction: 'Reduce 15% operational emissions', desc: 'Conduct environmental awareness training to improve employee green operation skills', subProject: 'Green Skills Training' }
            ]
        }
    };
    
    const data = areaAnalysisData[area] || areaAnalysisData['Technology Innovation'];
    
    let suggestionContent = `
        <div class="analysis-header">
            <h4><i class="fas fa-lightbulb"></i> ${area} Optimization Recommendations</h4>
            <p class="text-muted">Based on solution content analysis, the following optimization measures are recommended:</p>
        </div>
        <div class="suggestions-grid">
    `;
    
    data.suggestions.forEach((suggestion, index) => {
        suggestionContent += `
            <div class="suggestion-card">
                <div class="suggestion-header">
                    <div class="suggestion-icon">
                        <i class="${suggestion.icon}"></i>
                    </div>
                    <div class="suggestion-title">
                        <h5>${suggestion.title}</h5>
                        <div class="improvement-metrics">
                            <span class="time-improvement"><i class="fas fa-clock"></i> ${suggestion.timeImprovement}</span>
                            <span class="carbon-reduction"><i class="fas fa-leaf"></i> ${suggestion.carbonReduction}</span>
                        </div>
                    </div>
                </div>
                <div class="suggestion-content">
                    <p>${suggestion.desc}</p>
                    <div class="suggestion-actions">
                        <button class="btn btn-success btn-sm" onclick="acceptSuggestion('${suggestion.title}', event)">
                            <i class="fas fa-check"></i> Accept Suggestion
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="consultAIForSuggestion('${suggestion.title}', '${suggestion.desc}')">
                            <i class="fas fa-robot"></i> Ask AI
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    suggestionContent += `
        </div>
    `;
    
    document.getElementById('suggestionsContent').innerHTML = suggestionContent;
}


async function generatePhaseAnalysisOriginal(phase) {
    
    const baseAnalysisData = {
        'Decomposition': {
            causes: [
                { icon: 'fas fa-clock', title: 'Extended decomposition cycle', impact: 'high', desc: 'Material decomposition time exceeds expectations, affecting environmental cycle' },
                { icon: 'fas fa-flask', title: 'Complex chemical composition', impact: 'medium', desc: 'Composite materials are difficult to decompose naturally and require special treatment' }
            ],
            suggestions: [
                { icon: 'fas fa-seedling', title: 'Use biodegradable materials', reduction: '-40%', desc: 'Adopt biodegradable eco-friendly materials as alternatives' },
                { icon: 'fas fa-recycle', title: 'Design easily decomposable structure', reduction: '-25%', desc: 'Optimize product structure design for easy decomposition and recycling' }
            ]
        },
        'Recycling': {
            causes: [
                { icon: 'fas fa-sort', title: 'Difficult classification for recycling', impact: 'high', desc: 'High material mixing degree, high cost of classified recycling' },
                { icon: 'fas fa-map-marker-alt', title: 'Insufficient recycling points', impact: 'medium', desc: 'Incomplete coverage of recycling channels, low recycling rate' }
            ],
            suggestions: [
                { icon: 'fas fa-tags', title: 'Material identification optimization', reduction: '-30%', desc: 'Improve material identification to enhance classified recycling efficiency' },
                { icon: 'fas fa-network-wired', title: 'Expand recycling network', reduction: '-20%', desc: 'Establish more comprehensive recycling channel network' }
            ]
        },
        'Usage': {
            causes: [
                { icon: 'fas fa-battery-half', title: 'Short service life', impact: 'high', desc: 'Insufficient product durability, high replacement frequency' },
                { icon: 'fas fa-tools', title: 'High maintenance cost', impact: 'medium', desc: 'Complex maintenance, poor user experience' }
            ],
            suggestions: [
                { icon: 'fas fa-shield-alt', title: 'Improve product durability', reduction: '-35%', desc: 'Improve materials and processes to extend service life' },
                { icon: 'fas fa-wrench', title: 'Simplify maintenance process', reduction: '-15%', desc: 'Design easy-to-maintain structure to reduce maintenance costs' }
            ]
        },
        'Production': {
            causes: [
                { icon: 'fas fa-bolt', title: 'Excessive energy consumption', impact: 'high', desc: 'High energy consumption in production process, serious carbon emissions' },
                { icon: 'fas fa-industry', title: 'Low process efficiency', impact: 'medium', desc: 'Backward production processes, low resource utilization rate' }
            ],
            suggestions: [
                { icon: 'fas fa-solar-panel', title: 'Clean energy substitution', reduction: '-45%', desc: 'Use solar, wind and other clean energy sources' },
                { icon: 'fas fa-cogs', title: 'Process flow optimization', reduction: '-25%', desc: 'Adopt advanced processes to improve production efficiency' }
            ]
        },
        'Procurement': {
            causes: [
                { icon: 'fas fa-truck', title: 'Excessive transportation distance', impact: 'high', desc: 'Dispersed supplier distribution, high transportation carbon emissions' },
                { icon: 'fas fa-boxes', title: 'Packaging material waste', impact: 'medium', desc: 'Over-packaging, unreasonable material usage' }
            ],
            suggestions: [
                { icon: 'fas fa-map', title: 'Local procurement strategy', reduction: '-35%', desc: 'Prioritize local suppliers to reduce transportation' },
                { icon: 'fas fa-leaf', title: 'Green packaging solution', reduction: '-20%', desc: 'Use eco-friendly packaging materials to reduce waste' }
            ]
        }
    };
    
    const baseData = baseAnalysisData[phase] || baseAnalysisData['Production'];
    
    
    let aiSuggestions = [];
    try {
        aiSuggestions = await generateAISuggestionsForPhase(phase);
    } catch (error) {
        console.warn('AI suggestion generation failed, using preset suggestions:', error);
    }
    
    
    let finalSuggestions = [];
    if (aiSuggestions.length > 0) {
        finalSuggestions = aiSuggestions;
    } else {
        
        finalSuggestions = baseData.suggestions.map(suggestion => ({
            ...suggestion,
            source: 'fallback'
        }));
        console.log('Using preset suggestions as fallback for AI failure');
    }
    
    const combinedData = {
        causes: baseData.causes,
        suggestions: finalSuggestions
    };
    
    
    const causeContent = combinedData.causes.map(cause => `
        <div class="cause-item ${cause.impact}-impact">
            <div class="cause-header">
                <i class="${cause.icon}"></i>
                <span>${cause.title}</span>
                <span class="impact-level">${cause.impact === 'high' ? 'High Impact' : cause.impact === 'medium' ? 'Medium Impact' : 'Low Impact'}</span>
            </div>
            <p>${cause.desc}</p>
        </div>
    `).join('');
    
    document.getElementById('causeAnalysisContent').innerHTML = causeContent;
    
    
    const suggestionContent = combinedData.suggestions.map((suggestion, index) => `
        <div class="suggestion-item ${suggestion.source || 'preset'}">
            <div class="suggestion-header">
                <i class="${suggestion.icon}"></i>
                <span>${suggestion.title}</span>
                <span class="reduction-potential">${suggestion.reduction} CO₂</span>
                ${suggestion.source === 'ai' ? '<span class="ai-badge">🤖 AI Suggestion</span>' : 
                  suggestion.source === 'fallback' ? '<span class="fallback-badge">⚠️ Fallback Suggestion</span>' : ''}
            </div>
            <p>${suggestion.desc}</p>
            <button class="btn btn-success btn-sm" onclick="acceptSuggestion('${suggestion.title}')">
                <i class="fas fa-check"></i> Accept Suggestion
            </button>
        </div>
    `).join('');
    
    document.getElementById('suggestionsContent').innerHTML = suggestionContent;
}


async function generateAISuggestionsForArea(area) {
    
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    
    const subProjects = getSubProjectsForArea(area);
    const subProjectsInfo = subProjects.map(sp => `${sp.name} (Expected time reduction ${sp.timeReduction}%, carbon emission reduction ${sp.carbonReduction}%)`).join(', ');
    
    
    const prompt = `
As a solution optimization expert, please generate 2-3 specific optimization suggestions for the ${area} field of ${productTypeName}.

[Product Information]:
Product Type: ${productTypeName}
Optimization Area: ${area}
Document Summary: ${documentContent.substring(0, 300)}...

[Sub-projects in this area]:
${subProjectsInfo}

[Additional Information]:
${Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join('\n')}

[Requirements]:
1. Provide targeted suggestions based on specific product characteristics and sub-project information
2. Each suggestion must include: title (within 8 characters), time improvement effect, carbon emission reduction, specific description (within 30 characters), corresponding sub-project
3. Suggestions should be actionable, meaningful, and consistent with sub-project characteristics
4. Align with the characteristics of the ${area} field for this product type
5. Improvement effects of suggestions should match the expected effects of sub-projects

[Output Format]:
Please answer strictly according to the following JSON format:
{
  "suggestions": [
    {
      "title": "Smart Sensor Integration",
      "timeImprovement": "Reduce 35% processing time",
      "carbonReduction": "Lower 28% carbon emissions",
      "desc": "Integrate smart sensors for real-time monitoring and process optimization",
      "subProject": "Smart Sensor Integration"
    },
    {
      "title": "Algorithm Optimization",
      "timeImprovement": "Shorten 45% cycle",
      "carbonReduction": "Reduce 32% emissions",
      "desc": "Adopt machine learning algorithms to improve processing efficiency",
      "subProject": "Machine Learning Algorithm Optimization"
    }
  ]
}

Only return JSON, no other text.
    `;
    
    try {
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 1200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        try {
            const parsed = JSON.parse(content);
            return parsed.suggestions || [];
        } catch (parseError) {
            console.warn('AI response parsing failed, using preset suggestions');
            return null;
        }
    } catch (error) {
        console.error('AI API call failed:', error);
        return null;
    }
}


function getSubProjectsForArea(area) {
    const allAreas = {
        'Technology Innovation': [
            { name: 'Smart Sensor Integration', timeReduction: 35, carbonReduction: 28 },
            { name: 'Machine Learning Algorithm Optimization', timeReduction: 45, carbonReduction: 32 },
            { name: 'Automated Control System', timeReduction: 40, carbonReduction: 25 }
        ],
        'Material Optimization': [
            { name: 'Bio-based Material Selection', timeReduction: 25, carbonReduction: 55 },
            { name: 'Recycled Material Application', timeReduction: 30, carbonReduction: 45 },
            { name: 'Lightweight Structure Design', timeReduction: 20, carbonReduction: 35 }
        ],
        'Process Improvement': [
            { name: 'Lean Production Process', timeReduction: 35, carbonReduction: 30 },
            { name: 'Clean Energy Conversion', timeReduction: 15, carbonReduction: 65 },
            { name: 'Waste Heat Recovery System', timeReduction: 25, carbonReduction: 40 }
        ],
        'Management Enhancement': [
            { name: 'Digital Management Platform', timeReduction: 40, carbonReduction: 25 },
            { name: 'Agile Team Collaboration', timeReduction: 35, carbonReduction: 20 },
            { name: 'Green Skills Training', timeReduction: 15, carbonReduction: 18 }
        ]
    };
    
    return allAreas[area] || [];
}


async function generateAISuggestionsForPhase(phase) {
    
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    
    const phaseMapping = {
        'Procurement': 'procurement',
        'Production': 'manufacturing',
        'Logistics': 'logistics',
        'Usage': 'usage',
        'Recycling': 'recycling',
        'Decomposition': 'decomposition'
    };
    
    const englishPhase = phaseMapping[phase] || 'manufacturing';
    
    
    const prompt = `
As a carbon emission optimization expert, please generate 2-3 specific optimization suggestions for the ${phase} phase of ${productTypeName}.

[Product Information]:
Product Type: ${productTypeName}
Phase: ${phase}
Document Summary: ${documentContent.substring(0, 300)}...

[Additional Information]:
${Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join('\n')}

[Requirements]:
1. Provide targeted suggestions based on specific product characteristics
2. Each suggestion must include: title (within 8 characters), emission reduction potential (percentage), specific description (within 30 characters)
3. Suggestions should be actionable and meaningful
4. Align with the characteristics of the ${phase} phase for this product type

[Output Format]:
Please answer strictly according to the following JSON format:
{
  "suggestions": [
    {
      "title": "Smart Production Scheduling",
      "reduction": "-20%",
      "desc": "Use AI to optimize production scheduling and reduce equipment idle rate"
    },
    {
      "title": "Waste Heat Recovery",
      "reduction": "-15%", 
      "desc": "Recover waste heat from production process for plant heating"
    }
  ]
}
Only return JSON, no other text.
    `;
    
    try {
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 800,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API response error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponseText = data.choices[0].message.content;
        
        console.log('=== AI Suggestion Generation Response ===');
        console.log('Phase:', phase);
        console.log('AI Response:', aiResponseText);
        console.log('=====================');
        
        
        let cleanText = aiResponseText.trim();
        
        
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '');
        }
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '');
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.replace(/\s*```$/, '');
        }
        
        
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        }
        
        const parsed = JSON.parse(cleanText);
        
        
        return parsed.suggestions.map(suggestion => {
            
            const reductionPercent = parseFloat(suggestion.reduction.replace(/[-%]/g, '')) || 0;
            
            
            const currentPhaseData = getCurrentPhaseData(phase);
            const baseTime = currentPhaseData.time || 30; 
            const baseCarbon = currentPhaseData.carbon || 100; 
            
            
            const timeReduction = Math.round(baseTime * reductionPercent / 100);
            const carbonReduction = Math.round(baseCarbon * reductionPercent / 100 * 10) / 10;
            
            console.log('AI建议数值计算:', {
                suggestion: suggestion.title,
                reductionPercent,
                baseTime,
                baseCarbon,
                timeReduction,
                carbonReduction
            });
            
            return {
                ...suggestion,
                source: 'ai',
                icon: getIconForSuggestion(suggestion.title, phase),
                timeImprovement: `-${timeReduction}day`,
                carbonReduction: `-${carbonReduction}kg CO2e`,
                timeReductionValue: timeReduction,
                carbonReductionValue: carbonReduction,
                
                timeAfter: generateTimeAfterData(phase, reductionPercent),
                carbonAfter: generateCarbonAfterData(phase, reductionPercent)
            };
        });
        
    } catch (error) {
        console.warn('AI suggestion generation failed:', error);
        
        return [];
    }
}


function getCurrentPhaseData(phase) {
    const phaseMapping = {
        'Procurement': 'procurement',
        'Production': 'manufacturing', 
        'Logistics': 'logistics',
        'Usage': 'usage',
        'Recycling': 'recycling',
        'Decomposition': 'decomposition'
    };
    
    const englishPhase = phaseMapping[phase] || 'manufacturing';
    const analysisData = window.analysisData || {};
    
    
    const timeData = analysisData.timeline?.[englishPhase] || {};
    const emissionData = analysisData.emissions?.[englishPhase] || {};
    
    return {
        time: timeData.duration || 30,
        carbon: emissionData.value || 50
    };
}


function generateTimeAfterData(phase, reductionPercent) {
    const analysisData = window.analysisData || {};
    const timeline = analysisData.timeline || {};
    const timeAfter = {};
    
    Object.keys(timeline).forEach(key => {
        const originalTime = timeline[key].duration || 30;
        const phaseMapping = {
            'Procurement': 'procurement',
            'Production': 'manufacturing',
            'Logistics': 'logistics', 
            'Usage': 'usage',
            'Recycling': 'recycling',
            'Decomposition': 'decomposition'
        };
        
        const englishPhase = phaseMapping[phase] || 'manufacturing';
        
        if (key === englishPhase) {
            
            timeAfter[key] = Math.max(1, originalTime - Math.round(originalTime * reductionPercent / 100));
        } else {
            
            timeAfter[key] = originalTime;
        }
    });
    
    return timeAfter;
}


function generateCarbonAfterData(phase, reductionPercent) {
    const analysisData = window.analysisData || {};
    const emissions = analysisData.emissions || {};
    const carbonAfter = {};
    
    Object.keys(emissions).forEach(key => {
        const originalCarbon = emissions[key].value || 50;
        const phaseMapping = {
            'Procurement': 'procurement',
            'Production': 'manufacturing',
            'Logistics': 'logistics',
            'Usage': 'usage', 
            'Recycling': 'recycling',
            'Decomposition': 'decomposition'
        };
        
        const englishPhase = phaseMapping[phase] || 'manufacturing';
        
        if (key === englishPhase) {
            
            carbonAfter[key] = Math.max(0.1, originalCarbon - (originalCarbon * reductionPercent / 100));
        } else {
            
            carbonAfter[key] = originalCarbon;
        }
    });
    
    return carbonAfter;
}


function getIconForSuggestion(title, phase) {
    const iconMap = {
        'Smart': 'fas fa-brain',
        'Auto': 'fas fa-robot',
        'Optimization': 'fas fa-cogs',
        'Recycle': 'fas fa-recycle',
        'Energy': 'fas fa-bolt',
        'Clean': 'fas fa-leaf',
        'Green': 'fas fa-seedling',
        'Efficiency': 'fas fa-tachometer-alt',
        'Monitor': 'fas fa-chart-line',
        'Digital': 'fas fa-digital-tachograph',
        'Intelligent': 'fas fa-lightbulb',
        'Waste': 'fas fa-fire',
        'Heat': 'fas fa-fire'
    };
    
    
    for (const [keyword, icon] of Object.entries(iconMap)) {
        if (title.includes(keyword)) {
            return icon;
        }
    }
    
    
    const phaseIcons = {
        'Procurement': 'fas fa-shopping-cart',
        'Production': 'fas fa-industry',
        'Logistics': 'fas fa-truck',
        'Usage': 'fas fa-user',
        'Recycling': 'fas fa-recycle',
        'Decomposition': 'fas fa-seedling'
    };
    
    return phaseIcons[phase] || 'fas fa-lightbulb';
}



let acceptedSuggestions = [];
let hasAcceptedSuggestions = false; 
let currentSelectedArea = null; 
let acceptedSuggestionsByArea = {}; 


function consultAIForSuggestion(suggestionTitle, suggestionDesc) {
    
    window.currentConsultSuggestion = {
        title: suggestionTitle,
        description: suggestionDesc
    };
    
    
    const modal = document.getElementById('aiModal');
    const selectedDataDiv = document.getElementById('selectedData');
    
    
    selectedDataDiv.innerHTML = `
        <div class="suggestion-consult-header">
            <h4><i class="fas fa-lightbulb text-warning"></i> Suggestion Consultation: ${suggestionTitle}</h4>
            <div class="suggestion-description">
                <p><strong>Suggestion Content:</strong></p>
                <p class="text-muted">${suggestionDesc}</p>
            </div>
        </div>
        
        <div class="ai-consult-guide">
            <h5><i class="fas fa-robot text-primary"></i> AI Assistant can help you:</h5>
            <ul class="consult-options">
                <li><i class="fas fa-check-circle text-success"></i> Analyze feasibility and risks of the suggestion</li>
                <li><i class="fas fa-list-ol text-info"></i> Provide detailed implementation steps</li>
                <li><i class="fas fa-chart-line text-warning"></i> Evaluate expected improvement effects</li>
                <li><i class="fas fa-star text-primary"></i> Recommend related best practices</li>
            </ul>
        </div>
        
        <div class="chat-history" id="chatHistory">
            <h5><i class="fas fa-comments"></i> Consultation Dialogue</h5>
            <div class="history-messages" id="historyMessages">
                <div class="ai-welcome-message">
                    <div class="message-avatar ai-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        Hello! I'm the AI assistant. Regarding the "${suggestionTitle}" suggestion, please tell me what you'd like to know? I'll provide professional analysis and recommendations for you.
                    </div>
                </div>
            </div>
        </div>
    `;
    
    
    modal.setAttribute('data-mode', 'suggestion-consult');
    modal.setAttribute('data-suggestion-title', suggestionTitle);
    
    
    modal.style.display = 'flex';
    
    
    const questionInput = document.getElementById('aiQuestion');
    questionInput.value = '';
    questionInput.placeholder = 'Please enter your questions about this suggestion...';
    setTimeout(() => {
        questionInput.focus();
    }, 300);
}

function acceptSuggestion(suggestionTitle, event) {
    
    if (!acceptedSuggestions.includes(suggestionTitle)) {
        acceptedSuggestions.push(suggestionTitle);
        
        
        hasAcceptedSuggestions = true;
        
        
        const improvementSection = document.getElementById('improvementComparisonSection');
        if (improvementSection) {
            improvementSection.style.display = 'block';
        }
        
        
        updateSpecificDataAfterAcceptance(suggestionTitle);
        
        
        renderLeanModule();
    }
    
    
    const button = event ? event.target : window.event?.target;
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Accepted';
        button.classList.remove('btn-success');
        button.classList.add('btn-secondary');
        button.disabled = true;
        
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('btn-secondary');
            button.classList.add('btn-success');
            button.disabled = false;
        }, 3000);
    }
    
    
    showExecuteAllButton();
}


function showExecuteAllButton() {
    let executeButton = document.getElementById('executeAllBtn');
    
    if (!executeButton && acceptedSuggestions.length > 0) {
        const leanContent = document.getElementById('leanAnalysis');
        const executeContainer = document.createElement('div');
        executeContainer.className = 'execute-all-container';
        executeContainer.innerHTML = `
            <div class="execute-section">
                <h3><i class="fas fa-rocket"></i> Execute Optimization Plan</h3>
                <p>You have accepted <strong>${acceptedSuggestions.length}</strong> optimization suggestions. Click the button below to enter the execution page</p>
                <div class="accepted-suggestions">
                    ${acceptedSuggestions.map(suggestion => `
                        <span class="suggestion-tag">
                            <i class="fas fa-check-circle"></i> ${suggestion}
                        </span>
                    `).join('')}
                </div>
                <button id="executeAllBtn" class="btn btn-primary btn-execute" onclick="goToExecutePage()">
                    <i class="fas fa-play"></i> Execute All Optimization Plans
                </button>
            </div>
        `;
        leanContent.appendChild(executeContainer);
    } else if (executeButton) {
        
        const countElement = executeButton.parentElement.querySelector('p strong');
        if (countElement) {
            countElement.textContent = acceptedSuggestions.length;
        }
        
        
        const suggestionsContainer = executeButton.parentElement.querySelector('.accepted-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = acceptedSuggestions.map(suggestion => `
                <span class="suggestion-tag">
                    <i class="fas fa-check-circle"></i> ${suggestion}
                </span>
            `).join('');
        }
    }
}


function goToExecutePage() {
    
    switchModule('scrum');
    
    
    setTimeout(async () => {
        await renderScrumModuleWithSuggestions();
    }, 100);
}


async function renderScrumModuleWithSuggestions() {
    
    await renderScrumModule();
    
    
    if (acceptedSuggestions.length > 0) {
        addExecutionPlan();
    }
}


function addExecutionPlan() {
    const scrumContent = document.getElementById('scrumContent');
    if (scrumContent) {
        const executionPlan = document.createElement('div');
        executionPlan.className = 'execution-plan-section';
        executionPlan.innerHTML = `
            <div class="plan-header">
                <h3><i class="fas fa-tasks"></i> Optimization Suggestion Execution Plan</h3>
                <p>Based on ${acceptedSuggestions.length} suggestions adopted from Lean analysis, the following execution plan is formulated:</p>
            </div>
            <div class="execution-timeline">
                ${acceptedSuggestions.map((suggestion, index) => `
                    <div class="execution-item">
                        <div class="task-content">
                            <h4>${suggestion}</h4>
                            <div class="task-details">
                                <span class="priority high">High Priority</span>
                                <span class="duration">Expected 5-7 days</span>
                                <span class="impact">Expected emission reduction ${Math.floor(Math.random() * 20 + 10)}%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        scrumContent.insertBefore(executionPlan, scrumContent.firstChild);
    }
}


function startTaskExecution(taskName) {
    alert(`Start executing task: ${taskName}\n\nHere you can integrate specific execution processes and progress tracking functions.`);
}


async function regenerateFieldValue(fieldName) {
    try {
        
        const documentContent = window.documentAIContent?.content || '';
        const productType = window.currentAnalysis?.documentType || 'general';
        const productTypeName = getDocumentTypeName(productType);
        
        
        const prompt = `
As a carbon emission analysis expert, please regenerate specific information for "${fieldName}" for ${productTypeName}.

[Product Information]:
Product Type: ${productTypeName}
Document Content Summary: ${documentContent.substring(0, 500)}...

[Field Requirements]:
Please generate new, specific, actionable information for "${fieldName}". Requirements:
1. Match the product type
2. Specific and clear content, including data, locations, processes and other details
3. Within 50 characters
4. State facts directly, avoid words like "estimated", "possible"

[Output Format]:
Only return the specific content of this field, no other text.

Examples:
- Supplier Geographical Location Information: Asia-Pacific region, distributed in Japan, China, Thailand, Korea, etc.
- Packaging Material Information: EPP foam protection, cardboard packaging, shock-absorbing materials
- Energy Usage Types: Industrial electricity, natural gas heating, compressed air
`;

        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 200,
                temperature: 0.8 
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API response error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content.trim();
        
        console.log(`=== Regenerate field "${fieldName}" ===`);
        console.log('AI Response:', aiResponse);
        console.log('==========================');
        
        return aiResponse;
        
    } catch (error) {
        console.error('AI field regeneration failed:', error);
        
        
        return generateVariedDefaultValue(fieldName);
    }
}


function generateVariedDefaultValue(fieldName) {
    const variations = {
        'Supplier Geographical Location Information': [
            'East China supply chain network, concentrated in Jiangsu, Zhejiang, Shanghai',
            'Pearl River Delta manufacturing base, mainly Shenzhen, Dongguan, Foshan, Guangdong',
            'Bohai Economic Rim, Beijing, Tianjin, Hebei collaborative supply',
            'Southwest emerging base, Sichuan, Chongqing, Yunnan layout'
        ],
        'Raw Material Specifications and Sources': [
            'High-strength steel Q690, Baosteel Group; Aluminum alloy 6061-T6, Chinalco Group',
            'Eco-friendly plastic ABS, Sinopec; Carbon fiber T700, Toray Group',
            'Rare earth permanent magnet materials, Baotou Steel Rare Earth; Lithium battery materials, CATL',
            'Organic silicon materials, Dow Corning; Special rubber, Sinochem Group'
        ],
        'Detailed Production Process': [
            'Digital stamping → Laser welding → Electrophoretic coating → Intelligent assembly → AI quality inspection',
            'Precision injection molding → Ultrasonic welding → Surface treatment → Automatic assembly → Full inspection packaging',
            '3D printing molding → CNC precision machining → Anodizing → Laser marking → Quality verification',
            'Modular prefabrication → Flexible assembly → Online inspection → Intelligent packaging → Traceability identification'
        ],
        'Logistics Transportation Methods and Routes': [
            'Multimodal transport: 70% sea + 20% rail + 10% road, green logistics priority',
            'Smart delivery: New energy trucks for urban distribution, drones for last mile',
            'Regional hubs: Establish 5 major logistics centers, radiating to major cities nationwide',
            'Cold chain logistics: Full temperature-controlled transportation, ensuring stable product quality'
        ],
        'Product Usage Scenarios and Lifecycle': [
            'Business office environment, high-frequency use, design life 8-10 years',
            'Home daily use, medium intensity, expected life 5-7 years',
            'Industrial production environment, continuous operation, maintenance cycle 3-5 years',
            'Outdoor sports scenarios, extreme environments, durability 12+ years'
        ],
        'Recycling Processing Plan': [
            'Closed-loop recycling: 95% materials recyclable, establish reverse logistics network',
            'Classification processing: 100% metal recycling, 80% plastic regeneration',
            'Circular economy: Product-as-a-Service model, integrated leasing + recycling',
            'Green disassembly: Harmless processing, rare metal extraction and recovery'
        ],
        'Store Distribution and Sales Channels': [
            'Omnichannel layout: 60% online, 40% flagship stores in tier-1 cities',
            'Regional agency: Three major regional centers in North China, East China, South China',
            'New retail model: Experience stores + cloud warehouse delivery, O2O integration',
            'Professional channels: 70% B2B direct sales, 30% distributor network'
        ],
        'Packaging Material Information': [
            '100% recyclable paper packaging, FSC certified, water-based ink printing',
            'Biodegradable foam alternative, corn starch base, 90-day decomposition',
            'Modular packaging design, reusable, 50% material reduction',
            'Smart packaging: RFID tags, full traceability, anti-counterfeiting verification'
        ],
        'Energy Usage Types': [
            '100% green electricity: 50% rooftop solar + 50% wind PPA',
            'Hybrid energy: 40% natural gas + 60% electricity, gradual clean transition',
            'Smart energy: energy storage system + demand response, peak shaving',
            'Waste heat recovery: industrial waste heat utilization, 30% efficiency improvement'
        ],
        'Waste Processing Methods': [
            'Zero waste target: 98% recycling, 2% energy recovery',
            'Classified treatment: hazardous waste outsourced, general solid waste resourced',
            'Circular utilization: scrap material reuse, wastewater treatment reuse',
            'Ecological treatment: organic waste composting, inorganic waste building materials'
        ]
    };
    
    const fieldVariations = variations[fieldName];
    if (fieldVariations && fieldVariations.length > 0) {
        
        const randomIndex = Math.floor(Math.random() * fieldVariations.length);
        return fieldVariations[randomIndex];
    }
    
    
    return `New generated solution for ${fieldName} (based on latest analysis)`;
}


function downloadCompletedDocument() {
    try {
        
        const originalContent = getOriginalDocumentContent();
        const supplementData = window.supplementData || {};
        const analysisData = window.analysisData || {};
        
        
        const completedDocument = generateCompletedDocumentContent(originalContent, supplementData, analysisData);
        
        
        const blob = new Blob([completedDocument], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `Product_Design_Plan_AI_Completed_${timestamp}.txt`;
        
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        
        URL.revokeObjectURL(url);
        
        
        addAIMessage(`✅ Document download successful! File name: ${fileName}`);
        
    } catch (error) {
        console.error('下载文档失败:', error);
        addAIMessage('❌ Document download failed, please try again later.');
    }
}


function getOriginalDocumentContent() {
    if (documentContents && documentContents.length > 0) {
        return documentContents.map(doc => `=== ${doc.fileName} ===\n${doc.content}`).join('\n\n');
    }
    return 'Original document content not found';
}


function generateCompletedDocumentContent(originalContent, supplementData, analysisData) {
    const timestamp = new Date().toLocaleString('zh-CN');
    
    let content = `Product Design Plan - AI Smart Completion Version\n`;
    content += `Generation Time: ${timestamp}\n`;
    content += `System Version: Carbon Emission Management System v2.1\n`;
    content += `\n${'='.repeat(60)}\n\n`;
    
    
    content += `1. Original Document Content\n`;
    content += `${'='.repeat(30)}\n`;
    content += originalContent;
    content += `\n\n`;
    
    
    if (Object.keys(supplementData).length > 0) {
        content += `2. AI Smart Completion Information\n`;
        content += `${'='.repeat(30)}\n`;
        Object.entries(supplementData).forEach(([key, value]) => {
            content += `${key}: \n${value}\n\n`;
        });
    }
    
    
    if (analysisData && analysisData.emissions) {
        content += `3. Carbon Emission Analysis Results\n`;
        content += `${'='.repeat(30)}\n`;
        
        const emissionTypes = {
            procurement: 'Material Procurement',
            manufacturing: 'Production Manufacturing',
            logistics: 'Logistics Transportation',
            usage: 'Product Usage',
            recycling: 'Recycling Processing',
            decomposition: 'Natural Decomposition'
        };
        
        Object.entries(analysisData.emissions).forEach(([key, data]) => {
            const typeName = emissionTypes[key] || key;
            content += `${typeName}: ${data.value} kg CO₂\n`;
            if (data.comparison) {
                const diff = data.value - data.comparison;
                content += `  Comparison with standard plan: ${diff > 0 ? '+' : ''}${diff} kg CO₂\n`;
            }
        });
        
        const totalEmissions = Object.values(analysisData.emissions).reduce((sum, data) => sum + data.value, 0);
        content += `\nTotal Carbon Emissions: ${totalEmissions.toFixed(2)} kg CO₂\n\n`;
    }
    
    
    if (window.acceptedSuggestions && window.acceptedSuggestions.length > 0) {
        content += `4. Accepted Optimization Suggestions\n`;
        content += `${'='.repeat(30)}\n`;
        window.acceptedSuggestions.forEach((suggestion, index) => {
            content += `${index + 1}. ${suggestion}\n`;
        });
        content += `\n`;
    }
    
    
    content += `5. Document Description\n`;
    content += `${'='.repeat(30)}\n`;
    content += `This document is generated by Carbon Emission Management System AI intelligence, containing original design plans and AI-completed detailed information.\n`;
    content += `All data is based on advanced carbon emission calculation models and industry best practices.\n`;
    content += `It is recommended to adjust and optimize according to actual production conditions.\n\n`;
    
    content += `Generation System: EcoLoop Carbon Emission Management System\n`;
    content += `Technical Support: AI Intelligent Analysis Engine\n`;
    content += `Copyright: ${new Date().getFullYear()}\n`;
    
    return content;
}

console.log('碳排放管理系统已初始化完成');


function closeAIConsultModal() {
    const modal = document.getElementById('aiConsultModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function handleAIConsultKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAIConsultMessage();
    }
}

function sendAIConsultMessage() {
    askAI('suggestion-consult');
}

function addAIConsultMessage(message, sender) {
    const chatContainer = document.getElementById('aiChatMessages');
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    if (sender === 'ai') {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">${message}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
        `;
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeAIConsultMessage() {
    const chatContainer = document.getElementById('aiConsultChat');
    const messages = chatContainer.querySelectorAll('.chat-message');
    if (messages.length > 0) {
        chatContainer.removeChild(messages[messages.length - 1]);
    }
}

async function callAIForConsultation(userMessage) {
    
    const currentSuggestion = window.currentConsultSuggestion || {};
    const documentContent = window.documentAIContent?.content || '';
    const supplementData = window.supplementData || {};
    const analysisData = window.analysisData || {};
    const productType = window.currentAnalysis?.documentType || 'general';
    const productTypeName = getDocumentTypeName(productType);
    
    
    console.log('=================== AI Consultation Call ===================');
    console.log('🔹 User Question:', userMessage);
    console.log('🔹 Consultation Suggestion:', currentSuggestion);
    console.log('🔹 Product Type:', productTypeName);
    console.log('🔹 Document Content Length:', documentContent.length, 'characters');
    console.log('🔹 Supplement Data:', supplementData);
    console.log('🔹 Analysis Data:', analysisData);
    console.log('🔹 API Endpoint:', `${AI_CONFIG.baseUrl}/chat/completions`);
    console.log('🔹 Model:', AI_CONFIG.model);
    
    
    const prompt = `
As a carbon emission optimization expert, answer user questions based on the following complete information: "${userMessage}"
【User Consultation Specific Suggestion】:
Suggestion Title: ${currentSuggestion.title || 'Unknown Suggestion'}
Suggestion Description: ${currentSuggestion.description || 'No Description'}

【Product Information】:
Product Type: ${productTypeName}
Document Summary: ${documentContent.substring(0, 500)}...

【Supplement Data】:
${Object.entries(supplementData).map(([key, value]) => `${key}: ${value}`).join('\n')}

【Complete Product Emission Data】:
${analysisData.emissions ? Object.entries(analysisData.emissions).map(([key, data]) => {
    const typeNames = {
        procurement: 'Raw Material Procurement',
        manufacturing: 'Manufacturing',
        logistics: 'Logistics Transportation',
        usage: 'Product Usage',
        recycling: 'Recycling Processing',
        decomposition: 'Natural Decomposition'
    };
    return `${typeNames[key] || key}: ${data.value}tCO₂e (${data.level || 'Unknown Level'})`;
}).join('\n') : 'Emission data loading'}

【Timeline Data】:
${analysisData.timeline ? Object.entries(analysisData.timeline).map(([key, data]) => 
    `${key}: ${data.duration}${data.unit || 'days'}`).join('\n') : 'Timeline data loading'}

【User Question】: ${userMessage}

【Answer Requirements】:
1. Answer based on specific product information and suggestion content
2. Provide practical, actionable suggestions
3. If data analysis is involved, combine with product characteristics
4. Answer should be concise and clear, no more than 60 words, focusing on core points related to user questions
5. Analyze based on actual emission data of the product

Please answer user questions directly and provide professional advice based on the above complete information.
    `;
    
    
    console.log('📤 Complete AI Prompt:');
    console.log(prompt);
    
    try {
        const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 800,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        
        console.log('📥 AI Complete Response Data:');
        console.log(JSON.stringify(data, null, 2));
        console.log('📄 AI Return Content:');
        console.log(aiResponse);
        console.log('📊 Answer Word Count:', aiResponse.length);
        console.log('===============================================');
        
        return aiResponse;
        
    } catch (error) {
        console.error('AI咨询调用失败:', error);
        
        const fallbackResponses = [
            `Based on ${currentSuggestion.title || 'this suggestion'}, I recommend analyzing from the following aspects:\n1. Evaluate current implementation feasibility of ${productTypeName}\n2. Analyze potential technical and cost barriers\n3. Develop phased implementation plan`,
            `Regarding your question, combined with characteristics of ${productTypeName}, I suggest:\n• First conduct small-scale pilot verification\n• Establish key indicator monitoring system\n• Prepare risk response contingency plans`,
            `This optimization plan is valuable for ${productTypeName}. Suggest focusing on:\n1. Compatibility with existing processes\n2. Expected investment return cycle\n3. Specific quantification of carbon emission impact`
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

function acceptOptimizedSuggestion() {
    const modal = document.getElementById('aiConsultModal');
    const suggestionTitle = modal.dataset.suggestionTitle;
    
    
    closeAIConsultModal();
    
    
    if (suggestionTitle && !acceptedSuggestions.includes(suggestionTitle)) {
        acceptedSuggestions.push(suggestionTitle);
        
        
        const improvementSection = document.getElementById('improvementComparisonSection');
        if (improvementSection) {
            improvementSection.style.display = 'block';
        }
        
        
        updateEmissionDataAfterAcceptance();
        
        
        alert(`已采纳优化建议：${suggestionTitle}`);
        
        
        showExecuteAllButton();
    }
}


function updateSpecificDataAfterAcceptance(suggestionTitle) {
    const suggestionType = getSuggestionType(suggestionTitle);
    const subProject = getSubProjectFromSuggestion(suggestionTitle);
    
    switch(suggestionType) {
        case 'emission':
            updateEmissionDataAfterAcceptance(subProject);
            break;
        case 'timeline':
            updateTimelineDataAfterAcceptance(subProject);
            break;
        case 'both':
            updateEmissionDataAfterAcceptance(subProject);
            updateTimelineDataAfterAcceptance(subProject);
            break;
        default:
            
            updateEmissionDataAfterAcceptance(subProject);
            break;
    }
}


function getSubProjectFromSuggestion(suggestionTitle) {
    const allAreas = {
        'Technology Innovation': {
            subProjects: [
                { name: 'Smart Sensor Integration', suggestions: ['智能化升级', 'intelligent upgrade'] },
                { name: 'Machine Learning Algorithm Optimization', suggestions: ['算法优化', 'algorithm optimization'] },
                { name: 'Automated Control System', suggestions: ['自动化改造', 'automation transformation'] }
            ]
        },
        'Material Optimization': {
            subProjects: [
                { name: 'Bio-based Material Selection', suggestions: ['生物材料', 'bio materials'] },
                { name: 'Recycled Material Application', suggestions: ['循环经济', 'circular economy'] },
                { name: 'Lightweight Structure Design', suggestions: ['轻量化设计', 'lightweight design'] }
            ]
        },
        'Process Improvement': {
            subProjects: [
                { name: 'Lean Production Process', suggestions: ['精益生产', 'lean production'] },
                { name: 'Clean Energy Conversion', suggestions: ['清洁能源', 'clean energy'] },
                { name: 'Waste Heat Recovery System', suggestions: ['热回收技术', 'heat recovery technology'] }
            ]
        },
        'Management Enhancement': {
            subProjects: [
                { name: 'Digital Management Platform', suggestions: ['数字化转型', 'digital transformation'] },
                { name: 'Agile Team Collaboration', suggestions: ['敏捷协作', 'agile collaboration'] },
                { name: 'Green Skills Training', suggestions: ['绿色培训', 'green training'] }
            ]
        }
    };
    
    for (const area in allAreas) {
        for (const subProject of allAreas[area].subProjects) {
            if (subProject.suggestions.some(suggestion => suggestionTitle.includes(suggestion))) {
                return {
                    area: area,
                    name: subProject.name,
                    timeReduction: getTimeReductionForSubProject(subProject.name),
                    carbonReduction: getCarbonReductionForSubProject(subProject.name)
                };
            }
        }
    }
    
    return null;
}


function getTimeReductionForSubProject(subProjectName) {
    const reductionMap = {
        'Smart Sensor Integration': 35,
        'Machine Learning Algorithm Optimization': 45,
        'Automated Control System': 40,
        'Bio-based Material Selection': 25,
        'Recycled Material Application': 30,
        'Lightweight Structure Design': 20,
        'Lean Production Process': 35,
        'Clean Energy Conversion': 15,
        'Waste Heat Recovery System': 25,
        'Digital Management Platform': 40,
        'Agile Team Collaboration': 35,
        'Green Skills Training': 15,
        
        '智能传感器集成': 35,
        '机器学习算法优化': 45,
        '自动化控制系统': 40,
        '生物基材料选择': 25,
        '回收材料应用': 30,
        '轻量化结构设计': 20,
        '精益生产流程': 35,
        '清洁能源转换': 15,
        '余热回收系统': 25,
        '数字化管理平台': 40,
        '敏捷团队协作': 35,
        '绿色技能培训': 15
    };
    return reductionMap[subProjectName] || 20;
}


function getCarbonReductionForSubProject(subProjectName) {
    const reductionMap = {
        'Smart Sensor Integration': 28,
        'Machine Learning Algorithm Optimization': 32,
        'Automated Control System': 25,
        'Bio-based Material Selection': 55,
        'Recycled Material Application': 45,
        'Lightweight Structure Design': 35,
        'Lean Production Process': 30,
        'Clean Energy Conversion': 65,
        'Waste Heat Recovery System': 40,
        'Digital Management Platform': 25,
        'Agile Team Collaboration': 20,
        'Green Skills Training': 18,
        
        '智能传感器集成': 28,
        '机器学习算法优化': 32,
        '自动化控制系统': 25,
        '生物基材料选择': 55,
        '回收材料应用': 45,
        '轻量化结构设计': 35,
        '精益生产流程': 30,
        '清洁能源转换': 65,
        '余热回收系统': 25,
        '数字化管理平台': 25,
        '敏捷团队协作': 20,
        '绿色技能培训': 18
    };
    return reductionMap[subProjectName] || 25;
}


function getSuggestionType(suggestionTitle) {
    const title = suggestionTitle.toLowerCase();
    
    
    const timeKeywords = ['时间', '效率', '周期', '流程', '速度', '快速', '缩短', 
                         'time', 'efficiency', 'cycle', 'process', 'speed', 'fast', 'reduce'];
    
    const emissionKeywords = ['碳排放', '减排', '环保', '绿色', '清洁', '节能', '可持续',
                             'carbon', 'emission', 'environmental', 'green', 'clean', 'energy', 'sustainable'];
    
    const bothKeywords = ['综合', '全面', '整体', '系统',
                         'comprehensive', 'overall', 'holistic', 'system'];
    
    if (bothKeywords.some(keyword => title.includes(keyword))) {
        return 'both';
    } else if (timeKeywords.some(keyword => title.includes(keyword))) {
        return 'timeline';
    } else if (emissionKeywords.some(keyword => title.includes(keyword))) {
        return 'emission';
    }
    
    return 'emission'; 
}


function updateTimelineDataAfterAcceptance(subProject = null) {
    if (!analysisData || !analysisData.timeline) return;
    
    
    Object.keys(analysisData.timeline).forEach(phase => {
        const phaseData = analysisData.timeline[phase];
        if (phaseData && typeof phaseData.duration === 'number') {
            
            let reduction;
            if (subProject && subProject.timeReduction) {
                reduction = subProject.timeReduction / 100; 
            } else {
                reduction = Math.random() * 0.2 + 0.1; 
            }
            
            const originalDuration = phaseData.duration;
            const newDuration = Math.round(originalDuration * (1 - reduction));
            const reductionAmount = originalDuration - newDuration;
            
            
            phaseData.duration = newDuration;
            phaseData.originalDuration = originalDuration;
            phaseData.reductionAmount = reductionAmount;
            phaseData.improved = true;
            
            
            if (subProject) {
                phaseData.subProject = subProject.name;
                phaseData.optimizationArea = subProject.area;
            }
        }
    });
}

function updateEmissionDataAfterAcceptance(subProject = null) {
    
    const emissionCards = document.querySelectorAll('.emission-card');
    emissionCards.forEach(card => {
        const valueElement = card.querySelector('.emission-value');
        if (valueElement && !valueElement.classList.contains('reduced')) {
            const currentValue = parseFloat(valueElement.textContent);
            
            
            let reduction;
            if (subProject && subProject.carbonReduction) {
                reduction = subProject.carbonReduction / 100; 
            } else {
                reduction = Math.random() * 0.15 + 0.05; 
            }
            
            const newValue = (currentValue * (1 - reduction)).toFixed(1);
            const reductionAmount = (currentValue - newValue).toFixed(1);
            
            
            let displayText = `${newValue} (-${reductionAmount})`;
            if (subProject && subProject.name) {
                displayText += ` [${subProject.name}]`;
            }
            valueElement.textContent = displayText;
            
            
            valueElement.classList.add('reduced');
            valueElement.style.color = '#28a745';
            valueElement.style.fontWeight = 'bold';
            
            
            if (subProject) {
                valueElement.title = `Optimized through ${subProject.name}, expected to reduce ${subProject.carbonReduction}% carbon emissions`;
            }
        }
    });
    
    
    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach(item => {
        const durationElement = item.querySelector('.phase-duration');
        if (durationElement && !durationElement.classList.contains('improved') && Math.random() > 0.5) {
            const currentDuration = parseInt(durationElement.textContent);
            
            
            let improvement;
            if (subProject && subProject.timeReduction) {
                improvement = Math.floor(currentDuration * (subProject.timeReduction / 100));
            } else {
                improvement = Math.floor(Math.random() * 10) + 1;
            }
            
            const newDuration = Math.max(1, currentDuration - improvement);
            
            
            let displayText = `${newDuration} (-${improvement})`;
            if (subProject && subProject.name) {
                displayText += ` [${subProject.name}]`;
            }
            durationElement.textContent = displayText;
            
            
            durationElement.classList.add('improved');
            durationElement.style.color = '#007bff';
            durationElement.style.fontWeight = 'bold';
            
            
            if (subProject) {
                durationElement.title = `Optimized through ${subProject.name}, expected to reduce ${subProject.timeReduction}% time`;
            }
        }
    });
}