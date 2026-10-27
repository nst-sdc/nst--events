// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ProjectCaseStudySections } from '../components/projects/ProjectCaseStudySections';

afterEach(() => {
  cleanup();
});

describe('ProjectCaseStudySections Component', () => {
  it('renders all supplementary case study sections when content is provided', () => {
    const { container } = render(
      <ProjectCaseStudySections
        problemStatement="High packet loss and latency jitter over 5G networks during drone patrols."
        solution="Custom lightweight UDP gossip layer with forward error correction."
        implementationDetails="Architected in Rust with Tokio async runtime on Raspberry Pi CM4 nodes."
        personalContribution="Designed the consensus state-machine and wrote the UDP packet deserializer."
        whatsNext="1. Field trial with 32 UAVs\n2. Integrate UWB relative positioning\n3. Autonomous swarm recovery"
      />
    );

    // Section headings
    expect(screen.getByRole('heading', { name: 'The Problem Solved', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Engineered Solution', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Technical Architecture & Key Decisions', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Key Contribution', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Future Roadmap', level: 2 })).toBeInTheDocument();

    // Section textual content
    expect(screen.getByText(/High packet loss and latency jitter/)).toBeInTheDocument();
    expect(screen.getByText(/Custom lightweight UDP gossip layer/)).toBeInTheDocument();
    expect(screen.getByText(/Architected in Rust with Tokio/)).toBeInTheDocument();
    expect(screen.getByText(/Designed the consensus state-machine/)).toBeInTheDocument();
    expect(screen.getByText(/Field trial with 32 UAVs/)).toBeInTheDocument();

    // Verify dark surfaces and neutral borders (NO red/green/cyan/amber/purple cards)
    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(5);
    sections.forEach((sec) => {
      expect(sec.className).toContain('border-zinc-800');
      expect(sec.className).toContain('bg-zinc-950');
      expect(sec.className).not.toContain('border-rose-900');
      expect(sec.className).not.toContain('border-emerald-900');
      expect(sec.className).not.toContain('border-cyan-900');
      expect(sec.className).not.toContain('border-amber-900');
      expect(sec.className).not.toContain('border-purple-900');
      expect(sec.className).not.toContain('bg-rose-950');
      expect(sec.className).not.toContain('bg-emerald-950');
      expect(sec.className).not.toContain('bg-cyan-950');
      expect(sec.className).not.toContain('bg-amber-950');
      expect(sec.className).not.toContain('bg-purple-950');
    });

    // Roadmap restrained timeline track verification
    const roadmapSection = container.querySelector('#project-future-roadmap');
    expect(roadmapSection).toBeInTheDocument();
    const timelineTrack = roadmapSection?.querySelector('.border-l');
    expect(timelineTrack).toBeInTheDocument();
  });

  it('preserves rich Markdown formatting (code, bold, lists, tables) without data loss', () => {
    const complexArchitecture = `### Core Subsystems\n\n- **Ingress**: Zero-copy packet ring buffer\n- **Consensus**: Raft leader election over UDP\n\n\`\`\`rust\nfn dispatch_packet(buf: &[u8]) -> Result<(), Error> {\n    Ok(())\n}\n\`\`\``;

    const { container } = render(
      <ProjectCaseStudySections
        implementationDetails={complexArchitecture}
      />
    );

    expect(screen.getByText('Core Subsystems')).toBeInTheDocument();
    expect(screen.getByText('Ingress')).toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(screen.getByText(/dispatch_packet/)).toBeInTheDocument();
  });

  it('renders strictly nothing (null) when all fields are empty, null, or undefined', () => {
    const { container: c1 } = render(<ProjectCaseStudySections />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <ProjectCaseStudySections
        problemStatement={null}
        solution={null}
        implementationDetails={null}
        personalContribution={null}
        whatsNext={null}
      />
    );
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(
      <ProjectCaseStudySections
        problemStatement="   "
        solution=""
        implementationDetails={" \n\t "}
        personalContribution=""
        whatsNext={null}
      />
    );
    expect(c3.firstChild).toBeNull();
  });

  it('selectively hides optional sections when only a subset has content', () => {
    render(
      <ProjectCaseStudySections
        problemStatement="High latency during database failover."
        solution="Implemented dual-write caching."
      />
    );

    // Present sections
    expect(screen.getByText('The Problem Solved')).toBeInTheDocument();
    expect(screen.getByText('The Engineered Solution')).toBeInTheDocument();

    // Absent sections must NEVER render
    expect(screen.queryByText('Technical Architecture & Key Decisions')).toBeNull();
    expect(screen.queryByText('Key Contribution')).toBeNull();
    expect(screen.queryByText('Future Roadmap')).toBeNull();
  });

  it('presents contributions as readable content, not metric stat cards', () => {
    const contributionText = `Architected the asynchronous event-loop pipeline and resolved a critical race condition in the multi-threaded worker pool.`;

    render(
      <ProjectCaseStudySections
        personalContribution={contributionText}
      />
    );

    const contributionHeading = screen.getByText('Key Contribution');
    expect(contributionHeading).toBeInTheDocument();
    expect(screen.getByText(/critical race condition/)).toBeInTheDocument();

    // Verify it renders as readable prose, not numeric stat cards
    expect(screen.queryByText(/Total Commits/i)).toBeNull();
    expect(screen.queryByText(/PRs Merged/i)).toBeNull();
  });
});
