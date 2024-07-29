export type Task = {
  title: string;
  completed: number;
  total: number;
  subtasks: SubTask[];
  tasks?: Task[];
};

export type SubTask = {
  completed: boolean;
  title: string;
};
