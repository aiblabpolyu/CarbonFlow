# CarbonFlow - Carbon Emission Management System

A web-based carbon emission management system that helps enterprises analyze product design carbon emissions and optimize production processes.


https://github.com/user-attachments/assets/743848e7-3860-4344-8944-83ad5dd8e236


## Features

### Core Functions

- **Intelligent Document Parsing** - Supports PDF, DOC, DOCX, TXT formats, AI automatically extracts key product design information
- **AI Information Completion** - Intelligently infers missing data based on document content, one-click auto-completion
- **Carbon Emission Analysis** - Precise calculation of carbon emissions across six lifecycle stages
- **Reverse Timeline** - Chronological visualization from product degradation to raw material procurement
- **Lean Optimization Recommendations** - AI deep analysis of high-emission causes, providing specific actionable optimization solutions
- **Scrum Task Management** - Automatically generates optimization execution tasks, Gantt chart visualization of project progress
- **Intelligent AI Assistant** - Select text to ask, bottom chat panel, shortcut key access, comprehensive intelligent support

### Six Lifecycle Stages

1. **Raw Material Procurement** - Track carbon footprint of raw material acquisition
2. **Manufacturing** - Analyze energy consumption and emissions in production process
3. **Logistics Transportation** - Calculate carbon emissions in transportation
4. **Product Usage** - Assess energy consumption during usage phase
5. **Recycling Processing** - Measure environmental impact of recycling and reuse
6. **Natural Decomposition** - Analyze carbon emissions from final product disposal

## Quick Start

### Step 1: Configure AI API Key

This system uses AI for intelligent analysis and requires API Key configuration:

1. **Copy configuration file**
```bash
cp config.example.js config.js
```

2. **Get API Key**

