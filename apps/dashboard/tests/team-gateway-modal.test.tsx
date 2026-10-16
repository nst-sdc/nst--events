/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TeamGatewayModal } from '../app/(student)/student/events/[id]/components/TeamGatewayModal';
import * as useTeamsHook from '../hooks/useTeams';
import * as useEventFormFieldsHook from '../hooks/useEventFormFields';
import * as useProfileValuesHook from '../hooks/useProfileValues';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/student/events/evt-100',
}));

// Mock hooks
vi.mock('../hooks/useTeams');
vi.mock('../hooks/useEventFormFields');
vi.mock('../hooks/useProfileValues');

describe('TeamGatewayModal: Registration Questionnaire in Team Registration Flow', () => {
  const eventId = 'evt-team-100';

  const mockQuestions = [
    {
      eventId,
      fieldDefinitionId: 'fdef-github',
      isRequired: true,
      order: 1,
      fieldDefinition: {
        id: 'fdef-github',
        key: 'github_handle',
        label: 'GitHub Username',
        fieldType: 'TEXT',
        isReusable: false,
        options: null,
      },
    },
    {
      eventId,
      fieldDefinitionId: 'fdef-portfolio',
      isRequired: false,
      order: 2,
      fieldDefinition: {
        id: 'fdef-portfolio',
        key: 'portfolio_url',
        label: 'Portfolio Link',
        fieldType: 'URL',
        isReusable: true,
        options: null,
      },
    },
    {
      eventId,
      fieldDefinitionId: 'fdef-experience',
      isRequired: true,
      order: 3,
      fieldDefinition: {
        id: 'fdef-experience',
        key: 'experience_years',
        label: 'Years Coding',
        fieldType: 'NUMBER',
        isReusable: false,
        options: null,
      },
    },
    {
      eventId,
      fieldDefinitionId: 'fdef-shirt',
      isRequired: true,
      order: 4,
      fieldDefinition: {
        id: 'fdef-shirt',
        key: 'shirt_size',
        label: 'Apparel Size',
        fieldType: 'SELECT',
        isReusable: true,
        options: ['S', 'M', 'L', 'XL'],
      },
    },
    {
      eventId,
      fieldDefinitionId: 'fdef-pref',
      isRequired: true,
      order: 5,
      fieldDefinition: {
        id: 'fdef-pref',
        key: 'dietary_pref',
        label: 'Dietary Preference',
        fieldType: 'RADIO',
        isReusable: false,
        options: ['Veg', 'Non-Veg', 'Vegan'],
      },
    },
    {
      eventId,
      fieldDefinitionId: 'fdef-skills',
      isRequired: true,
      order: 6,
      fieldDefinition: {
        id: 'fdef-skills',
        key: 'hackathon_skills',
        label: 'Skillset Focus',
        fieldType: 'MULTI_SELECT',
        isReusable: false,
        options: ['Frontend', 'Backend', 'Design'],
      },
    },
  ];

  const mockProfileValues = [
    {
      userId: 'user-leader-1',
      fieldDefinitionId: 'fdef-portfolio',
      value: 'https://mysite.io',
      fieldDefinition: mockQuestions[1].fieldDefinition as any,
    },
    {
      userId: 'user-leader-1',
      fieldDefinitionId: 'fdef-shirt',
      value: 'L',
      fieldDefinition: mockQuestions[3].fieldDefinition as any,
    },
  ];

  let mockCreateTeamMutate: any;
  let mockJoinTeamMutate: any;

  beforeEach(() => {
    mockCreateTeamMutate = vi.fn();
    mockJoinTeamMutate = vi.fn();

    vi.spyOn(useTeamsHook, 'useCreateTeam').mockReturnValue({
      mutate: mockCreateTeamMutate,
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useJoinTeam').mockReturnValue({
      mutate: mockJoinTeamMutate,
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useTeamsList').mockReturnValue({
      data: {
        pages: [
          {
            data: [
              {
                id: 'team-existing-1',
                name: 'Neon Tigers',
                leader_id: 'leader-99',
                leader_name: 'Alex Rivera',
                member_count: 2,
                status: 'FORMING',
                members: [],
              },
            ],
          },
        ],
      },
      isLoading: false,
    } as any);
  });

  const renderModal = (isOpen = true, onClose = vi.fn()) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <TeamGatewayModal eventId={eventId} isOpen={isOpen} onClose={onClose} />
      </QueryClientProvider>
    );
  };

  it('1. Renders Gateway view with squad actions', () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: mockQuestions as any,
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: mockProfileValues as any,
      isLoading: false,
    } as any);

    renderModal();

    expect(screen.getByText('TEAM REGISTRATION')).toBeInTheDocument();
    expect(screen.getByText('Create a Squad')).toBeInTheDocument();
    expect(screen.getByText('Join Existing Squad')).toBeInTheDocument();
  });

  it('2. Loads and renders all configured Registration Questionnaire questions in CREATE view', async () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: mockQuestions as any,
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: mockProfileValues as any,
      isLoading: false,
    } as any);

    renderModal();

    // Click Create a Squad
    fireEvent.click(screen.getByText('Create a Squad'));

    expect(screen.getByText('CREATE SQUAD')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter squad identifier...')).toBeInTheDocument();

    // Verify questionnaire section
    expect(screen.getByText('REQUIRED REGISTRATION DETAILS')).toBeInTheDocument();

    // Verify all 6 field types rendered
    expect(screen.getByText('GitHub Username')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Link')).toBeInTheDocument();
    expect(screen.getByText('Years Coding')).toBeInTheDocument();
    expect(screen.getByText('Apparel Size')).toBeInTheDocument();
    expect(screen.getByText('Dietary Preference')).toBeInTheDocument();
    expect(screen.getByText('Skillset Focus')).toBeInTheDocument();

    // Verify pre-filled profile values
    const portfolioInput = screen.getByDisplayValue('https://mysite.io');
    expect(portfolioInput).toBeInTheDocument();

    const selectElement = screen.getByDisplayValue('L') as HTMLSelectElement;
    expect(selectElement.value).toBe('L');
  });

  it('3. Preserves clean registration without empty sections when NO questionnaire is configured', () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderModal();

    fireEvent.click(screen.getByText('Create a Squad'));

    expect(screen.getByText('CREATE SQUAD')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter squad identifier...')).toBeInTheDocument();
    // Questionnaire section should NOT be rendered
    expect(screen.queryByText('REQUIRED REGISTRATION DETAILS')).not.toBeInTheDocument();
  });

  it('4. Blocks submission and renders inline validation errors when required fields are empty or invalid', async () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: mockQuestions as any,
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: [], // No pre-filled profile values
      isLoading: false,
    } as any);

    renderModal();

    fireEvent.click(screen.getByText('Create a Squad'));

    // Type squad name
    const nameInput = screen.getByPlaceholderText('Enter squad identifier...');
    fireEvent.change(nameInput, { target: { value: 'Code Phantoms' } });

    // Click Confirm without filling required questions
    fireEvent.click(screen.getByText('Confirm & Create Squad ↗'));

    // Should NOT call createTeam
    expect(mockCreateTeamMutate).not.toHaveBeenCalled();

    // Should display in-UI validation alert banner
    expect(screen.getByText('VALIDATION NOTICE')).toBeInTheDocument();

    // Should display field-specific error messages
    expect(screen.getByText('"GitHub Username" is required.')).toBeInTheDocument();
    expect(screen.getByText('"Years Coding" is required.')).toBeInTheDocument();
  });

  it('5. Successfully creates squad and passes responses payload when inputs are valid', async () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: mockQuestions as any,
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: mockProfileValues as any,
      isLoading: false,
    } as any);

    renderModal();

    fireEvent.click(screen.getByText('Create a Squad'));

    // Fill Squad Name
    fireEvent.change(screen.getByPlaceholderText('Enter squad identifier...'), {
      target: { value: 'Quantum Hackers' },
    });

    // Fill GitHub Username (TEXT)
    const githubInput = screen.getByPlaceholderText('Type your response...');
    fireEvent.change(githubInput, { target: { value: 'torvalds' } });

    // Fill Years Coding (NUMBER)
    const numberInput = screen.getByPlaceholderText('0');
    fireEvent.change(numberInput, { target: { value: '5' } });

    // Select Radio Option 'Veg'
    fireEvent.click(screen.getByText('Veg'));

    // Toggle Multi-select Option 'Frontend' and 'Backend'
    fireEvent.click(screen.getByText('Frontend'));
    fireEvent.click(screen.getByText('Backend'));

    // Submit form
    fireEvent.click(screen.getByText('Confirm & Create Squad ↗'));

    expect(mockCreateTeamMutate).toHaveBeenCalledTimes(1);
    const submittedPayload = mockCreateTeamMutate.mock.calls[0][0];

    expect(submittedPayload.name).toBe('Quantum Hackers');
    expect(submittedPayload.responses).toBeDefined();

    const responseMap = Object.fromEntries(
      submittedPayload.responses.map((r: any) => [r.fieldDefinitionId, r.value])
    );

    expect(responseMap['fdef-github']).toBe('torvalds');
    expect(responseMap['fdef-portfolio']).toBe('https://mysite.io'); // prefilled
    expect(responseMap['fdef-experience']).toBe('5');
    expect(responseMap['fdef-shirt']).toBe('L'); // prefilled
    expect(responseMap['fdef-pref']).toBe('Veg');
    expect(JSON.parse(responseMap['fdef-skills'])).toEqual(['Frontend', 'Backend']);
  });

  it('6. Renders questionnaire in CONFIRM_JOIN view and validates before calling joinTeam', async () => {
    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: [mockQuestions[0]], // Just GitHub handle required
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(useProfileValuesHook, 'useProfileValues').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderModal();

    // Click Join Existing Squad
    fireEvent.click(screen.getByText('Join Existing Squad'));

    // Click on the existing team
    fireEvent.click(screen.getByText('Neon Tigers'));

    // Now in CONFIRM_JOIN view
    expect(screen.getByText('ENLIST IN SQUAD')).toBeInTheDocument();
    expect(screen.getByText('YOUR REGISTRATION DETAILS')).toBeInTheDocument();
    expect(screen.getByText('GitHub Username')).toBeInTheDocument();

    // Clicking enlist without answering required question blocks submission
    fireEvent.click(screen.getByText('Confirm Squad Enlistment ↗'));

    expect(mockJoinTeamMutate).not.toHaveBeenCalled();
    expect(screen.getByText('VALIDATION NOTICE')).toBeInTheDocument();

    // Answer question
    fireEvent.change(screen.getByPlaceholderText('Type your response...'), {
      target: { value: 'member_dev' },
    });

    // Submit enlistment
    fireEvent.click(screen.getByText('Confirm Squad Enlistment ↗'));

    expect(mockJoinTeamMutate).toHaveBeenCalledTimes(1);
    const joinPayload = mockJoinTeamMutate.mock.calls[0][0];

    expect(joinPayload.teamId).toBe('team-existing-1');
    expect(joinPayload.responses).toEqual([
      { fieldDefinitionId: 'fdef-github', value: 'member_dev' },
    ]);
  });

  it('7. When isParticipantCapacityFull is true, renders notice and disables actions', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeamGatewayModal
          eventId={eventId}
          isOpen={true}
          onClose={vi.fn()}
          isParticipantCapacityFull={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('PARTICIPANT CAPACITY REACHED')).toBeInTheDocument();
    expect(screen.getByText(/squad creation and joining are currently disabled/i)).toBeInTheDocument();

    const createBtn = screen.getByText('Create a Squad').closest('button');
    const joinBtn = screen.getByText('Join Existing Squad').closest('button');

    expect(createBtn).toBeDisabled();
    expect(joinBtn).toBeDisabled();
  });

  it('8. When isTeamCapacityFull is true but participant capacity remains, notes waitlist and permits joining', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeamGatewayModal
          eventId={eventId}
          isOpen={true}
          onClose={vi.fn()}
          isTeamCapacityFull={true}
          isParticipantCapacityFull={false}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('TEAM CAPACITY REACHED')).toBeInTheDocument();
    expect(screen.getByText(/Waitlist only \(Team capacity reached\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Open roster spots available to join/i)).toBeInTheDocument();

    const createBtn = screen.getByText('Create a Squad').closest('button');
    const joinBtn = screen.getByText('Join Existing Squad').closest('button');

    expect(createBtn).not.toBeDisabled();
    expect(joinBtn).not.toBeDisabled();
  });
});
