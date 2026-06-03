export type DisciplineId = "finance" | "marketing" | "social_work";

export type ActivityType = "clarifying_questions" | "notes" | "answer_attempt";

export type Difficulty = "novice" | "intermediate" | "advanced";

export interface FewShotExemplar {
  title: string;
  scenario: string;
  discussionQuestions: string[];
  rubric: string;
}

export interface PhaseDefinition {
  id: string;
  order: number;
  label: string;
  studentTitle: string;
  studentPrompt: string;
  activities: ActivityType[];
  disciplineHint?: string;
  // Optional suggested working time in minutes, shown to students as guidance
  // for a timed exercise. Advisory only — it does not gate or auto-advance.
  suggestedMinutes?: number;
}

export interface DifficultyHints {
  novice: string;
  intermediate: string;
  advanced: string;
}

export interface DisciplinePack {
  id: DisciplineId;
  label: string;
  blurb: string;
  // Cases in this discipline carry a quantitative core (numbers, calculations).
  // When true, the editor reminds the instructor that generated figures are
  // model-produced and unverified, and should be checked before approval.
  quantitative?: boolean;
  systemPrompt: string;
  styleNotes: string[];
  vocabulary: string[];
  difficultyHints: DifficultyHints;
  fewShots: FewShotExemplar[];
  rubricTemplate: string;
  defaultPhases: PhaseDefinition[];
}

export interface CaseInput {
  discipline: DisciplineId;
  learningObjective: string;
  difficulty: Difficulty;
  mustCoverConcepts: string[];
  targetLearnerProfile: {
    industry: string;
    role: string;
    priorKnowledge: string;
  };
}