**Option 1: Use Alibaba Cloud DashScope (Recommended)**
- Visit [Alibaba Cloud DashScope Console](https://dashscope.console.aliyun.com/)
- Login and create API Key
- Supports DeepSeek, Qwen and other models
- Free quota for new users

**Option 2: Use OpenAI**
- Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create API Key
- Also need to modify `AI_CONFIG.baseUrl` and `model` in `script.js`

3. **Configure API Key**

Edit `config.js` file, replace `YOUR_API_KEY_HERE` with your actual API Key:

```javascript
window.AI_API_KEY = 'sk-your-actual-api-key-here';
```

**Important Notes:**
- `config.js` file is added to `.gitignore` and will not be committed to Git repository
- Do not share your real API Key with others or commit to public repositories
- If API Key is not configured, the system will use mock data for demonstration

### Step 2: Open Application

**No installation required!** Open directly in browser:

1. **Download or clone this project**
```bash
git clone <your-repo-url>
cd <project-folder>
```

2. **Open application**
   - Find `index_improved.html` file in project folder
   - Double-click to open, or right-click and select "Open with" → Choose browser (Chrome, Edge, Safari, etc.)
   - System will run automatically in browser

3. **Start using**
   - Upload product design documents
   - View AI analysis results
   - Manage carbon emission optimization tasks

That's it!

### Advanced: Local Server Mode (Optional)

For better performance and extended features, use Node.js to run local server:

**Requirements:** Node.js >= 18

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Access application
# http://localhost:3000
```

**Development mode (auto-restart):**
```bash
npm run dev
```

## Project Structure

```
carbonflow/
├── index_improved.html    # Main application page (double-click to open)
├── script.js              # Core JavaScript logic
├── config.example.js      # API Key configuration example file
├── config.js              # API Key configuration file (create yourself, not committed to Git)
├── styles.css             # Main stylesheet
├── variables.css          # CSS variables
├── animations.css         # Animation effects
├── ai-assistant.css       # AI assistant styles
├── improvements.css       # UI improvement styles
├── server.js              # Express server (optional)
├── package.json           # Project configuration (optional)
└── .gitignore             # Git ignore configuration
```

## Usage Guide

### Complete Workflow

#### Step 1: Upload Product Design Document

In "Document Upload" module:

1. **Upload file**
   - Click upload area or drag file directly to page
   - Supported formats: PDF, DOC, DOCX, TXT
   - System immediately starts parsing document content

2. **AI auto-analysis**
   - AI assistant automatically analyzes document content
   - Extracts product design key information
   - Displays analysis progress and result summary

3. **Intelligent information completion**
   - AI identifies missing key information
   - Click "Start Auto Complete" button
   - AI intelligently infers and fills based on document content:
     - Product material type and weight
     - Production process and energy consumption data
     - Transportation mode and distance
     - Expected service life
     - Recycling treatment method, etc.

4. **Start carbon emission analysis**
   - After information completion, "Start Analysis" button activates
   - Click button to start complete carbon emission calculation
   - System automatically switches to Kanban analysis module

#### Step 2: View Carbon Emission Analysis

Switch to "Kanban Analysis" module:

1. **Reverse timeline display**
   - Displays in reverse order from product lifecycle end (natural decomposition) to start (raw material procurement)
   - Six stages:
     - Natural Decomposition
     - Recycling Processing
     - Product Usage
     - Logistics Transportation
     - Manufacturing
     - Raw Material Procurement
   - Each stage shows time period and detailed description

2. **Carbon emission data cards**
   - Carbon emissions by stage (kgCO2e)
   - Visual charts showing emission proportions
   - Click cards to view detailed data
   - Can ask AI questions about any stage

3. **Interactive AI questions**
   - Select any data or text
   - "Ask AI" bubble button appears
   - Click to ask in bottom assistant panel
   - Shortcut: Cmd/Ctrl + J to quickly open AI assistant

#### Step 3: Get Optimization Recommendations

Switch to "Lean Optimization" module:

1. **High emission cause analysis**
   - System automatically identifies stages with highest carbon emissions
   - Deep analysis of specific causes of high emissions
   - Provides data support and comparative analysis

2. **Optimization recommendation solutions**
   - Material substitution recommendations (more eco-friendly material choices)
   - Energy optimization solutions (energy-saving process improvements)
   - Logistics route optimization (reduce transportation emissions)
   - Product design improvements (extend service life)
   - Recycling strategies (circular economy solutions)

3. **Expected emission reduction effects**
   - Expected emission reduction for each optimization measure
   - Implementation difficulty and cost assessment
   - Priority ranking recommendations

#### Step 4: Develop Execution Plan

Switch to "Scrum Execution" module:

1. **Auto-generate tasks**
   - AI automatically generates execution tasks based on optimization recommendations
   - Tasks include detailed descriptions and priorities
   - Automatically assigned to appropriate departments

2. **Gantt chart visualization**
   - Project Gantt chart displays all optimization tasks
   - Task timeline and dependencies clearly visible
   - Supports day view/week view switching

3. **Progress tracking**
   - View task execution status in real-time
   - Drag task cards to update status
   - Collaboration and communication

### AI Intelligent Assistant Features

System has multiple built-in AI interaction methods:

1. **Select text to ask**
   - Select any text or data with mouse
   - "Ask AI" bubble automatically appears
   - Click to ask questions about selected content

2. **Bottom assistant panel**
   - Shortcut: Cmd/Ctrl + J to quickly open
   - Supports continuous dialogue
   - Can pin panel (click Pin button)
   - Press Esc to close panel

3. **Contextual intelligent understanding**
   - AI understands current module
   - Automatically associates uploaded document content
   - Provides precise answers based on analysis data

### Usage Tips

- More detailed document content, more accurate AI analysis
- Can upload different versions of design documents for comparison
- In Kanban module, can ask AI anytime "Why is this stage emission high?"
- Tasks in Scrum module can be adjusted according to actual situation
- Use shortcut Cmd/Ctrl + J to call AI assistant anytime

## Technology Stack

- **Frontend**: HTML5, CSS3, Native JavaScript
- **Icons**: Font Awesome 6.0
- **Backend** (Optional): Express.js + Compression
- **Compatible**: Chrome, Edge, Safari, Firefox and other modern browsers

## Technical Features

- Zero dependency runtime - No need to install Node.js, open directly in browser
- Responsive design - Adapts to desktop and mobile devices
- Modern UI - Smooth animations and elegant interactions
- Offline available - Local file processing, no network required
- Modular architecture - Clear code structure, easy to extend

## Browser Requirements

- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 88+

## License

MIT License

## Contributing

Issues and Pull Requests are welcome!

---

Built with love for a greener future
