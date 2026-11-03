import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface ProjectCaseStudySectionsProps {
  problemStatement?: string | null;
  solution?: string | null;
  implementationDetails?: string | null;
  personalContribution?: string | null;
  whatsNext?: string | null;
}

interface CaseStudySectionProps {
  id: string;
  title: string;
  tag: string;
  content: string;
  isTimeline?: boolean;
}

function CaseStudySection({ id, title, tag, content, isTimeline = false }: CaseStudySectionProps) {
  return (
    <section
      id={id}
      aria-label={title}
      className="rounded-none border-2 border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_rgba(0,0,0,0.8)] transition-all hover:border-[#0057FF]"
    >
      <div className="flex items-center justify-between border-b-2 border-zinc-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-5 bg-[#0057FF] shrink-0" />
          <h2 className="text-base sm:text-lg font-black text-[#F5F5F2] uppercase tracking-tight font-['Syne',sans-serif]">
            {title}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider hidden sm:inline-block px-2.5 py-1 bg-white/5 border border-zinc-800">
          [{tag}]
        </span>
      </div>

      {isTimeline ? (
        <div className="relative pl-6 sm:pl-8 border-l border-zinc-800 ml-1.5 sm:ml-2 my-2">
          <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-none bg-[#0057FF]" />
          <div className="text-zinc-300">
            <MarkdownRenderer content={content} />
          </div>
        </div>
      ) : (
        <div className="text-zinc-300">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </section>
  );
}

export function ProjectCaseStudySections({
  problemStatement,
  solution,
  implementationDetails,
  personalContribution,
  whatsNext,
}: ProjectCaseStudySectionsProps) {
  const hasProblem = Boolean(problemStatement && problemStatement.trim().length > 0);
  const hasSolution = Boolean(solution && solution.trim().length > 0);
  const hasArchitecture = Boolean(implementationDetails && implementationDetails.trim().length > 0);
  const hasContribution = Boolean(personalContribution && personalContribution.trim().length > 0);
  const hasRoadmap = Boolean(whatsNext && whatsNext.trim().length > 0);

  if (!hasProblem && !hasSolution && !hasArchitecture && !hasContribution && !hasRoadmap) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="project-case-study-supplementary">
      {hasProblem && (
        <CaseStudySection
          id="project-problem-solved"
          title="The Problem Solved"
          tag="Problem Context"
          content={problemStatement!}
        />
      )}

      {hasSolution && (
        <CaseStudySection
          id="project-engineered-solution"
          title="The Engineered Solution"
          tag="System Solution"
          content={solution!}
        />
      )}

      {hasArchitecture && (
        <CaseStudySection
          id="project-technical-architecture"
          title="Technical Architecture & Key Decisions"
          tag="System Architecture"
          content={implementationDetails!}
        />
      )}

      {hasContribution && (
        <CaseStudySection
          id="project-key-contribution"
          title="Key Contribution"
          tag="Individual Scope"
          content={personalContribution!}
        />
      )}

      {hasRoadmap && (
        <CaseStudySection
          id="project-future-roadmap"
          title="Future Roadmap"
          tag="Milestones & Horizon"
          content={whatsNext!}
          isTimeline
        />
      )}
    </div>
  );
}
