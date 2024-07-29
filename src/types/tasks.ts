import * as vscode from 'vscode'

export type Task = {
	title: string
	completed: number
	total: number
	subtasks: SubTask[]
	startPos: vscode.Position
	endPos: vscode.Position
	creationDate: Date
	completionDate?: Date
	tasks?: Task[]
}

export type SubTask = {
	// completed: boolean
	completionStatus: CompletionStatus
	title: string
}

export enum CompletionStatus {
	COMPLETED,
	INCOMPLETE,
	NOT_STARTED,
}
