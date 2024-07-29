import * as vscode from "vscode";
import { Task, SubTask } from "./types/tasks";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "todo-extension" is now active!'
  );

  // Command to search TODOs
  let searchTODOCommand = vscode.commands.registerCommand(
    "extension.searchTODO",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const text = document.getText();
        const taskRegex: RegExp = /{([^}]+)}/g;
        const subTaskRegex: RegExp = /^\s*\[(X|x| )?\]\s*(.*)/gm;

        let taskMatch;
        let tasks: { [key: number]: Task } = {};
        let numTasks = 0;

        let overFlowSubTask = null;

        let message = "";
        let nextMatch = taskRegex.exec(text);
        while ((taskMatch = nextMatch) !== null) {
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
          };
          message += `${numTasks}. ${tasks[numTasks].title} (${tasks[numTasks].completed}/${tasks[numTasks].total})\n`;

          numTasks++;
        }

        vscode.window.showInformationMessage(message);
      }
    }
  );

  context.subscriptions.push(searchTODOCommand);

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

  // Decoration to show completion status
  const taskDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 0.25em",
      color: "gray",
    },
  });

  const updateDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const text = editor.document.getText();
    const taskRegex = /{([^}]+)}/g;
    const subTaskRegex: RegExp = /^\s*\[(X|x| )?\]\s*(.*)/gm;

    let taskMatch;
    let decorations: vscode.DecorationOptions[] = [];
    let tasks: { [key: number]: Task } = {};
    let numTasks = 0;

    let overFlowSubTask = null;

    let nextMatch = taskRegex.exec(text);
    while ((taskMatch = nextMatch) !== null) {
      const startPos = editor.document.positionAt(taskMatch.index);
      const endPos = editor.document.positionAt(
        taskMatch.index + taskMatch[0].length
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

      numTasks++;
    }

    // Apply decorations
    editor.setDecorations(taskDecorationType, decorations);
  };

  vscode.window.onDidChangeActiveTextEditor(
    updateDecorations,
    null,
    context.subscriptions
  );
  vscode.workspace.onDidChangeTextDocument(
    updateDecorations,
    null,
    context.subscriptions
  );

  if (vscode.window.activeTextEditor) {
    updateDecorations();
  }
}

export function deactivate() {}
