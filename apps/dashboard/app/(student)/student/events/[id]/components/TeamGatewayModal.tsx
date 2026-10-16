'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useCreateTeam, useTeamsList, useJoinTeam, Team } from '../../../../../../hooks/useTeams';
import { useEventFormFields } from '../../../../../../hooks/useEventFormFields';
import { useProfileValues, ProfileValue } from '../../../../../../hooks/useProfileValues';
import { validateFormResponses, toResponsePayload, isFieldValueEmpty } from '../../../../../../lib/form-utils';
import { DynamicFieldInput } from '../../../../../../components/forms/DynamicFieldInput';
import { Modal } from '../../../../../../components/ui/Modal';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, ArrowRight, AlertCircle } from 'lucide-react';

interface TeamGatewayModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  isTeamCapacityFull?: boolean;
  isParticipantCapacityFull?: boolean;
}

export function TeamGatewayModal({ 
  eventId, 
  isOpen, 
  onClose,
  isTeamCapacityFull = false,
  isParticipantCapacityFull = false
}: TeamGatewayModalProps) {
  const router = useRouter();
  const [view, setView] = useState<'GATEWAY' | 'CREATE' | 'JOIN' | 'CONFIRM_JOIN'>('GATEWAY');
  
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Questionnaire state
  const { data: eventFormFields, isLoading: isLoadingFields, isError: isErrorFields } = useEventFormFields(eventId);
  const { data: profileValues } = useProfileValues();

  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [preFilledFields, setPreFilledFields] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const { mutate: createTeam, isPending: isCreating } = useCreateTeam(eventId);
  const { mutate: joinTeam, isPending: isJoining } = useJoinTeam(eventId);
  
  const { data: teamsData, isLoading: isLoadingTeams } = useTeamsList(eventId);

  // Pre-fill profile values when fields or profile values are loaded
  useEffect(() => {
    if (isOpen && eventFormFields && profileValues) {
      const initial: Record<string, string> = {};
      const preFilled: Record<string, string> = {};
      eventFormFields.forEach((f) => {
        const profileMatch = profileValues.find((p: ProfileValue) => p.fieldDefinitionId === f.fieldDefinitionId);
        if (profileMatch && profileMatch.value) {
          initial[f.fieldDefinitionId] = profileMatch.value;
          preFilled[f.fieldDefinitionId] = profileMatch.value;
        }
      });
      const timer = setTimeout(() => {
        setFormResponses((prev) => ({ ...initial, ...prev }));
        setPreFilledFields(preFilled);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, eventFormFields, profileValues]);

  // Debounced local validation for team name uniqueness
  useEffect(() => {
    const handler = setTimeout(() => {
      const normalizedInput = teamName.trim().toLowerCase();
      if (!normalizedInput || !teamsData?.pages) {
        setTeamNameError(null);
        return;
      }
      
      const allLoadedTeams = teamsData.pages.flatMap((page: any) => page.data);
      if (allLoadedTeams.some((t: Team) => t.name.trim().toLowerCase() === normalizedInput)) {
        setTeamNameError('This team name is already taken.');
      } else {
        setTeamNameError(null);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [teamName, teamsData]);

  const handleFieldResponseChange = (fieldDefId: string, value: string) => {
    setFormResponses((prev) => ({ ...prev, [fieldDefId]: value }));
    if (fieldErrors[fieldDefId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldDefId];
        return next;
      });
    }
    if (registrationError) {
      setRegistrationError(null);
    }
  };

  const handleCreate = () => {
    if (isParticipantCapacityFull) {
      setRegistrationError('Event participant capacity is full.');
      return;
    }
    if (!teamName.trim()) {
      setTeamNameError('Squad name is required.');
      return;
    }
    const normalizedInput = teamName.trim().toLowerCase();
    
    // Local uniqueness check against loaded teams
    if (teamsData?.pages) {
      const allLoadedTeams = teamsData.pages.flatMap((page: any) => page.data);
      if (allLoadedTeams.some((t: Team) => t.name.trim().toLowerCase() === normalizedInput)) {
        setTeamNameError('This team name is already taken.');
        return;
      }
    }

    // Validate registration questionnaire responses if configured
    if (eventFormFields && eventFormFields.length > 0) {
      const validation = validateFormResponses(eventFormFields, formResponses);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        const firstMissing = eventFormFields.find(
          (f) => f.isRequired && isFieldValueEmpty(formResponses[f.fieldDefinitionId])
        );
        if (firstMissing) {
          setRegistrationError(`Please fill in required field: ${firstMissing.fieldDefinition.label}`);
        } else {
          setRegistrationError(validation.firstError || 'Please fill in all required fields.');
        }
        return;
      }
    }

    setFieldErrors({});
    setRegistrationError(null);

    const responses = eventFormFields && eventFormFields.length > 0 ? toResponsePayload(formResponses) : undefined;

    createTeam({ name: teamName.trim(), responses }, {
      onSuccess: () => {
        onClose();
        router.push(`/student/events/${eventId}/team`);
      },
      onError: (err: any) => {
        if (err.status === 409 || err.message?.includes('TEAM_NAME_TAKEN') || err.message?.includes('taken')) {
          setTeamNameError('This team name is already taken for this event.');
        } else {
          setRegistrationError(err.message || 'Failed to create team. Please try again.');
        }
      }
    });
  };

  const handleJoin = () => {
    if (isParticipantCapacityFull) {
      setRegistrationError('Event participant capacity is full.');
      return;
    }
    if (!selectedTeam) return;

    // Validate registration questionnaire responses if configured
    if (eventFormFields && eventFormFields.length > 0) {
      const validation = validateFormResponses(eventFormFields, formResponses);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        const firstMissing = eventFormFields.find(
          (f) => f.isRequired && isFieldValueEmpty(formResponses[f.fieldDefinitionId])
        );
        if (firstMissing) {
          setRegistrationError(`Please fill in required field: ${firstMissing.fieldDefinition.label}`);
        } else {
          setRegistrationError(validation.firstError || 'Please fill in all required fields.');
        }
        return;
      }
    }

    setFieldErrors({});
    setRegistrationError(null);

    const responses = eventFormFields && eventFormFields.length > 0 ? toResponsePayload(formResponses) : undefined;

    joinTeam({ teamId: selectedTeam.id, responses }, {
      onSuccess: () => {
        onClose();
        router.push(`/student/events/${eventId}/team`);
      },
      onError: (err: any) => {
        setRegistrationError(err.message || 'Failed to join team. Please try again.');
      }
    });
  };

  const reset = () => {
    setView('GATEWAY');
    setTeamName('');
    setTeamNameError(null);
    setSelectedTeam(null);
    setFieldErrors({});
    setRegistrationError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  const hasQuestions = eventFormFields && eventFormFields.length > 0;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={view === 'CREATE' ? 'CREATE SQUAD' : view === 'JOIN' ? 'JOIN SQUAD' : view === 'CONFIRM_JOIN' ? 'ENLIST IN SQUAD' : 'TEAM REGISTRATION'}
      maxWidth={hasQuestions && (view === 'CREATE' || view === 'CONFIRM_JOIN') ? 'max-w-xl' : 'max-w-lg'}
    >
      <div className="p-6 pt-2 font-sans">
        
        {view === 'GATEWAY' && (
          <div className="space-y-4">
            {isParticipantCapacityFull && (
              <div className="p-4 bg-[#FF3B30]/10 border-2 border-[#FF3B30] shadow-[3px_3px_0px_#FF3B30] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#FF3B30] uppercase tracking-wider mb-1">
                    PARTICIPANT CAPACITY REACHED
                  </div>
                  <div className="font-mono text-xs text-white leading-relaxed">
                    This event has reached its maximum participant limit. Squad creation and joining are currently disabled.
                  </div>
                </div>
              </div>
            )}
            {isTeamCapacityFull && !isParticipantCapacityFull && (
              <div className="p-4 bg-[#0057FF]/10 border-2 border-[#0057FF] shadow-[3px_3px_0px_#0057FF] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#0057FF] shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#0057FF] uppercase tracking-wider mb-1">
                    TEAM CAPACITY REACHED
                  </div>
                  <div className="font-mono text-xs text-white leading-relaxed">
                    Maximum registered teams reached. New squads will enter the waitlist queue, but you can still join existing squads with open spots.
                  </div>
                </div>
              </div>
            )}
            <p className="font-mono text-xs text-[#a0a4b8] mb-6 leading-relaxed">
              This event operates under squad registration. Form a new team as leader or enlist in an existing roster.
            </p>
            
            <button
              disabled={isParticipantCapacityFull}
              onClick={() => {
                if (isParticipantCapacityFull) {
                  setRegistrationError('Event participant capacity is full.');
                  return;
                }
                setRegistrationError(null);
                setFieldErrors({});
                setView('CREATE');
              }}
              className={`w-full flex items-center justify-between p-5 bg-[#0e1017] border-2 ${
                isParticipantCapacityFull ? 'border-white/10 opacity-50 cursor-not-allowed' : 'border-white/15 hover:border-[#0057FF] cursor-pointer'
              } transition-all shadow-[4px_4px_0px_#000000] group text-left`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0057FF] text-white flex items-center justify-center border-2 border-black">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm uppercase text-[#F5F5F2] group-hover:text-[#0057FF] transition-colors" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Create a Squad
                  </div>
                  <div className="font-mono text-[11px] text-[#a0a4b8] uppercase tracking-wider mt-0.5">
                    {isTeamCapacityFull ? 'Waitlist only (Team capacity reached)' : 'You will be appointed team leader'}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#a0a4b8] group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <button
              disabled={isParticipantCapacityFull}
              onClick={() => {
                if (isParticipantCapacityFull) {
                  setRegistrationError('Event participant capacity is full.');
                  return;
                }
                setRegistrationError(null);
                setFieldErrors({});
                setView('JOIN');
              }}
              className={`w-full flex items-center justify-between p-5 bg-[#0e1017] border-2 ${
                isParticipantCapacityFull ? 'border-white/10 opacity-50 cursor-not-allowed' : 'border-white/15 hover:border-[#0057FF] cursor-pointer'
              } transition-all shadow-[4px_4px_0px_#000000] group text-left`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 text-white flex items-center justify-center border-2 border-white/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm uppercase text-[#F5F5F2] group-hover:text-[#0057FF] transition-colors" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Join Existing Squad
                  </div>
                  <div className="font-mono text-[11px] text-[#a0a4b8] uppercase tracking-wider mt-0.5">
                    {isTeamCapacityFull ? 'Open roster spots available to join' : 'Browse and join an open roster'}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#a0a4b8] group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        )}

        {view === 'CREATE' && (
          <div>
            {/* IN-UI VALIDATION ALERT */}
            {registrationError && (
              <div
                className="mb-6 p-4 bg-[#FF3B30]/10 border-2 border-[#FF3B30] shadow-[3px_3px_0px_#FF3B30] flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#FF3B30] uppercase tracking-wider mb-1">
                    VALIDATION NOTICE
                  </div>
                  <div className="font-mono text-xs text-white leading-relaxed">
                    {registrationError}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs font-mono font-bold tracking-widest uppercase text-[#F5F5F2] mb-2">
                Squad Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  setTeamNameError(null);
                }}
                placeholder="Enter squad identifier..."
                className={`w-full p-3.5 border-2 text-sm font-mono bg-[#0e1017] text-[#F5F5F2] focus:outline-none transition-colors ${
                  teamNameError ? 'border-[#FF3B30] bg-[#FF3B30]/10' : 'border-white/20 focus:border-[#0057FF]'
                }`}
                autoFocus
              />
              {teamNameError && (
                <div className="font-mono text-xs text-[#FF3B30] font-bold mt-2 uppercase tracking-wide">
                  {teamNameError}
                </div>
              )}
            </div>

            {/* QUESTIONNAIRE SECTION (if configured) */}
            {isLoadingFields && (
              <div className="mb-6 p-4 border border-dashed border-white/20 flex items-center justify-center gap-3 text-xs font-mono text-[#a0a4b8]">
                <div className="w-4 h-4 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin" />
                <span>Loading registration questionnaire...</span>
              </div>
            )}

            {isErrorFields && (
              <div className="mb-6 p-3 bg-[#FF3B30]/10 border border-[#FF3B30] font-mono text-xs text-[#FF3B30]">
                Failed to load registration questionnaire. You can still proceed with squad creation.
              </div>
            )}

            {hasQuestions && (
              <div className="mb-6 space-y-4">
                <div className="border-b-2 border-white/20 pb-2">
                  <div className="font-mono text-xs font-bold text-[#00E5FF] tracking-wider uppercase">
                    REQUIRED REGISTRATION DETAILS
                  </div>
                  <div className="font-mono text-[11px] text-[#a0a4b8] mt-0.5">
                    Please provide these details for your team leader registration pass.
                  </div>
                </div>
                <div className="space-y-4">
                  {eventFormFields.map((field) => (
                    <DynamicFieldInput
                      key={field.fieldDefinitionId}
                      field={field}
                      value={formResponses[field.fieldDefinitionId] || ''}
                      onChange={(val) => handleFieldResponseChange(field.fieldDefinitionId, val)}
                      disabled={isCreating}
                      error={fieldErrors[field.fieldDefinitionId]}
                      isPrefilled={!!preFilledFields[field.fieldDefinitionId]}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => {
                  setRegistrationError(null);
                  setFieldErrors({});
                  setView('GATEWAY');
                }}
                disabled={isCreating}
                className="w-full sm:w-auto px-5 py-3 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
              >
                Back
              </button>
              <button 
                onClick={handleCreate}
                disabled={!teamName.trim() || isCreating}
                className="w-full sm:flex-1 px-6 py-3 bg-[#0057FF] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_#000] uppercase disabled:opacity-50 transition-all"
              >
                {isCreating ? 'Creating Squad...' : 'Confirm & Create Squad ↗'}
              </button>
            </div>
          </div>
        )}

        {view === 'JOIN' && (
          <div className="flex flex-col h-[50vh] max-h-[380px]">
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 mb-6">
              {isLoadingTeams ? (
                <div className="flex justify-center items-center h-full">
                  <div className="w-6 h-6 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : teamsData?.pages[0]?.data.length === 0 ? (
                <div className="text-center font-mono text-xs text-[#a0a4b8] py-10 uppercase tracking-widest border border-dashed border-white/15 p-6">
                  No open squads found. Be the first to create one!
                </div>
              ) : (
                teamsData?.pages.flatMap((page: any) => page.data).map((team: Team) => {
                  const isCancelled = team.status === 'CANCELLED';

                  return (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team);
                        setRegistrationError(null);
                        setFieldErrors({});
                        setView('CONFIRM_JOIN');
                      }}
                      disabled={isCancelled}
                      className="w-full flex items-center justify-between p-4 bg-[#0e1017] border-2 border-white/15 hover:border-[#0057FF] transition-all disabled:opacity-40 text-left shadow-[2px_2px_0px_#000] group"
                    >
                      <div>
                        <div className="font-bold text-sm text-[#F5F5F2] group-hover:text-[#0057FF] transition-colors" style={{ fontFamily: "'Syne', sans-serif" }}>
                          {team.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#a0a4b8] uppercase tracking-wider mt-1">
                          Leader: {team.leader_name} • {team.member_count} members
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#a0a4b8] group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })
              )}
            </div>
            
            <button 
              onClick={() => {
                setRegistrationError(null);
                setFieldErrors({});
                setView('GATEWAY');
              }}
              className="w-full px-5 py-3 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
            >
              Back
            </button>
          </div>
        )}

        {view === 'CONFIRM_JOIN' && selectedTeam && (
          <div>
            {/* IN-UI VALIDATION ALERT */}
            {registrationError && (
              <div
                className="mb-6 p-4 bg-[#FF3B30]/10 border-2 border-[#FF3B30] shadow-[3px_3px_0px_#FF3B30] flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#FF3B30] uppercase tracking-wider mb-1">
                    VALIDATION NOTICE
                  </div>
                  <div className="font-mono text-xs text-white leading-relaxed">
                    {registrationError}
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-[#0e1017] border-2 border-white/15 mb-6 shadow-[3px_3px_0px_#000]">
              <div className="font-mono text-[10px] text-[#a0a4b8] uppercase tracking-widest mb-1">SELECTED SQUAD</div>
              <div className="text-xl font-black text-[#F5F5F2] uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>
                {selectedTeam.name}
              </div>
              <div className="font-mono text-xs text-[#0057FF] uppercase tracking-wider mt-1">
                Leader: {selectedTeam.leader_name}
              </div>
            </div>

            {/* QUESTIONNAIRE SECTION (if configured) */}
            {isLoadingFields && (
              <div className="mb-6 p-4 border border-dashed border-white/20 flex items-center justify-center gap-3 text-xs font-mono text-[#a0a4b8]">
                <div className="w-4 h-4 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin" />
                <span>Loading registration questionnaire...</span>
              </div>
            )}

            {isErrorFields && (
              <div className="mb-6 p-3 bg-[#FF3B30]/10 border border-[#FF3B30] font-mono text-xs text-[#FF3B30]">
                Failed to load registration questionnaire. You can still proceed with squad enlistment.
              </div>
            )}

            {hasQuestions && (
              <div className="mb-6 space-y-4">
                <div className="border-b-2 border-white/20 pb-2">
                  <div className="font-mono text-xs font-bold text-[#00E5FF] tracking-wider uppercase">
                    YOUR REGISTRATION DETAILS
                  </div>
                  <div className="font-mono text-[11px] text-[#a0a4b8] mt-0.5">
                    Please complete your questionnaire responses to join this squad.
                  </div>
                </div>
                <div className="space-y-4">
                  {eventFormFields.map((field) => (
                    <DynamicFieldInput
                      key={field.fieldDefinitionId}
                      field={field}
                      value={formResponses[field.fieldDefinitionId] || ''}
                      onChange={(val) => handleFieldResponseChange(field.fieldDefinitionId, val)}
                      disabled={isJoining}
                      error={fieldErrors[field.fieldDefinitionId]}
                      isPrefilled={!!preFilledFields[field.fieldDefinitionId]}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => {
                  setRegistrationError(null);
                  setFieldErrors({});
                  setView('JOIN');
                }}
                disabled={isJoining}
                className="w-full sm:w-auto px-5 py-3 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
              >
                Back
              </button>
              <button 
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full sm:flex-1 px-6 py-3 bg-[#0057FF] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_#000] uppercase disabled:opacity-50 transition-all"
              >
                {isJoining ? 'Joining Squad...' : 'Confirm Squad Enlistment ↗'}
              </button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
