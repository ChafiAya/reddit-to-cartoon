export interface Story {
  id: string;
  title: string;
  summary: string;
  source?: string;
  panelCount?: number;
  visualStyle?: string;
  layoutStyle?: LayoutStyle;
  targetAudience?: string;
}

export type LayoutStyle = 'STORYBOOK' | 'COMIC_STRIP';

export interface Panel {
  id: number;
  description: string;
  caption: string;
  imageUrl?: string;
  isGenerating: boolean;
}

export interface Ebook {
  storyTitle: string;
  storySummary: string;
  panels: Panel[];
}

export interface AnalysisResult {
  score: number;
  viralPotential: 'Low' | 'Medium' | 'High' | 'Viral Hit';
  coherenceCheck: string;
  critique: string;
  textQuality: string;
  visualQuality: string;
  suggestions: string[];
}

export interface RefinedContent {
  newTitle: string;
  newSummary: string;
  refinedPanels: {
    id: number;
    caption: string;
  }[];
}

export enum AppState {
  DISCOVER = 'DISCOVER',
  SCRIPTING = 'SCRIPTING',
  BUILDING = 'BUILDING',
  READING = 'READING',
}

export type ImageEditMode = 'GENERATE' | 'EDIT';
