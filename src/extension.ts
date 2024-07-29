import * as vscode from "vscode";
import { Task, SubTask } from "./types/tasks";

const taskDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    margin: "0 0 0 0.25em",
    color: "gray",
  },
});

// TODO: Change this, get data from config file
const boldAndLargeDecorationType = vscode.window.createTextEditorDecorationType(
  {
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    textDecoration: "font-weight: bold; font-size: 1.2em",
  }
);

export function activate(context: vscode.ExtensionContext) {
  let tasks: { [key: number]: Task } = {};

  let findAndUpdateTODOs = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const document = editor.document;
    const text = document.getText();
    const taskRegex: RegExp = /{([^}]+)}/g;
    const subTaskRegex: RegExp = /^\s*\[(X|x| )?\]\s*(.*)/gm;

    let decorations: vscode.DecorationOptions[] = [];
    let boldAndLargeDecorations: vscode.DecorationOptions[] = [];

    let taskMatch;
    let numTasks = 0;
    let overFlowSubTask = null;
    let nextMatch = taskRegex.exec(text);

    while ((taskMatch = nextMatch) !== null) {
      const startPos = editor.document.positionAt(taskMatch.index + 1); // Start after the opening bracket
      const endPos = editor.document.positionAt(
        taskMatch.index + taskMatch[0].length - 1 // End before the closing bracket
      );

      nextMatch = taskRegex.exec(text);
      let subtasks: SubTask[] = [];

      let taskEndIndex = nextMatch?.index ?? text.length;

      let subTaskMatch;
      let nextSubTaskMatch: RegExpExecArray | null =
        overFlowSubTask ?? subTaskRegex.exec(text);

      while (nextSubTaskMatch && nextSubTaskMatch.index <= taskEndIndex) {
        overFlowSubTask !== null
          ? (subTaskMatch = overFlowSubTask)
          : (subTaskMatch = nextSubTaskMatch);
        nextSubTaskMatch = subTaskRegex.exec(text);
        nextSubTaskMatch !== null && nextSubTaskMatch.index > taskEndIndex
          ? (overFlowSubTask = nextSubTaskMatch)
          : (overFlowSubTask = null);

        subtasks.push({
          completed: subTaskMatch[1]?.toLowerCase() === "x" || false,
          title: subTaskMatch[2].trim(),
        });
      }

      tasks[numTasks] = {
        title: taskMatch[1].trim(),
        completed: subtasks.filter((st) => st.completed).length,
        total: subtasks.length,
        subtasks: subtasks,
        startPos: startPos,
        endPos: endPos,
      };

      const decoration = {
        range: new vscode.Range(startPos, endPos),
        renderOptions: {
          after: {
            contentText: ` (${tasks[numTasks].completed}/${tasks[numTasks].total})`,
          },
        },
      };
      decorations.push(decoration);

      const boldAndLargeDecoration = {
        range: new vscode.Range(startPos, endPos),
      };
      boldAndLargeDecorations.push(boldAndLargeDecoration);

      numTasks++;
    }

    editor.setDecorations(taskDecorationType, decorations);
    editor.setDecorations(boldAndLargeDecorationType, boldAndLargeDecorations);
  };

  // Completion provider for {}
  const mainTaskCompletionProvider =
    vscode.languages.registerCompletionItemProvider(
      "todo",
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);
          if (!linePrefix.endsWith("{")) {
            return undefined;
          }

          const completionItem = new vscode.CompletionItem(
            "{}",
            vscode.CompletionItemKind.Snippet
          );
          completionItem.insertText = new vscode.SnippetString("$1}");
          completionItem.documentation = new vscode.MarkdownString(
            "Insert a TODO task template"
          );

          return [completionItem];
        },
      },
      "{"
    );

  // Completion provider for []
  const subTaskCompletionProvider =
    vscode.languages.registerCompletionItemProvider(
      "todo",
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);
          if (!linePrefix.endsWith("[") && !linePrefix.endsWith("[")) {
            return undefined;
          }

          const completionItem = new vscode.CompletionItem(
            "[ ]",
            vscode.CompletionItemKind.Snippet
          );
          completionItem.insertText = new vscode.SnippetString(" ] $1");
          completionItem.documentation = new vscode.MarkdownString(
            "Insert a subtask template"
          );

          return [completionItem];
        },
      },
      "[",
      " "
    );

  context.subscriptions.push(
    mainTaskCompletionProvider,
    subTaskCompletionProvider
  );

  vscode.window.onDidChangeActiveTextEditor(
    findAndUpdateTODOs,
    null,
    context.subscriptions
  );
  vscode.workspace.onDidChangeTextDocument(
    findAndUpdateTODOs,
    null,
    context.subscriptions
  );

  if (vscode.window.activeTextEditor) {
    findAndUpdateTODOs();
  }
}

export function deactivate() {}
