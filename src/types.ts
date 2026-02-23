export type Difficulty = 'easy' | 'medium' | 'hard';
export type Mode = 'normal' | 'daily';

export interface Score {
  id?: number;
  name: string;
  wpm: number;
  accuracy: number;
  difficulty: Difficulty;
  mode: Mode;
  date?: string;
}

export interface UserProgress {
  wpm: number;
  accuracy: number;
  date: string;
}
