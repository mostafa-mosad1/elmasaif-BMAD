import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { VerificationStatus } from '@elmasaif/shared';
import {
  IdentityUploadForm,
  validateIdentityUploadFile
} from '../identity-upload-form';
import { IdentityStatusBadge } from '../identity-status-badge';

describe('identity verification components', () => {
  it('accepts only supported MIME types and files up to 10 MiB', () => {
    expect(validateIdentityUploadFile({
      type: 'application/pdf',
      size: 10_485_760
    })).toBeNull();
    expect(validateIdentityUploadFile({
      type: 'image/webp',
      size: 1
    })).toBeNull();
    expect(validateIdentityUploadFile({
      type: 'application/pdf',
      size: 10_485_761
    })).toBe('IDENTITY_FILE_TOO_LARGE');
    expect(validateIdentityUploadFile({
      type: 'text/plain',
      size: 1
    })).toBe('IDENTITY_UNSUPPORTED_TYPE');
  });

  it('renders the upload controls and supported formats in Arabic', () => {
    const html = renderToString(
      React.createElement(IdentityUploadForm, {
        onUploaded: () => {},
        maskedIdNumber: '123****890'
      })
    );

    expect(html).toContain('هوية وطنية');
    expect(html).toContain('إقامة نظامية');
    expect(html).toContain('PDF, JPEG, PNG, WEBP (حتى 10 ميجابايت)');
    expect(html).toContain('123****890');
    expect(html).toContain('accept="application/pdf,image/jpeg,image/png,image/webp"');
  });

  it('uses the required verification status colors and Arabic labels', () => {
    const verified = renderToString(
      React.createElement(IdentityStatusBadge, { status: VerificationStatus.VERIFIED })
    );
    const pending = renderToString(
      React.createElement(IdentityStatusBadge, { status: VerificationStatus.PENDING_REVIEW })
    );
    const rejected = renderToString(
      React.createElement(IdentityStatusBadge, { status: VerificationStatus.REJECTED })
    );

    expect(verified).toContain('الهوية موثقة ومعتمدة');
    expect(verified).toContain('bg-accent/10');
    expect(pending).toContain('قيد المراجعة والتدقيق');
    expect(pending).toContain('bg-amber-500/10');
    expect(rejected).toContain('تم رفض وثيقة الهوية');
    expect(rejected).toContain('text-status-rejected');
  });
});
