const vscode = require('vscode');
const axios = require('axios');

/**
 * Function to get LLM suggestions from an API based on user input
 */
async function getSuggestions(codeSnippet, apiKey, provider, maxTokens, temperature) {
    let apiUrl, requestBody;

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
            model: 'c4ai-aya-23-8b',
            prompt: `Only provide the code for the following task : ${codeSnippet}`,
            max_tokens: 1000,
            temperature: 0.5,
            k: 5,                         
            p: 0.7,
            citation_quality: 'low',      
            search_queries_only: false,
        };
    } else if (provider === 'OpenAI GPT-4') {
        apiUrl = 'https://api.openai.com/v1/completions';
        requestBody = {
            prompt: `Optimize and refactor the following code:\n\n${codeSnippet}`,
            max_tokens: maxTokens,
            temperature: temperature,
            model: 'gpt-4',
        };
    } else if (provider === 'AWS Llama') {
        apiUrl = 'https://api.aws.com/v1/generate'; // Ensure this URL is correct for AWS Llama
        requestBody = {
            prompt: `${codeSnippet}`,
            max_tokens: maxTokens,
            temperature: temperature,
        };
    }

    try {
        const response = await axios.post(apiUrl, requestBody, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        console.log('Full API Response:', JSON.stringify(response.data, null, 2));

        if (provider === 'Hugging Face') {
            if (response.data && response.data.length > 0 && response.data[0].generated_text) {
                return response.data[0].generated_text.split('/*')[0];
            } else {
                return 'No suggestion found from Hugging Face.';
            }
        } else if (provider === 'Cohere') {
            if (response.data.generations && response.data.generations.length > 0) {
                return response.data.generations[0].text;
            } else {
                return 'No suggestion found from Cohere.';
            }
        } else if (provider === 'OpenAI GPT-4') {
            return response.data.choices[0].text;
        } else if (provider === 'AWS Llama') {
            return response.data.output;
        }
    } catch (error) {
        vscode.window.showErrorMessage('Error fetching code suggestion: ' + (error.response ? error.response.data.error : error.message));
        return '';
    }
}

// Utility function to check if a string is reversed and needs correction
function isReversed(text) {
    const reversedText = text.split('').reverse().join('');
    const matchingChars = text.split('').filter((char, i) => char === reversedText[i]).length;
    return matchingChars < text.length / 2;
}

// Function to insert suggestion into the editor character by character
async function insertSuggestion(editor, selection, suggestion) {
    if (isReversed(suggestion)) {
        suggestion = suggestion.split('').reverse().join('');
    }

    let charIndex = 0;
    const interval = 10;
    const textLength = suggestion.length;

    function insertNextChar() {
        if (charIndex < textLength) {
            editor.edit(editBuilder => {
                const currentText = editor.document.getText(selection);
                const updatedText = currentText + suggestion[charIndex];
                editBuilder.replace(selection, updatedText);
            }).then(() => {
                charIndex++;
                setTimeout(insertNextChar, interval);
            });
        } else {
            vscode.window.showInformationMessage('Code suggestion has been applied to your file.');
        }
    }

    insertNextChar();
}

/**
 * This function activates the extension.
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

        const provider = await vscode.window.showQuickPick(['Hugging Face', 'Cohere', 'OpenAI GPT-4', 'AWS Llama'], { placeHolder: 'Select LLM Provider' });
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
            await insertSuggestion(editor, selection, suggestion);
        } else {
            vscode.window.showErrorMessage('No suggestion found.');
        }
    });

    let deleteApiKey = vscode.commands.registerCommand('codegini.deleteApiKey', async function () {
        const provider = await vscode.window.showQuickPick(['Hugging Face', 'Cohere', 'OpenAI GPT-4', 'AWS Llama'], { placeHolder: 'Select LLM Provider to delete API key' });
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

    context.subscriptions.push(disposable, deleteApiKey);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
