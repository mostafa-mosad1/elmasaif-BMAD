import { z } from 'zod';
import {
  adminRejectIdentitySchema,
  adminVerifyIdentitySchema,
  identityStatusResponseSchema,
  uploadIdentityDocumentSchema
} from '../schemas/identity.schema';

export type UploadIdentityDocumentInput = z.infer<typeof uploadIdentityDocumentSchema>;
export type IdentityStatusResponse = z.infer<typeof identityStatusResponseSchema>;
export type AdminVerifyIdentityInput = z.infer<typeof adminVerifyIdentitySchema>;
export type AdminRejectIdentityInput = z.infer<typeof adminRejectIdentitySchema>;
