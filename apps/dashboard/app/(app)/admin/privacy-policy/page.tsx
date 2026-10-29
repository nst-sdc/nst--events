'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Result,
  Spin,
  Button,
  Modal,
  Tag,
  Alert,
  Typography,
  Space,
} from 'antd';
import {
  SaveOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { isPlatformAdmin } from '../../../../lib/auth-helpers';
import { apiClient, ApiError } from '../../../../lib/api';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { MarkdownEditor } from '../../../../components/projects/MarkdownEditor';

const { Paragraph } = Typography;

const MAX_POLICY_BYTES = 100 * 1024; // 100 KiB (102,400 bytes)

interface PolicyData {
  slug: string;
  title: string;
  published_content: string;
  draft_content: string;
  concurrency_revision: number;
  published_version: number;
  published_at: string | null;
  updated_at: string;
  published_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface ConflictData {
  current_concurrency_revision: number;
  current_published_version: number;
  server_draft_content: string;
  last_modified_by: {
    name: string;
    email: string;
  } | null;
}

export default function AdminPrivacyPolicyPage() {
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  // Editor working state
  const [content, setContent] = useState<string>('');
  const [serverDraft, setServerDraft] = useState<string>('');
  const [baseRevision, setBaseRevision] = useState<number>(1);

  // Actions state
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  const fetchPolicy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<PolicyData>('/v1/admin/policies/privacy-policy');
      setPolicyData(data);
      setContent(data.draft_content);
      setServerDraft(data.draft_content);
      setBaseRevision(data.concurrency_revision);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to fetch policy data from server');
      } else {
        setError('Network error: Unable to connect to server');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!isUserLoading && currentUser && isPlatformAdmin(currentUser)) {
      apiClient<PolicyData>('/v1/admin/policies/privacy-policy')
        .then((data) => {
          if (active) {
            setPolicyData(data);
            setContent(data.draft_content);
            setServerDraft(data.draft_content);
            setBaseRevision(data.concurrency_revision);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setError(err instanceof ApiError ? err.message : 'Network error: Unable to connect to server');
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isUserLoading, currentUser]);

  // Byte size calculation (authoritative UTF-8 byte count)
  const contentBytes = useMemo(() => {
    if (!content) return 0;
    return new TextEncoder().encode(content).length;
  }, [content]);

  const isOverSizeLimit = contentBytes > MAX_POLICY_BYTES;
  const isDirty = content !== serverDraft;

  // Save Draft Handler
  const handleSaveDraft = async (targetRevision?: number) => {
    if (isOverSizeLimit) return;
    try {
      setIsSaving(true);
      setSuccessBanner(null);
      setError(null);

      const revisionToSubmit = targetRevision ?? baseRevision;
      const res = await apiClient<{
        status: string;
        concurrency_revision: number;
        published_version: number;
        updated_at: string;
      }>('/v1/admin/policies/privacy-policy', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'SAVE_DRAFT',
          content,
          base_concurrency_revision: revisionToSubmit,
        }),
      });

      setBaseRevision(res.concurrency_revision);
      setServerDraft(content);
      setSuccessBanner(
        `Draft successfully saved at revision ${res.concurrency_revision} (${new Date(
          res.updated_at
        ).toLocaleTimeString()}).`
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictData({
          current_concurrency_revision: err.data?.current_concurrency_revision || baseRevision + 1,
          current_published_version: err.data?.current_published_version || policyData?.published_version || 1,
          server_draft_content: err.data?.server_draft_content || '',
          last_modified_by: err.data?.last_modified_by || null,
        });
      } else if (err instanceof ApiError) {
        setError(err.message || 'Failed to save draft');
      } else {
        setError('Network connection error while saving draft');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Publish Handler
  const handlePublish = async (targetRevision?: number) => {
    if (isOverSizeLimit) return;
    try {
      setIsPublishing(true);
      setSuccessBanner(null);
      setError(null);

      const revisionToSubmit = targetRevision ?? baseRevision;
      const res = await apiClient<{
        status: string;
        concurrency_revision: number;
        published_version: number;
        published_at: string;
      }>('/v1/admin/policies/privacy-policy', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'PUBLISH',
          content,
          base_concurrency_revision: revisionToSubmit,
        }),
      });

      setBaseRevision(res.concurrency_revision);
      setServerDraft(content);
      setShowPublishModal(false);

      if (policyData) {
        setPolicyData({
          ...policyData,
          published_content: content,
          draft_content: content,
          concurrency_revision: res.concurrency_revision,
          published_version: res.published_version,
          published_at: res.published_at,
          published_by: currentUser
            ? {
                id: currentUser.id,
                full_name: currentUser.full_name || 'Platform Administrator',
                email: currentUser.email || 'admin@nstsdc.org',
              }
            : null,
        });
      }

      setSuccessBanner(
        `Version ${res.published_version} published live! Changes are now effective for all students and public visitors.`
      );
    } catch (err: unknown) {
      setShowPublishModal(false);
      if (err instanceof ApiError && err.status === 409) {
        setConflictData({
          current_concurrency_revision: err.data?.current_concurrency_revision || baseRevision + 1,
          current_published_version: err.data?.current_published_version || policyData?.published_version || 1,
          server_draft_content: err.data?.server_draft_content || '',
          last_modified_by: err.data?.last_modified_by || null,
        });
      } else if (err instanceof ApiError) {
        setError(err.message || 'Failed to publish policy');
      } else {
        setError('Network connection error while publishing policy');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Conflict Resolution Choices
  const handleKeepLocal = () => {
    if (conflictData) {
      setBaseRevision(conflictData.current_concurrency_revision);
      setConflictData(null);
      setSuccessBanner(
        'Server revision acknowledged. Your local edits are intact. You can now save or publish.'
      );
    }
  };

  const handleOverwriteServer = () => {
    if (conflictData) {
      const nextRev = conflictData.current_concurrency_revision;
      setConflictData(null);
      handleSaveDraft(nextRev);
    }
  };

  const handleDiscardLocal = () => {
    if (conflictData) {
      setContent(conflictData.server_draft_content);
      setServerDraft(conflictData.server_draft_content);
      setBaseRevision(conflictData.current_concurrency_revision);
      setConflictData(null);
      setSuccessBanner('Local edits discarded. Editor restored to latest server draft.');
    }
  };

  // Permission Barrier
  if (!isUserLoading && currentUser && !isPlatformAdmin(currentUser)) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <Result
          status="403"
          title="Platform Admin Authorization Required"
          subTitle="Managing university-wide privacy and legal policies is strictly restricted to Platform Administrators."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Spin size="large" />
        <p className="mt-4 text-zinc-500 font-mono text-sm">Loading Institutional Privacy Policy...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-5">
      {/* Level A: Compact Page Heading & Action Controls */}
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Admin Ops', href: '/admin' },
          { title: 'Privacy Policy' },
        ]}
        title="Privacy Policy"
        description="Manage the privacy terms shown to students and visitors."
        context={
          <Space size="small" wrap>
            <span className="hidden sm:inline-block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-400 mr-2">
              Privacy Policy Management
            </span>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchPolicy}
              disabled={isSaving || isPublishing}
              size="middle"
            >
              Reload Server Draft
            </Button>

            <Button
              icon={<SaveOutlined />}
              onClick={() => handleSaveDraft()}
              loading={isSaving}
              disabled={!isDirty || isOverSizeLimit || isPublishing}
              size="middle"
            >
              Save Draft
            </Button>

            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => setShowPublishModal(true)}
              loading={isPublishing}
              disabled={isOverSizeLimit || isSaving}
              size="middle"
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 font-semibold shadow-xs"
            >
              Publish Policy
            </Button>
          </Space>
        }
      />

      {/* Level B: Policy Status and Metadata Area */}
      {policyData && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 items-center">
            {/* Published Version */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Published Version
              </div>
              <div className="flex items-center gap-2">
                <Tag color="green" className="font-mono font-bold text-xs m-0">
                  v{policyData.published_version}
                </Tag>
                <span className="text-xs text-zinc-500 font-medium">Public Live</span>
              </div>
            </div>

            {/* Draft Revision */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Draft Revision
              </div>
              <div className="flex items-center gap-2">
                <Tag color="blue" className="font-mono font-bold text-xs m-0">
                  #{baseRevision}
                </Tag>
                <span className="text-xs text-zinc-500 font-medium">Working Copy</span>
              </div>
            </div>

            {/* Last Effective Date */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Last Effective
              </div>
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                {policyData.published_at
                  ? new Date(policyData.published_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Baseline'}
              </div>
            </div>

            {/* Document Size & Byte Budget */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Document Size
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span
                  className={
                    isOverSizeLimit
                      ? 'text-rose-600 font-bold'
                      : 'text-zinc-800 dark:text-zinc-200 font-semibold'
                  }
                >
                  {(contentBytes / 1024).toFixed(1)} KiB
                </span>
                <span className="text-zinc-400">/ 100 KiB</span>
              </div>
            </div>

            {/* Draft Status Badges */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-wrap items-center lg:justify-end gap-1.5">
              {isDirty ? (
                <Tag color="warning" icon={<WarningOutlined />} className="text-xs py-0.5 px-2.5 font-medium m-0">
                  Unsaved Changes
                </Tag>
              ) : (
                <Tag color="default" icon={<CheckCircleOutlined />} className="text-xs py-0.5 px-2.5 font-medium text-emerald-700 bg-emerald-50 border-emerald-200 m-0">
                  Draft in Sync
                </Tag>
              )}
              {content !== policyData.published_content && (
                <Tag color="processing" icon={<InfoCircleOutlined />} className="text-xs py-0.5 px-2 font-normal m-0">
                  Draft differs from published
                </Tag>
              )}
            </div>
          </div>

          {policyData.published_by && (
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span>
                Last published by <strong className="text-zinc-800 dark:text-zinc-200">{policyData.published_by.full_name}</strong> ({policyData.published_by.email})
              </span>
              <span className="text-zinc-500 font-mono">
                Updated {new Date(policyData.updated_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <Alert
          type="error"
          showIcon
          title="Policy Operation Error"
          description={error}
          closable
          onClose={() => setError(null)}
        />
      )}

      {successBanner && (
        <Alert
          type="success"
          showIcon
          title="Success"
          description={successBanner}
          closable
          onClose={() => setSuccessBanner(null)}
        />
      )}

      {isOverSizeLimit && (
        <Alert
          type="error"
          showIcon
          title="Content Size Limit Exceeded"
          description={`Your policy draft is ${contentBytes.toLocaleString()} bytes, which exceeds the authoritative limit of ${MAX_POLICY_BYTES.toLocaleString()} bytes (100 KiB). Please shorten the text before saving or publishing.`}
        />
      )}

      {/* Level C: Document Workspace */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <MarkdownEditor
          id="privacy-policy-editor"
          label="Privacy Policy Document (Markdown)"
          value={content}
          onChange={(val) => setContent(val)}
          placeholder="Enter Privacy Policy terms in Markdown format..."
          minHeight="600px"
          variant="document"
        />
      </div>

      {/* Publication Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-600">
            <CloudUploadOutlined className="text-xl" />
            <span>Confirm Publication: Version {(policyData?.published_version || 1) + 1}</span>
          </div>
        }
        open={showPublishModal}
        onCancel={() => setShowPublishModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowPublishModal(false)}>
            Cancel
          </Button>,
          <Button
            key="publish"
            type="primary"
            loading={isPublishing}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handlePublish()}
          >
            Confirm & Publish Live
          </Button>,
        ]}
      >
        <div className="space-y-4 py-2">
          <Paragraph>
            You are about to publish the current editor content as <strong>Version {(policyData?.published_version || 1) + 1}</strong> of the NST Events Privacy Policy.
          </Paragraph>

          <Alert
            type="warning"
            showIcon
            title="Immediate Public Effect"
            description="Once published, this policy immediately becomes the authoritative terms served at https://events.nstsdc.org/privacy-policy and across all mobile app deep links. An immutable record with your administrator attribution will be appended to the institutional audit log."
          />

          <div className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded border border-zinc-200 space-y-1">
            <div><strong>Publisher:</strong> {currentUser?.full_name} ({currentUser?.email})</div>
            <div><strong>Size:</strong> {(contentBytes / 1024).toFixed(1)} KiB ({contentBytes.toLocaleString()} UTF-8 bytes)</div>
            <div><strong>New Legal Version:</strong> v{(policyData?.published_version || 1) + 1}</div>
          </div>
        </div>
      </Modal>

      {/* 409 Conflict Reconciliation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-amber-600">
            <ExclamationCircleOutlined className="text-xl" />
            <span>Concurrent Modification Detected (HTTP 409)</span>
          </div>
        }
        open={conflictData !== null}
        destroyOnHidden
        onCancel={() => setConflictData(null)}
        width={900}
        footer={[
          <Button key="discard" danger onClick={handleDiscardLocal}>
            Discard Local & Accept Server
          </Button>,
          <Button key="overwrite" onClick={handleOverwriteServer}>
            Force Overwrite Server
          </Button>,
          <Button key="keep" type="primary" onClick={handleKeepLocal}>
            Keep Local Edits & Review
          </Button>,
        ]}
      >
        {conflictData && (
          <div className="space-y-4 py-2">
            <Alert
              type="error"
              showIcon
              title="Policy Modified Concurrently"
              description={`Another administrator (${
                conflictData.last_modified_by?.name || 'Authorized Admin'
              } <${conflictData.last_modified_by?.email || 'admin@nstsdc.org'}>) updated the policy on the server while you were editing. Your local text has been preserved.`}
            />

            <Paragraph className="text-sm text-zinc-600">
              Please choose how you wish to resolve this collision:
            </Paragraph>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 space-y-2">
                <div className="font-semibold text-xs text-zinc-700 uppercase tracking-wider flex justify-between">
                  <span>Your Local Unsaved Edits</span>
                  <span>{(contentBytes / 1024).toFixed(1)} KiB</span>
                </div>
                <textarea
                  readOnly
                  value={content}
                  className="w-full h-64 p-2 text-xs font-mono bg-white border border-zinc-300 rounded resize-none"
                />
              </div>

              <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 space-y-2">
                <div className="font-semibold text-xs text-zinc-700 uppercase tracking-wider flex justify-between">
                  <span>Server Draft (Current Revision #{conflictData.current_concurrency_revision})</span>
                  <span>{(new TextEncoder().encode(conflictData.server_draft_content).length / 1024).toFixed(1)} KiB</span>
                </div>
                <textarea
                  readOnly
                  value={conflictData.server_draft_content}
                  className="w-full h-64 p-2 text-xs font-mono bg-white border border-zinc-300 rounded resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
