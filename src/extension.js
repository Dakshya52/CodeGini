const vscode = require('vscode');
const axios = require('axios');

/**
 * Function to get LLM suggestions from an API based on user input
 */
async function getSuggestions(codeSnippet, apiKey, provider, maxTokens, temperature, task = '') {
    let apiUrl, requestBody;

    // Adjust request body and API URL depending on the provider selected
    if (provider === 'Hugging Face') {
        apiUrl = 'https://api-inference.huggingface.co/models/bigcode/starcoder';
        requestBody = {
            inputs: `${codeSnippet}`,
            parameters: {
                max_new_tokens: 5120,
            },
        };
    } else if (provider === 'Cohere') {
        apiUrl = 'https://api.cohere.ai/v1/generate';
        requestBody = {
            model: 'command-r-08-2024',
            prompt: `When asked to generate any type of diagram, always produce a valid Mermaid diagram in the following format:

Node labels must be wrapped in double quotes, e.g., A["Start"] --> B["Hello"].
For example, instead of writing A[Start] --> B[hello], write A["Start"] --> B["hello"].
If the diagram contains expressions or complex labels, ensure they are correctly quoted.
Verify the Mermaid code is syntactically correct and starts with a supported keyword like graph, sequenceDiagram, or other valid diagram types.
If not asked for a diagram, simply perform the requested task without generating any Mermaid code.
Task: ${codeSnippet}`,
            max_tokens: 1500,
            temperature: 0.5,
            k: 5,
            p: 0.7,
        };
    } else if (provider === 'OpenAI GPT-4') {
        apiUrl = 'https://api.openai.com/v1/completions';
        requestBody = {
            prompt: `Task: ${codeSnippet}`,
            max_tokens: maxTokens,
            temperature: temperature,
            model: 'gpt-4',
        };
    }

    try {
        const response = await axios.post(apiUrl, requestBody, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        console.log('Full API Response:', JSON.stringify(response.data, null, 2));

        if (provider === 'Hugging Face') {
            return response.data[0]?.generated_text || 'No suggestion found from Hugging Face.';
        } else if (provider === 'Cohere') {
            return response.data.generations[0]?.text || 'No suggestion found from Cohere.';
        } else if (provider === 'OpenAI GPT-4') {
            return response.data.choices[0]?.text || 'No suggestion found from OpenAI.';
        }
    } catch (error) {
        vscode.window.showErrorMessage('Error fetching code suggestion: ' + (error.response ? error.response.data.error : error.message));
        return '';
    }
}

/**
 * Function to generate a Mermaid diagram and display it in a webview
 */
/**
 * Utility function to validate Mermaid code.
 */
function validateMermaidCode(mermaidCode) {
    // Simple validation for empty or invalid code
    if (!mermaidCode || !mermaidCode.trim()) {
        vscode.window.showErrorMessage('Generated Mermaid diagram is empty or invalid.');
        return false;
    }

    // Check for basic Mermaid diagram structure
    if (!mermaidCode.startsWith('graph ') && !mermaidCode.startsWith('sequenceDiagram') && !mermaidCode.startsWith('classDiagram')) {
        vscode.window.showErrorMessage('Generated Mermaid code does not match a known Mermaid diagram type.');
        return false;
    }

    return true;
}

/**
 * Clean up Mermaid code to avoid syntax errors.
 */
function cleanMermaidCode(mermaidCode) {
    console.log(typeof mermaidCode);
    return mermaidCode
        .replace(/^\s*\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\r/g, '')          // Normalize line endings
        .trim();                     // Remove extra whitespace
}

async function generateMermaidDiagram(mermaidCode) {
    const panel = vscode.window.createWebviewPanel(
        'mermaidPreview',
        'Mermaid Diagram Preview',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <script>
                (function() {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js";
                    script.onload = () => {
                        mermaid.initialize({ startOnLoad: true, htmlLabels: true });
                        try {
                            mermaid.contentLoaded();
                        } catch (error) {
                            document.body.innerHTML = 
                                "<pre style='color: red;'>Mermaid syntax error: " + error.message + "</pre>";
                        }
                    };
                    document.head.appendChild(script);
                })();
            </script>
        </head>
        <body>
            <div class="mermaid">
                ${mermaidCode}
            </div>
        </body>
        </html>
    `;
}




/**
 * Utility function to extract Mermaid code from an LLM response
 */
function extractMermaidCode(llmResponse) {
    const match = llmResponse.match(/```mermaid([\s\S]*?)```/);
    return match ? match[1].trim() : null;
}

// async function handleVoiceCommands(context) {
//     const panel = vscode.window.createWebviewPanel(
//         'voiceCommand',
//         'Voice Command Input',
//         vscode.ViewColumn.One,
//         { enableScripts: true }
//     );

//     panel.webview.html = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <style>
//                 body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
//                 button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
//                 #output { margin-top: 20px; font-size: 18px; }
//             </style>
//         </head>
//         <body>
//             <h1>Voice Command</h1>
//             <button id="startButton">Start Listening</button>
//             <div id="output">Waiting for your command...</div>
//             <script>
//                 const vscode = acquireVsCodeApi();
//                 const startButton = document.getElementById('startButton');
//                 const output = document.getElementById('output');
//                 let recognition;

//                 if ('webkitSpeechRecognition' in window) {
//                     recognition = new webkitSpeechRecognition();
//                     recognition.continuous = false;
//                     recognition.interimResults = false;
//                     recognition.lang = 'en-US';

//                     recognition.onstart = () => {
//                         output.textContent = 'Listening... Speak now.';
//                     };

//                     recognition.onerror = (event) => {
//                         output.textContent = 'Error: ' + event.error;
//                     };

//                     recognition.onresult = (event) => {
//                         const transcript = event.results[0][0].transcript.trim();
//                         output.textContent = 'Command received: ' + transcript;
//                         vscode.postMessage({ command: transcript });
//                     };

//                     recognition.onend = () => {
//                         output.textContent += ' (Stopped listening)';
//                     };

//                     startButton.addEventListener('click', () => {
//                         recognition.start();
//                     });
//                 } else {
//                     output.textContent = 'Voice recognition is not supported in your browser.';
//                 }
//             </script>
//         </body>
//         </html>
//     `;

//     panel.webview.onDidReceiveMessage(async (message) => {
//         const { command } = message;

//         if (command.toLowerCase().includes('generate diagram')) {
//             const editor = vscode.window.activeTextEditor;
//             if (!editor) {
//                 vscode.window.showErrorMessage('No active text editor found.');
//                 return;
//             }

//             const selection = editor.selection;
//             const codeSnippet = editor.document.getText(selection);
//             const suggestion = await getSuggestions(codeSnippet, 'your-api-key', 'OpenAI GPT-4', 1500, 0.7);

//             if (suggestion) {
//                 const mermaidCode = extractMermaidCode(suggestion);
//                 if (mermaidCode) {
//                     await generateMermaidDiagram(cleanMermaidCode(mermaidCode));
//                 } else {
//                     vscode.window.showErrorMessage('No valid Mermaid diagram found.');
//                 }
//             }
//         } else {
//             vscode.window.showInformationMessage(`Voice command not recognized: "${command}"`);
//         }
//     });
// }

/**
 * This function activates the extension.
 * Registers the command and provides the LLM suggestion to the editor.
 */
function activate(context) {
    const secretStorage = context.secrets;

    let disposable = vscode.commands.registerCommand('codegini.suggestCode', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const selection = editor.selection;
        const codeSnippet = editor.document.getText(selection);

        if (!codeSnippet) {
            vscode.window.showErrorMessage('No code selected.');
            return;
        }

        const provider = await vscode.window.showQuickPick(['Hugging Face', 'Cohere', 'OpenAI GPT-4'], { placeHolder: 'Select LLM Provider' });
        if (!provider) {
            vscode.window.showErrorMessage('No provider selected.');
            return;
        }

        let apiKey = await secretStorage.get(provider);
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({ prompt: `Enter your API key for ${provider}` });
            if (!apiKey) {
                vscode.window.showErrorMessage('No API key provided.');
                return;
            }
            await secretStorage.store(provider, apiKey);
        }

        const config = vscode.workspace.getConfiguration('llmPlugin');
        const maxTokens = config.get('maxTokens') || 3000;
        const temperature = config.get('temperature') || 0.7;

        const suggestion = await getSuggestions(codeSnippet, apiKey, provider, maxTokens, temperature);

        if (suggestion) {
            let mermaidCode = extractMermaidCode(suggestion);
                console.log('Mermaid Code:', mermaidCode);
            if (mermaidCode) {
                mermaidCode = cleanMermaidCode(mermaidCode);
                console.log('Clean Mermaid Code:', mermaidCode);
                if (validateMermaidCode(mermaidCode)) {
                    await generateMermaidDiagram(mermaidCode);
                }
            } else {
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, suggestion);
                });
                vscode.window.showInformationMessage('Code suggestion has been applied to your file.');
            }
        } else {
            vscode.window.showErrorMessage('No suggestion found.');
        }        
    });

    let deleteApiKey = vscode.commands.registerCommand('codegini.deleteApiKey', async function () {
        const provider = await vscode.window.showQuickPick(['Hugging Face', 'Cohere', 'OpenAI GPT-4'], { placeHolder: 'Select LLM Provider to delete API key' });
        if (!provider) {
            vscode.window.showErrorMessage('No provider selected.');
            return;
        }

        const confirm = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: `Are you sure you want to delete the API key for ${provider}?` });
        if (confirm !== 'Yes') {
            vscode.window.showInformationMessage('API key deletion cancelled.');
            return;
        }

        await secretStorage.delete(provider);
        vscode.window.showInformationMessage(`API key for ${provider} has been deleted.`);
    });
    // let voiceCommand = vscode.commands.registerCommand('codegini.voiceCommand', () => {
    //     handleVoiceCommands(context);
    // });

    context.subscriptions.push(disposable, deleteApiKey);
}

/**
 * This function is called when the extension is deactivated
 */
function deactivate() {}

// Export the activate and deactivate functions
module.exports = {
    activate,
    deactivate
};
