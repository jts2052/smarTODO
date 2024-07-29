import * as vscode from "vscode";

export type Task = {
  title: string;
  completed: number;
  total: number;
  subtasks: SubTask[];
  startPos: vscode.Position;
  endPos: vscode.Position;
  tasks?: Task[];
};

export type SubTask = {
  completed: boolean;
  title: string;
};
