import React from 'react';

export default function StudentDossierLoading() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#050505',
        color: '#F5F5F2',
        padding: '60px 24px 120px 24px',
        maxWidth: '1140px',
        margin: '0 auto',
      }}
    >
      <div style={{ height: '14px', width: '200px', backgroundColor: 'rgba(245,245,242,0.1)', marginBottom: '24px' }} />

      {/* Header Dossier Skeleton */}
      <div
        style={{
          background: '#0d0e12',
          border: '2px solid rgba(0, 87, 255, 0.4)',
          boxShadow: '10px 10px 0px rgba(0, 87, 255, 0.25)',
          padding: '40px',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '88px',
              height: '88px',
              backgroundColor: 'rgba(0, 87, 255, 0.3)',
              borderRadius: '2px',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ height: '28px', width: '260px', backgroundColor: 'rgba(245,245,242,0.15)', marginBottom: '10px' }} />
            <div style={{ height: '14px', width: '120px', backgroundColor: 'rgba(245,245,242,0.1)', marginBottom: '12px' }} />
            <div style={{ height: '18px', width: '180px', backgroundColor: 'rgba(0, 87, 255, 0.2)' }} />
          </div>
        </div>
        <div style={{ height: '48px', backgroundColor: 'rgba(245,245,242,0.06)', borderRadius: '2px' }} />
      </div>

      {/* Projects Skeleton */}
      <div
        style={{
          background: '#0d0e12',
          border: '2px solid rgba(245, 245, 242, 0.2)',
          padding: '32px',
          marginBottom: '32px',
        }}
      >
        <div style={{ height: '24px', width: '220px', backgroundColor: 'rgba(245,245,242,0.15)', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: '180px',
                backgroundColor: 'rgba(245,245,242,0.05)',
                border: '2px solid rgba(245,245,242,0.1)',
                padding: '20px',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
