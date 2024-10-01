const vscode = require('vscode');
const axios = require('axios');

/**
 * Function to get LLM suggestions from an API based on user input
 */
async function getSuggestions(codeSnippet, apiKey, provider, maxTokens, temperature) {
  let apiUrl, requestBody;

  // Adjust request body and API URL depending on the provider selected
  if (provider === 'Hugging Face') {
    apiUrl = 'https://api-inference.huggingface.co/models/bigcode/starcoder';
    requestBody = {
      inputs: `# Instruction: Provide a concise, well-optimized solution for the following code or task.\n\n${codeSnippet}`,
      parameters: { max_new_tokens: maxTokens }  // Set max tokens from user config
    };
  } else if (provider === 'AWS Llama') {
    apiUrl = 'https://api.aws.com/llama/generate';
    requestBody = {
      prompt: codeSnippet,
      max_tokens: maxTokens  // Use user-configured max tokens
    };
  } else if (provider === 'OpenAI GPT-4') {
    apiUrl = 'https://api.openai.com/v1/completions';
    requestBody = {
      prompt: `Optimize and refactor the following code:\n\n${codeSnippet}`,
      max_tokens: maxTokens,  // Set max tokens from user config
      temperature: temperature,  // Use temperature from user config
      model: 'gpt-4'
    };
  }

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    // Log the entire response to understand its structure
    console.log('Full API Response:', JSON.stringify(response.data, null, 2));

    // Adjust response extraction depending on the provider
    if (provider === 'Hugging Face') {
      if (response.data && response.data.length > 0 && response.data[0].generated_text) {
        return response.data[0].generated_text.split('/*')[0]; 
      } else {
        return 'No suggestion found from Hugging Face.';
      }
    } else {
      return response.data.choices[0].text;  // OpenAI and AWS response structure
    }
  } catch (error) {
    vscode.window.showErrorMessage('Error fetching code suggestion: ' + (error.response ? error.response.data.error : error.message));
    return '';
  }
}

/**
 * This function activates the extension.
 * Registers the command and provides the LLM suggestion to the editor.
 */
function activate(context) {
  // Use VSCode Secret Storage for secure API key storage
  const secretStorage = context.secrets;

  // Register the main command for providing LLM-based code suggestions
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

    // Prompt user to select LLM provider
    const provider = await vscode.window.showQuickPick(['Hugging Face', 'AWS Llama', 'OpenAI GPT-4'], { placeHolder: 'Select LLM Provider' });
    if (!provider) {
      vscode.window.showErrorMessage('No provider selected.');
      return;
    }

    // Retrieve user-configured API key or prompt for it
    let apiKey = await secretStorage.get(provider);
    if (!apiKey) {
      apiKey = await vscode.window.showInputBox({ prompt: `Enter your API key for ${provider}` });
      if (!apiKey) {
        vscode.window.showErrorMessage('No API key provided.');
        return;
      }
      await secretStorage.store(provider, apiKey);  // Store API key securely
    }

    // Fetch user configuration settings for maxTokens and temperature
    const config = vscode.workspace.getConfiguration('llmPlugin');
    const maxTokens = config.get('maxTokens') || 3000;
    const temperature = config.get('temperature') || 0.3;

    // Get code suggestion from the selected provider
    const suggestion = await getSuggestions(codeSnippet, apiKey, provider, maxTokens, temperature);

    // Insert the suggestion into the code editor
    if (suggestion) {
      editor.edit(editBuilder => {
        editBuilder.replace(selection, suggestion);
      });
      vscode.window.showInformationMessage('Code suggestion has been applied to your file.');
    } else {
      vscode.window.showErrorMessage('No suggestion found.');
    }
  });

  context.subscriptions.push(disposable);
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
