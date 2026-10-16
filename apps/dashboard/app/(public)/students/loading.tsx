import React from 'react';

export default function StudentsDirectoryLoading() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#050505',
        color: '#F5F5F2',
        padding: '60px 32px 100px 32px',
        maxWidth: '1320px',
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: '40px' }}>
        <div
          style={{
            height: '14px',
            width: '180px',
            backgroundColor: 'rgba(245,245,242,0.1)',
            marginBottom: '16px',
            borderRadius: '2px',
          }}
        />
        <div
          style={{
            height: '48px',
            width: '380px',
            backgroundColor: 'rgba(245,245,242,0.15)',
            marginBottom: '20px',
            borderRadius: '4px',
          }}
        />
        <div
          style={{
            height: '18px',
            width: '520px',
            backgroundColor: 'rgba(245,245,242,0.08)',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Filter / Search placeholder */}
      <div
        style={{
          height: '56px',
          width: '100%',
          backgroundColor: '#0d0e12',
          border: '2px solid rgba(245,245,242,0.1)',
          marginBottom: '32px',
          borderRadius: '4px',
        }}
      />

      {/* Grid skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              height: '260px',
              backgroundColor: '#0d0e12',
              border: '2px solid rgba(245,245,242,0.1)',
              borderRadius: '4px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'rgba(245,245,242,0.1)',
                  borderRadius: '2px',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: '18px',
                    width: '140px',
                    backgroundColor: 'rgba(245,245,242,0.15)',
                    marginBottom: '8px',
                  }}
                />
                <div
                  style={{
                    height: '12px',
                    width: '90px',
                    backgroundColor: 'rgba(245,245,242,0.08)',
                  }}
                />
              </div>
            </div>
            <div style={{ height: '36px', backgroundColor: 'rgba(245,245,242,0.06)', borderRadius: '2px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ height: '14px', width: '80px', backgroundColor: 'rgba(245,245,242,0.1)' }} />
              <div style={{ height: '14px', width: '60px', backgroundColor: 'rgba(245,245,242,0.1)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
