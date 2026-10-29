import { z } from 'zod';
import { IdentityDocumentType, VerificationStatus } from '../enums';
import { saudiNationalIdSchema } from './auth.schema';

export const uploadIdentityDocumentSchema = z.object({
  documentType: z.nativeEnum(IdentityDocumentType),
  idNumber: saudiNationalIdSchema.optional()
}).superRefine((document, context) => {
  if (
    document.idNumber &&
    ((document.documentType === IdentityDocumentType.NATIONAL_ID && !document.idNumber.startsWith('1')) ||
      (document.documentType === IdentityDocumentType.IQAMA && !document.idNumber.startsWith('2')))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['idNumber'],
      message: 'رقم الهوية لا يتوافق مع نوع الوثيقة'
    });
  }
});

export const identityStatusResponseSchema = z.object({
  isUploaded: z.boolean(),
  status: z.nativeEnum(VerificationStatus),
  documentType: z.nativeEnum(IdentityDocumentType).nullable().optional(),
  maskedIdNumber: z.string().nullable().optional(),
  uploadedAt: z.string().or(z.date()).nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  canUploadDealPaymentProof: z.boolean()
});

export const adminVerifyIdentitySchema = z.object({
  documentId: z.string().uuid()
});

export const adminRejectIdentitySchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(5, 'سبب الرفض يجب ألا يقل عن 5 أحرف').max(500)
});
