import * as vscode from 'vscode'
import { Task, SubTask, CompletionStatus } from './types/tasks'

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('smarTODO')
	const hideCompletedTasks = config.get<boolean>('hideCompletedTasks')
	const completionHighlightsEnabled = config.get<boolean>(
		'enableCompletionHighlights'
	)
	const completionHighlightsColor = config.get<string>(
		'completedHighlightColor'
	)
	const incompleteHighlightsColor = config.get<string>(
		'incompleteHighlightColor'
	)
	const showCompletionDate = config.get<boolean>('showCompletionDate')
	const showCreationDate = config.get<boolean>('showCreationDate')
	const showCreationTime = config.get<boolean>('showCreationTime')

	const taskDecorationType = vscode.window.createTextEditorDecorationType({
		after: {
			margin: '0 0 0 0.25em',
			color: 'gray',
		},
	})

	const completedDecorationType =
		vscode.window.createTextEditorDecorationType({
			backgroundColor: completionHighlightsColor,
		})

	const incompleteDecorationType =
		vscode.window.createTextEditorDecorationType({
			backgroundColor: incompleteHighlightsColor,
		})

	let disposable = vscode.commands.registerCommand(
		'smarTODO.openSettings',
		() => {
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'smarTODO'
			)
		}
	)

	context.subscriptions.push(disposable)

	let tasks: { [key: number]: Task } = {}

	let findAndUpdateTODOs = () => {
		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return
		}
		const document = editor.document
		const text = document.getText()
		const taskRegex: RegExp = /{([^}]+)}/g
		const subTaskRegex: RegExp = /^\s*\[(X|x|-| )?\]\s*(.*)/gm

		let taskDecorations: vscode.DecorationOptions[] = []
		let completedSubtaskDecorations: vscode.DecorationOptions[] = []
		let incompleteSubtaskDecorations: vscode.DecorationOptions[] = []

		let taskMatch
		let numTasks = 0
		let overFlowSubTask = null
		let nextMatch = taskRegex.exec(text)

		while ((taskMatch = nextMatch) !== null) {
			const startPos = editor.document.positionAt(taskMatch.index) // Start after the opening bracket
			const endPos = editor.document.positionAt(
				taskMatch.index + taskMatch[0].length // End before the closing bracket
			)

			nextMatch = taskRegex.exec(text)
			let subtasks: SubTask[] = []

			let taskEndIndex = nextMatch?.index ?? text.length

			let subTaskMatch
			let nextSubTaskMatch: RegExpExecArray | null =
				overFlowSubTask ?? subTaskRegex.exec(text)

			while (nextSubTaskMatch && nextSubTaskMatch.index <= taskEndIndex) {
				overFlowSubTask !== null
					? (subTaskMatch = overFlowSubTask)
					: (subTaskMatch = nextSubTaskMatch)
				nextSubTaskMatch = subTaskRegex.exec(text)
				nextSubTaskMatch !== null &&
				nextSubTaskMatch.index > taskEndIndex
					? (overFlowSubTask = nextSubTaskMatch)
					: (overFlowSubTask = null)

				const completionStatus = (() => {
					switch (subTaskMatch[1] as string) {
						case 'X':
						case 'x':
							return CompletionStatus.COMPLETED
						case '-':
							return CompletionStatus.INCOMPLETE
						default:
							return CompletionStatus.NOT_STARTED
					}
				})()

				subtasks.push({
					completionStatus,
					title: subTaskMatch[2].trim(),
				})

				const subTaskStartPos = editor.document.positionAt(
					subTaskMatch.index
				)
				const subTaskEndPos = editor.document.positionAt(
					subTaskMatch.index + subTaskMatch[0].length
				)

				const subTaskDecoration: vscode.DecorationOptions = {
					range: new vscode.Range(subTaskStartPos, subTaskEndPos),
				}

				if (completionStatus === CompletionStatus.COMPLETED) {
					completedSubtaskDecorations.push(subTaskDecoration)
				} else if (completionStatus === CompletionStatus.INCOMPLETE) {
					incompleteSubtaskDecorations.push(subTaskDecoration)
				}
			}

			const creationDateKey = `task-${numTasks}-creationDate`
			let creationDate: Date
			const storedDate =
				context.workspaceState.get<string>(creationDateKey)
			if (storedDate) {
				creationDate = new Date(storedDate)
			} else {
				creationDate = new Date()
				context.workspaceState.update(
					creationDateKey,
					creationDate.toISOString()
				)
			}

			tasks[numTasks] = {
				title: taskMatch[1].trim(),
				completed: subtasks.filter(
					(st) => st.completionStatus === CompletionStatus.COMPLETED
				).length,
				total: subtasks.length,
				subtasks: subtasks,
				startPos: startPos,
				endPos: endPos,
				creationDate: creationDate,
			}

			const decoration = {
				range: new vscode.Range(startPos, endPos),
				renderOptions: {
					after: {
						contentText:
							` (${tasks[numTasks].completed}/${tasks[numTasks].total})` +
							createDateTimeString(
								tasks[numTasks].creationDate,
								showCreationDate,
								showCreationTime
							),
					},
				},
			}
			taskDecorations.push(decoration)

			numTasks++
		}

		editor.setDecorations(taskDecorationType, taskDecorations)
		editor.setDecorations(
			completedDecorationType,
			completedSubtaskDecorations
		)
		editor.setDecorations(
			incompleteDecorationType,
			incompleteSubtaskDecorations
		)
	}

	// Completion provider for {}
	const mainTaskCompletionProvider =
		vscode.languages.registerCompletionItemProvider(
			'todo',
			{
				provideCompletionItems(
					document: vscode.TextDocument,
					position: vscode.Position
				) {
					const linePrefix = document
						.lineAt(position)
						.text.substring(0, position.character)
					if (!linePrefix.endsWith('{')) {
						return undefined
					}

					const completionItem = new vscode.CompletionItem(
						'{}',
						vscode.CompletionItemKind.Snippet
					)
					completionItem.insertText = new vscode.SnippetString('$1}')
					completionItem.documentation = new vscode.MarkdownString(
						'Insert a TODO task template'
					)

					return [completionItem]
				},
			},
			'{'
		)

	// Completion provider for []
	const subTaskCompletionProvider =
		vscode.languages.registerCompletionItemProvider(
			'todo',
			{
				provideCompletionItems(
					document: vscode.TextDocument,
					position: vscode.Position
				) {
					const linePrefix = document
						.lineAt(position)
						.text.substring(0, position.character)
					if (
						!linePrefix.endsWith('[') &&
						!linePrefix.endsWith('[')
					) {
						return undefined
					}

					const completionItem = new vscode.CompletionItem(
						'[ ]',
						vscode.CompletionItemKind.Snippet
					)
					completionItem.insertText = new vscode.SnippetString(
						' ] $1'
					)
					completionItem.documentation = new vscode.MarkdownString(
						'Insert a subtask template'
					)

					return [completionItem]
				},
			},
			'[',
			' '
		)

	context.subscriptions.push(
		mainTaskCompletionProvider,
		subTaskCompletionProvider
	)

	const createDateTimeString = (
		date: Date,
		showDate: boolean | undefined,
		showTime: boolean | undefined
	) => {
		if (!showDate && !showTime) {
			return ''
		}

		let dateString = ' Created: '
		if (showDate) {
			dateString += date.toLocaleDateString()
		}
		if (showTime) {
			dateString += `${
				showDate ? ' at ' : ''
			}${date.toLocaleTimeString()}`
		}

		return dateString
	}

	vscode.window.onDidChangeActiveTextEditor(
		findAndUpdateTODOs,
		null,
		context.subscriptions
	)
	vscode.workspace.onDidChangeTextDocument(
		findAndUpdateTODOs,
		null,
		context.subscriptions
	)

	if (vscode.window.activeTextEditor) {
		findAndUpdateTODOs()
	}
}

export function deactivate() {}
