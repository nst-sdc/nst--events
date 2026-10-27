// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PublicProjectDetailPage from '../app/(public)/projects/[slug]/page';
import { ProjectMediaGallery } from '../components/projects/ProjectMediaGallery';
import { projectsApi, ProjectDetail } from '../lib/projects-api';
import { ProjectForm } from '../components/projects/ProjectForm';
import * as authStoreModule from '../lib/auth-store';

// Mock Next.js navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({
    slug: 'distributed-autonomous-fleet',
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mock layout providers
vi.mock('../components/layout/StudentAppShell', () => ({
  StudentAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-app-shell">{children}</div>,
}));

vi.mock('../components/layout/ClubAdminProvider', () => ({
  ClubAdminProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="club-admin-provider">{children}</div>,
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: 'visitor-1', email: 'visitor@adypu.edu.in', role: 'STUDENT' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe('Premium Engineering Case Study Project Detail Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fullProject: ProjectDetail = {
      id: 'proj-full-1',
      owner_id: 'usr-lead-1',
      title: 'Autonomous Drone Swarm Telemetry',
      slug: 'drone-swarm-telemetry',
      tagline: 'Sub-5ms mesh synchronization and real-time aerial fleet coordination.',
      description: `# Swarm Telemetry Specification\n\nHigh-throughput mesh gossip protocol for UAVs.\n\n## Performance Benchmarks\n\n| Cluster Size | Sync Latency | Packet Loss |\n| :--- | :---: | ---: |\n| 16 Nodes | 2.1ms | 0.001% |\n| 64 Nodes | 4.8ms | 0.004% |\n\n\`\`\`rust\npub async fn broadcast_telemetry(packet: &Packet) -> Result<(), SwarmError> {\n    Ok(())\n}\n\`\`\``,
      problem_statement: 'High packet loss and latency jitter over 5G networks during multi-drone campus security patrols.',
      solution: 'Custom lightweight UDP gossip layer with forward error correction and edge consensus.',
      implementation_details: 'Architected in Rust with Tokio async runtime, running on embedded Raspberry Pi CM4 nodes.',
      personal_contribution: 'Designed the consensus state-machine and wrote the high-throughput UDP packet deserializer.',
      whats_next: 'Integrating ultra-wideband (UWB) relative positioning for GPS-denied environments.',
      category: 'Robotics / Hardware',
      tags: ['rust', 'tokio', 'udp', 'mesh-networking', 'robotics'],
      project_type: 'RESEARCH',
      development_status: 'COMPLETED',
      visibility: 'PUBLISHED',
      published_at: '2026-10-18T10:00:00Z',
      cover_image_url: 'https://storage.googleapis.com/nst-bucket/genuine-drone-cover.jpg',
      gallery_image_urls: [
        'https://storage.googleapis.com/nst-bucket/drone-arch-diagram.png',
        'https://storage.googleapis.com/nst-bucket/latency-benchmark-chart.png',
      ],
      like_count: 88,
      view_count: 1420,
      author: {
        name: 'Kabir Verma',
        slug: 'kabir-verma',
        avatar_url: 'https://images.unsplash.com/kabir.jpg',
      },
      links: [
        { id: 'lnk-1', type: 'DEMO', url: 'https://drone-swarm.live', label: 'Telemetry Console', order: 0 },
        { id: 'lnk-2', type: 'REPOSITORY', url: 'https://github.com/nst-sdc/drone-swarm', label: 'GitHub Repository', order: 1 },
        { id: 'lnk-3', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'Field Flight Demo', order: 2 },
        { id: 'lnk-4', type: 'DOCUMENTATION', url: 'https://docs.drone-swarm.live', label: 'API Specs', order: 3 },
      ],
      contributors: [
        {
          id: 'contrib-1',
          name: 'Ananya Sen',
          slug: 'ananya-sen',
          role: 'Flight Control Algorithms',
          avatar_url: null,
          status: 'ACCEPTED',
          email: 'ananya.sen@adypu.edu.in', // Must never be exposed
        },
        {
          id: 'contrib-2',
          name: 'Pending Contributor',
          slug: 'pending-user',
          role: 'Tester',
          avatar_url: null,
          status: 'PENDING',
          invited_email: 'pending@adypu.edu.in', // Must never be exposed
        },
      ],
    };

  // =========================================================================
  // 1. Hero Single Title, Non-Duplication & Clean Metadata
  // =========================================================================
  describe('Hero Architecture & Single Title Display', () => {
    it('renders the project title only ONCE as an h1 heading', async () => {
      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(fullProject as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'drone-swarm-telemetry' }),
      });

      render(page);

      // Verify exactly ONE h1 element with the project title exists
      const headings = screen.getAllByRole('heading', { level: 1 });
      const matchingH1s = headings.filter((h) => h.textContent?.includes('Autonomous Drone Swarm Telemetry'));
      expect(matchingH1s).toHaveLength(1);

      // Verify the tagline is displayed
      expect(screen.getByText(/Sub-5ms mesh synchronization/)).toBeInTheDocument();

      // Verify single category badge and status
      expect(screen.getAllByText('Robotics / Hardware').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1);
    });

    it('displays all valid showcase action links without dead buttons', async () => {
      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(fullProject as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'drone-swarm-telemetry' }),
      });

      render(page);

      // Verify genuine links exist
      const demoLink = screen.getByRole('link', { name: /Telemetry Console/i });
      expect(demoLink).toHaveAttribute('href', 'https://drone-swarm.live');

      const repoLink = screen.getByRole('link', { name: /GitHub Repository/i });
      expect(repoLink).toHaveAttribute('href', 'https://github.com/nst-sdc/drone-swarm');

      const videoLink = screen.getByRole('link', { name: /Field Flight Demo/i });
      expect(videoLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const docLink = screen.getByRole('link', { name: /API Specs/i });
      expect(docLink).toHaveAttribute('href', 'https://docs.drone-swarm.live');
    });

    it('does NOT render showcase artifact bar if no links exist on project', async () => {
      const noLinksProject = {
        ...fullProject,
        links: [],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(noLinksProject as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'drone-swarm-telemetry' }),
      });

      render(page);

      expect(screen.queryByText(/Showcase Artifacts:/i)).toBeNull();
    });
  });

  // =========================================================================
  // 2. ProjectMediaGallery: Genuine Cover, Screenshots, Lightbox & Video
  // =========================================================================
  describe('ProjectMediaGallery Component', () => {
    it('supports multiple screenshots with thumbnail switching and captions', () => {
      render(
        <ProjectMediaGallery
          coverImageUrl="https://storage.googleapis.com/nst/cover.png"
          galleryImageUrls={[
            'https://storage.googleapis.com/nst/screen1.png',
            'https://storage.googleapis.com/nst/screen2.png',
          ]}
          videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          videoLabel="Flight Test"
          title="Swarm Robotics"
          category="Robotics / Hardware"
        />
      );

      // Verify thumbnails rendered
      expect(screen.getByRole('button', { name: /Cover Image/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Screenshot 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Screenshot 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Flight Test/i })).toBeInTheDocument();

      // Click Screenshot 1
      fireEvent.click(screen.getByRole('button', { name: /Screenshot 1/i }));
      expect(screen.getByText('Product Showcase Artifact #1')).toBeInTheDocument();

      // Click Lightbox Expand
      const expandBtn = screen.getByRole('button', { name: /Expand/i });
      fireEvent.click(expandBtn);

      // Verify modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Close modal/i });
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('embeds YouTube video player when Video tab is selected', () => {
      const { container } = render(
        <ProjectMediaGallery
          coverImageUrl="https://storage.googleapis.com/nst/cover.png"
          videoUrl="https://youtu.be/dQw4w9WgXcQ"
          videoLabel="Field Demo"
          title="Swarm Robotics"
          category="Robotics / Hardware"
        />
      );

      // Switch to video tab
      fireEvent.click(screen.getByRole('button', { name: /Field Demo/i }));

      // Verify iframe with embed URL is created
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('falls back to category-themed artwork when cover is stock-watermarked', () => {
      const { container } = render(
        <ProjectMediaGallery
          coverImageUrl="https://www.shutterstock.com/image-photo/stock-drone.jpg"
          title="Swarm Robotics"
          category="Robotics / Hardware"
        />
      );

      // Stock watermark should NOT render an <img> with that URL
      const images = container.querySelectorAll('img');
      images.forEach((img) => {
        expect(img.getAttribute('src')).not.toContain('shutterstock.com');
      });

      // Instead renders the clean category fallback
      expect(screen.getByText('NST PROJECT SHOWCASE')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Long-Form Case Study & Optional Engineering Deep-Dives
  // =========================================================================
  describe('Long-Form Case Study & Technical Sections', () => {
    it('renders structured engineering deep dives only when data is present', async () => {
      const projectWithDeepDive: ProjectDetail = {
        id: 'proj-deep-1',
        owner_id: 'usr-1',
        title: 'Edge ML Inference Engine',
        slug: 'edge-ml-engine',
        tagline: 'Quantized INT8 neural models on microcontrollers.',
        description: `# Technical Specification\n\nDeep neural execution directly on ARM Cortex-M microcontrollers.`,
        problem_statement: 'Cloud latency and high cellular bandwidth costs for remote IoT sensor nodes.',
        solution: '8-bit integer quantization pipeline with automated operator fusion.',
        implementation_details: 'Written in C++20 and deployed with tinyML toolchains.',
        personal_contribution: 'Implemented the memory-efficient convolution kernel.',
        whats_next: 'Expanding operator support for recurrent networks.',
        category: 'AI / Machine Learning',
        tags: ['cpp', 'tinyml', 'arm'],
        project_type: 'RESEARCH',
        development_status: 'PROTOTYPE',
        visibility: 'PUBLISHED',
        published_at: '2026-10-19T10:00:00Z',
        cover_image_url: 'https://images.unsplash.com/chips.jpg',
        like_count: 12,
        view_count: 310,
        author: {
          name: 'Rohan Mehra',
          slug: 'rohan-mehra',
          avatar_url: null,
        },
        links: [],
        contributors: [],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(projectWithDeepDive as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'edge-ml-engine' }),
      });

      render(page);

      // Verify all non-empty sections render
      expect(screen.getByText('The Problem Solved')).toBeInTheDocument();
      expect(screen.getByText(/Cloud latency and high cellular bandwidth/)).toBeInTheDocument();

      expect(screen.getByText('The Engineered Solution')).toBeInTheDocument();
      expect(screen.getByText(/8-bit integer quantization/)).toBeInTheDocument();

      expect(screen.getByText('Technical Architecture & Key Decisions')).toBeInTheDocument();
      expect(screen.getByText(/Written in C\+\+20/)).toBeInTheDocument();

      expect(screen.getByText('Key Contribution')).toBeInTheDocument();
      expect(screen.getByText(/memory-efficient convolution kernel/)).toBeInTheDocument();

      expect(screen.getByText('Future Roadmap')).toBeInTheDocument();
      expect(screen.getByText(/recurrent networks/)).toBeInTheDocument();
    });

    it('omits deep dive cards entirely when fields are empty', async () => {
      const minimalProject: ProjectDetail = {
        id: 'proj-min-1',
        owner_id: 'usr-1',
        title: 'Minimal Utility Script',
        slug: 'minimal-script',
        tagline: 'Simple CLI tool for campus batch backups.',
        description: `A lightweight bash CLI utility that backs up laboratory workstation databases.`,
        category: 'Developer Tools',
        tags: [],
        project_type: 'PERSONAL',
        development_status: 'COMPLETED',
        visibility: 'PUBLISHED',
        published_at: null,
        cover_image_url: 'https://images.unsplash.com/backup.jpg',
        like_count: 2,
        view_count: 50,
        author: {
          name: 'Tara Rao',
          slug: 'tara-rao',
          avatar_url: null,
        },
        links: [],
        contributors: [],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(minimalProject as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'minimal-script' }),
      });

      render(page);

      // Verify none of the optional deep-dive headers are rendered
      expect(screen.queryByText('The Problem Solved')).toBeNull();
      expect(screen.queryByText('The Engineered Solution')).toBeNull();
      expect(screen.queryByText('Technical Architecture & Key Decisions')).toBeNull();
      expect(screen.queryByText('Key Contribution')).toBeNull();
      expect(screen.queryByText('Future Roadmap')).toBeNull();

      // Verify Technology stack card is also omitted since tags are empty
      expect(screen.queryByText('Technologies & Tools')).toBeNull();
    });
  });

  // =========================================================================
  // 4. People, Attribution & Strict Privacy
  // =========================================================================
  describe('People Attribution & Privacy Protections', () => {
    it('links creator and accepted collaborators to their portfolios and strictly hides emails', async () => {
      const teamProject: ProjectDetail = {
        id: 'proj-team-1',
        owner_id: 'usr-team-owner',
        title: 'Campus Electric Rover',
        slug: 'campus-rover',
        tagline: 'Autonomous electric logistics rover for campus package delivery.',
        description: `# Electric Rover\n\nHardware chassis, BMS controller, and ROS navigation stack.`,
        category: 'Robotics / Hardware',
        tags: ['ros2', 'embedded-c', 'hardware'],
        project_type: 'HACKATHON',
        development_status: 'LIVE',
        visibility: 'PUBLISHED',
        published_at: '2026-10-15T12:00:00Z',
        cover_image_url: 'https://images.unsplash.com/rover.jpg',
        like_count: 45,
        view_count: 850,
        author: {
          name: 'Vikram Joshi',
          slug: 'vikram-joshi',
          avatar_url: null,
        },
        links: [],
        contributors: [
          {
            id: 'c-accepted-1',
            name: 'Pooja Hegde',
            slug: 'pooja-hegde',
            role: 'BMS Battery Architect',
            avatar_url: null,
            status: 'ACCEPTED',
            email: 'pooja.hegde@adypu.edu.in', // MUST NOT BE RENDERED
          },
          {
            id: 'c-pending-2',
            name: 'Pending Collaborator',
            slug: 'pending-collab',
            role: 'Chassis Fabrication',
            avatar_url: null,
            status: 'PENDING',
            invited_email: 'pending.collab@adypu.edu.in', // MUST NOT BE RENDERED
          },
        ],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(teamProject as ProjectDetail);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'campus-rover' }),
      });

      const { container } = render(page);

      // 1. Creator portfolio link
      const creatorLink = screen.getByRole('link', { name: /View Student Portfolio/i });
      expect(creatorLink).toHaveAttribute('href', '/students/vikram-joshi');

      // 2. Accepted collaborator is present and linked
      expect(screen.getByText('Pooja Hegde')).toBeInTheDocument();
      expect(screen.getByText(/BMS Battery Architect/)).toBeInTheDocument();
      const poojaLink = screen.getByRole('link', { name: /Pooja Hegde/i });
      expect(poojaLink).toHaveAttribute('href', '/students/pooja-hegde');

      // 3. Pending contributor is NOT rendered in public DOM
      expect(screen.queryByText('Pending Collaborator')).toBeNull();

      // 4. Zero exposure of institutional emails in DOM
      expect(container.innerHTML).not.toContain('pooja.hegde@adypu.edu.in');
      expect(container.innerHTML).not.toContain('pending.collab@adypu.edu.in');
    });
  });

  // =========================================================================
  // 6. ProjectForm Screenshot Authoring & Payload Persistence
  // =========================================================================
  describe('ProjectForm Screenshot Authoring & Persistence', () => {
    it('prepopulates gallery screenshots and allows adding/removing screenshots in edit mode', async () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      const updateSpy = vi.spyOn(projectsApi, 'update').mockResolvedValue({
        ...fullProject,
      } as ProjectDetail);

      render(<ProjectForm mode="edit" initialData={fullProject} />);

      // Prepopulated screenshots should be visible
      expect(screen.getByText('https://storage.googleapis.com/nst-bucket/drone-arch-diagram.png')).toBeInTheDocument();
      expect(screen.getByText('https://storage.googleapis.com/nst-bucket/latency-benchmark-chart.png')).toBeInTheDocument();
      expect(screen.getByText('2/6 added')).toBeInTheDocument();

      // Add a 3rd screenshot
      const screenshotInput = screen.getByLabelText(/Screenshot URL input/i);
      fireEvent.change(screenshotInput, {
        target: { value: 'https://storage.googleapis.com/nst-bucket/flight-path-3d.png' },
      });
      const addBtn = screen.getByRole('button', { name: /Add Image/i });
      fireEvent.click(addBtn);

      expect(screen.getByText('https://storage.googleapis.com/nst-bucket/flight-path-3d.png')).toBeInTheDocument();
      expect(screen.getByText('3/6 added')).toBeInTheDocument();

      // Remove the 1st screenshot
      const removeFirstBtn = screen.getByLabelText('Remove screenshot 1');
      fireEvent.click(removeFirstBtn);

      expect(screen.queryByText('https://storage.googleapis.com/nst-bucket/drone-arch-diagram.png')).toBeNull();
      expect(screen.getByText('2/6 added')).toBeInTheDocument();

      // Save changes
      const saveBtn = screen.getByText('Save Changes');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'proj-full-1',
          expect.objectContaining({
            galleryImageUrls: [
              'https://storage.googleapis.com/nst-bucket/latency-benchmark-chart.png',
              'https://storage.googleapis.com/nst-bucket/flight-path-3d.png',
            ],
          })
        );
      });
    });
  });

  // =========================================================================
  // 7. Smooth Scrolling & Section Navigation in ProjectForm
  // =========================================================================
  describe('ProjectForm Smooth Scrolling & Section Navigation', () => {
    it('renders the section quick navigation bar and smoothly scrolls when jump buttons are clicked', () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      const scrollIntoViewMock = vi.fn();
      const mockSection = document.createElement('section');
      mockSection.id = 'section-tech-stack';
      mockSection.scrollIntoView = scrollIntoViewMock;
      document.body.appendChild(mockSection);

      render(<ProjectForm mode="create" />);

      // Verify sticky navigation bar exists
      const nav = screen.getByRole('navigation', { name: /Form section navigation/i });
      expect(nav).toBeInTheDocument();

      // Click on "3. Tech Stack"
      const techStackBtn = screen.getByRole('button', { name: /3\. Tech Stack/i });
      fireEvent.click(techStackBtn);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });

      document.body.removeChild(mockSection);
    });
  });
});
