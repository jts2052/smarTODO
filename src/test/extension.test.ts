import * as assert from "assert";
import * as vscode from "vscode";

// Define the decoration type to match the extension
const taskDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 0.25em",
    color: "gray",
  },
});

// Helper function to create a test file with simple content
async function createTestFile(content: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: content,
  });
  await vscode.window.showTextDocument(document);
  return document;
}

// Function to apply decorations for testing
async function applyDecorations(editor: vscode.TextEditor) {
  const text = editor.document.getText();
  const taskRegex = /{([^}]+)}/g;
  const subTaskRegex = /^\s*\[(X| )\] (.+)/gm;

  let taskMatch;
  let decorations: vscode.DecorationOptions[] = [];
  let currentTaskStart = 0;
  let currentTask: {
    title: string;
    completed: number;
    total: number;
    subtasks: { completed: boolean; title: string }[];
  } | null = null;

  while ((taskMatch = taskRegex.exec(text)) !== null) {
    const startPos = editor.document.positionAt(taskMatch.index);
    const endPos = editor.document.positionAt(
      taskMatch.index + taskMatch[0].length
    );

    let subtasks: { completed: boolean; title: string }[] = [];
    let subTaskMatch;
    let taskText = text.substring(taskRegex.lastIndex);

    while ((subTaskMatch = subTaskRegex.exec(taskText)) !== null) {
      if (subTaskMatch.index > 0) {
        subtasks.push({
          completed: subTaskMatch[1] === "X",
          title: subTaskMatch[2].trim(),
        });
      } else {
        break;
      }
    }

    if (currentTask) {
      decorations.push({
        range: new vscode.Range(
          editor.document.positionAt(currentTaskStart),
          editor.document.positionAt(
            currentTaskStart + currentTask.title.length
          )
        ),
        renderOptions: {
          after: {
            contentText: ` (${currentTask.completed}/${currentTask.total})`,
          },
        },
      });
    }

    currentTaskStart = taskRegex.lastIndex - taskMatch[0].length;
    currentTask = {
      title: taskMatch[1].trim(),
      completed: subtasks.filter((st) => st.completed).length,
      total: subtasks.length,
      subtasks: subtasks,
    };
  }

  if (currentTask) {
    decorations.push({
      range: new vscode.Range(
        editor.document.positionAt(currentTaskStart),
        editor.document.positionAt(currentTaskStart + currentTask.title.length)
      ),
      renderOptions: {
        after: {
          contentText: ` (${currentTask.completed}/${currentTask.total})`,
        },
      },
    });
  }

  // Apply decorations
  editor.setDecorations(taskDecorationType, decorations);
}

suite("Basic TODO Extension Test", () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  setup(async () => {
    // Create a new file with simple content
    document = await createTestFile(`
{Task1}
   [ ] Sub-task1
   [X] Sub-task2
`);
    editor = vscode.window.activeTextEditor!;
  });

  test("Should show correct decoration", async () => {
    // Apply decorations
    await applyDecorations(editor);

    // Check the text content around decorations to verify correct application
    const text = document.getText();
    const decorationText =
      editor.document.getText().match(/ \(\d+\/\d+\)/g) || [];
    assert.strictEqual(
      decorationText.length,
      1,
      "Decoration count is incorrect"
    );
    assert.strictEqual(
      decorationText[0],
      " (1/2)",
      "Decoration text is incorrect"
    );
  });
});
