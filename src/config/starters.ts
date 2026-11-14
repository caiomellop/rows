import type { AnimatedIcon } from "@/components/icons/animated";
import { CompassIcon } from "@/components/icons/compass";
import { FolderCodeIcon } from "@/components/icons/folder-code";
import { MicIcon } from "@/components/icons/mic";
import { SparklesIcon } from "@/components/icons/sparkles";

/**
 * Chat starters: shortcuts in the sidebar and on the new-chat screen. Clicking
 * one opens a new chat with `prompt` already sent. Edit this list to add,
 * remove or reword them; no component needs to change.
 */
export type Starter = { id: string; title: string; icon: AnimatedIcon; prompt: string };

export const STARTERS: Starter[] = [
  {
    id: "discovery",
    title: "Start my discovery",
    icon: CompassIcon,
    prompt:
      "I want to start my discovery. Interview me about my goals, then each job and project, one question at a time, so we can build my profile.",
  },
  {
    id: "headline",
    title: "Improve my headline",
    icon: SparklesIcon,
    prompt: "Help me improve my profile headline. Ask me what you need to know, then suggest a few stronger options.",
  },
  {
    id: "project",
    title: "Describe a project",
    icon: FolderCodeIcon,
    prompt:
      "I want to describe a project I worked on. Ask me about the problem, what I built and the result, then write it up for my profile.",
  },
  {
    id: "interview",
    title: "Prepare for an interview",
    icon: MicIcon,
    prompt:
      "Help me prepare for a job interview. Ask me which role it is for, then run a short mock interview based on my experience.",
  },
];
