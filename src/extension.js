const vscode = require('vscode');
const axios = require('axios');
require('dotenv').config()

/**
 * Function to get LLM suggestions from an API based on user input
 */
async function getSuggestions(codeSnippet, apiKey, provider) {
  let apiUrl, requestBody;

  // Adjust request body depending on the provider
  if (provider === 'Hugging Face') {
    apiUrl = 'https://api-inference.huggingface.co/models/bigcode/starcoder';
    requestBody = {
      inputs: `# Instruction: Provide a concise, well-optimized solution for the following code or task.\n\n${codeSnippet}`,
 // Improve the prompt
      parameters: { max_new_tokens: 200 }  // Increase max tokens for better results
    };
  } else if (provider === 'AWS') {
    apiUrl = 'https://api.aws.com/llama/generate';
    requestBody = {
      prompt: codeSnippet,
      max_tokens: 200  // Increase max tokens for better results
    };
  } else {
    apiUrl = 'https://api.openai.com/v1/completions';
    requestBody = {
      prompt: `Optimize and refactor the following code:\n\n${codeSnippet}`,  // Improve the prompt
      max_tokens: 200,  // Adjust max tokens
      temperature: 0.3,  // Control response randomness
      model: 'gpt-4'  // Switch to GPT-4 for better results
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
      return response.data.choices[0].text;  // OpenAI response structure
    }
  } catch (error) {
    vscode.window.showErrorMessage('Error fetching Code suggestion: ' + (error.response ? error.response.data.error : error.message));
    return '';
  }
}

/**
 * This function activates the extension
 */
function activate(context) {
 // Set your API key here
  const apiKey = "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"
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

    const provider = await vscode.window.showQuickPick([ 'Hugging Face'], { placeHolder: 'Select LLM Provider' });
    if (!provider) {
      vscode.window.showErrorMessage('No provider selected.');
      return;
    }

    const suggestion = await getSuggestions(codeSnippet, apiKey, provider);

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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
